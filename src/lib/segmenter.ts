// Background removal with onnxruntime-web + a self-hosted ISNet (general use) model.
// Everything — runtime (/ort), wasm, and model (/models) — is served locally, so it works
// fully offline once bundled into the desktop app. No third-party CDN, no API.
//
// Inference runs SINGLE-THREADED ON THE MAIN THREAD (numThreads:1, proxy:false), using the
// UMD build loaded via a <script> tag. This is the one configuration that works everywhere:
//   • No Web Workers / SharedArrayBuffer. ORT's ESM proxy + pthread workers are `type:"module"`,
//     which the desktop app's WKWebView blocks (and which also fail to resolve the wasm URL
//     inside the worker). The UMD build initialises wasm directly on the main thread.
//   • numThreads:1 selects the non-threaded wasm binary (ort-wasm-simd.wasm), which uses
//     growable memory rather than a fixed-size SharedArrayBuffer.
// It's a few seconds per image, but it never fails — which multi-threaded/proxied wasm did.

const SIZE = 1024; // ISNet input resolution
const MAX_DIM = 4096; // cap the working/output resolution to bound canvas memory on big batches
const MEAN = [0.5, 0.5, 0.5]; // ISNet normalization: (x/255 - 0.5) / 1.0
const STD = [1.0, 1.0, 1.0];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ort = any;

let ortPromise: Promise<Ort> | null = null;
let sessionPromise: Promise<Ort> | null = null;

// Load the UMD build via a <script> tag so webpack never touches it and wasm is
// initialised on the main thread (the ESM build only initialises via a module worker).
function loadOrtScript(): Promise<Ort> {
  const w = window as unknown as { ort?: Ort };
  if (w.ort) return Promise.resolve(w.ort);
  return new Promise<Ort>((resolve, reject) => {
    const done = () => (w.ort ? resolve(w.ort) : reject(new Error("ONNX runtime failed to load")));
    const existing = document.querySelector<HTMLScriptElement>("script[data-ort]");
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => reject(new Error("ONNX runtime failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = "/ort/ort.umd.js";
    s.async = true;
    s.dataset.ort = "1";
    s.onload = done;
    s.onerror = () => reject(new Error("ONNX runtime failed to load"));
    document.head.appendChild(s);
  });
}

async function getOrt(): Promise<Ort> {
  if (!ortPromise) {
    ortPromise = loadOrtScript().then((ort) => {
      // Absolute URL: the wasm loader can't resolve a root-relative path in every context.
      ort.env.wasm.wasmPaths = new URL("/ort/", location.href).href;
      ort.env.wasm.numThreads = 1; // main-thread, non-threaded binary (growable memory)
      ort.env.wasm.proxy = false; // no module worker (blocked in WKWebView)
      ort.env.wasm.simd = true;
      return ort;
    });
  }
  return ortPromise;
}

async function getSession(): Promise<Ort> {
  if (!sessionPromise) {
    sessionPromise = getOrt().then((ort) =>
      ort.InferenceSession.create("/models/isnet.onnx", { executionProviders: ["wasm"] }),
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

/** Start loading the ORT runtime and model in the background (call early to reduce first-run wait). */
export function warmupModel(): void {
  getSession().catch(() => {/* ignore — errors surface properly on first real call */});
}

/** Remove the background locally; returns a transparent PNG cutout. */
export async function removeBackgroundOnnx(input: Blob): Promise<Blob> {
  const ort = await getOrt();
  const session = await getSession();

  const bitmap = await createImageBitmap(input);
  // Downscale oversized photos so a 40-image batch can't blow up canvas memory.
  const fit = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const W = Math.round(bitmap.width * fit);
  const H = Math.round(bitmap.height * fit);

  const [full, fullCtx] = canvas(W, H);
  fullCtx.drawImage(bitmap, 0, 0, W, H);

  const [, sctx] = canvas(SIZE, SIZE);
  sctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
  bitmap.close();
  const { data } = sctx.getImageData(0, 0, SIZE, SIZE);

  // Preprocess → CHW float tensor: x/255, then (x - mean) / std (ISNet: mean 0.5, std 1).
  const plane = SIZE * SIZE;
  const chw = new Float32Array(3 * plane);
  for (let p = 0; p < plane; p++) {
    chw[p] = (data[p * 4] / 255 - MEAN[0]) / STD[0];
    chw[plane + p] = (data[p * 4 + 1] / 255 - MEAN[1]) / STD[1];
    chw[2 * plane + p] = (data[p * 4 + 2] / 255 - MEAN[2]) / STD[2];
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
  const [, scctx] = canvas(W, H);
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
