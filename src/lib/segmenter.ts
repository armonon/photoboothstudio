// Salient-object background removal with onnxruntime-web + a self-hosted U²-Net model.
// Everything — runtime (/ort), wasm, and model (/models) — is served locally, so it works
// fully offline once bundled into the desktop app. No third-party CDN, no API.
//
// onnxruntime-web doesn't bundle cleanly under webpack/Next, so we load its ESM build
// directly from the local /ort path with a runtime dynamic import that webpack can't see.

const SIZE = 320; // U²-Net input resolution
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ort = any;
// new Function avoids webpack rewriting/bundling the import and TS resolving the URL.
const importLocal = (url: string): Promise<Ort> =>
  (new Function("u", "return import(u)") as (u: string) => Promise<Ort>)(url);

let ortPromise: Promise<Ort> | null = null;
let sessionPromise: Promise<Ort> | null = null;

async function getOrt(): Promise<Ort> {
  if (!ortPromise) {
    ortPromise = importLocal("/ort/ort.wasm.min.mjs").then((ort) => {
      ort.env.wasm.wasmPaths = "/ort/";
      ort.env.wasm.numThreads = 1; // single-threaded: no SharedArrayBuffer / COOP-COEP needed
      ort.env.wasm.proxy = false;
      return ort;
    });
  }
  return ortPromise;
}

async function getSession(): Promise<Ort> {
  if (!sessionPromise) {
    sessionPromise = getOrt().then((ort) =>
      ort.InferenceSession.create("/models/u2netp.onnx", { executionProviders: ["wasm"] }),
    );
  }
  return sessionPromise;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })!] as const;
}

/** Remove the background locally; returns a transparent PNG cutout. */
export async function removeBackgroundOnnx(input: Blob): Promise<Blob> {
  const ort = await getOrt();
  const session = await getSession();

  const bitmap = await createImageBitmap(input);
  const W = bitmap.width;
  const H = bitmap.height;

  const [full, fullCtx] = canvas(W, H);
  fullCtx.drawImage(bitmap, 0, 0);

  const [small, sctx] = canvas(SIZE, SIZE);
  sctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
  bitmap.close();
  const { data } = sctx.getImageData(0, 0, SIZE, SIZE);

  // Preprocess → CHW float tensor, normalized like rembg (divide by max, then mean/std).
  const plane = SIZE * SIZE;
  let max = 1;
  for (let i = 0; i < data.length; i += 4) max = Math.max(max, data[i], data[i + 1], data[i + 2]);
  const chw = new Float32Array(3 * plane);
  for (let p = 0; p < plane; p++) {
    chw[p] = (data[p * 4] / max - MEAN[0]) / STD[0];
    chw[plane + p] = (data[p * 4 + 1] / max - MEAN[1]) / STD[1];
    chw[2 * plane + p] = (data[p * 4 + 2] / max - MEAN[2]) / STD[2];
  }

  const feeds = { [session.inputNames[0]]: new ort.Tensor("float32", chw, [1, 3, SIZE, SIZE]) };
  const result = await session.run(feeds);
  const pred = result[session.outputNames[0]].data as Float32Array;

  // Min-max normalize the saliency map to 0..255.
  let mi = Infinity;
  let ma = -Infinity;
  for (let i = 0; i < plane; i++) {
    if (pred[i] < mi) mi = pred[i];
    if (pred[i] > ma) ma = pred[i];
  }
  const range = ma - mi || 1;

  const [mask, mctx] = canvas(SIZE, SIZE);
  const maskImg = mctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < plane; i++) {
    const a = ((pred[i] - mi) / range) * 255;
    maskImg.data[i * 4] = maskImg.data[i * 4 + 1] = maskImg.data[i * 4 + 2] = a;
    maskImg.data[i * 4 + 3] = 255;
  }
  mctx.putImageData(maskImg, 0, 0);

  // Upscale the mask to the original size and use it as the alpha channel.
  const [scaled, scctx] = canvas(W, H);
  scctx.imageSmoothingEnabled = true;
  scctx.imageSmoothingQuality = "high";
  scctx.drawImage(mask, 0, 0, W, H);
  const maskData = scctx.getImageData(0, 0, W, H).data;

  const out = fullCtx.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) out.data[i * 4 + 3] = maskData[i * 4];
  fullCtx.putImageData(out, 0, 0);

  return new Promise<Blob>((resolve, reject) =>
    full.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode cutout"))), "image/png"),
  );
}
