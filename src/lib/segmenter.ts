// Background removal with onnxruntime-web + a self-hosted ISNet (general use) model.
// Everything — runtime (/ort), wasm, and model (/models) — is served locally, so it works
// fully offline once bundled into the desktop app. No third-party CDN, no API.
//
// Inference runs SINGLE-THREADED in a CLASSIC Web Worker (public/isnet-worker.js) so the
// ~15-20s wasm run never freezes the UI. Why this exact shape works everywhere:
//   • Classic worker (importScripts) — the desktop WKWebView blocks `type:"module"` workers,
//     which is what ORT's own proxy/pthread paths use; a classic worker is fine.
//   • numThreads:1 selects the non-threaded wasm binary (ort-wasm-simd.wasm) with growable
//     memory — no SharedArrayBuffer, so no cross-origin-isolation requirement.
// The heavy model (BiRefNet) was dropped earlier because it OOM'd the 4GB wasm32 ceiling.

const SIZE = 1024; // ISNet input resolution
const MAX_DIM = 4096; // cap the working/output resolution to bound canvas memory on big batches
const MEAN = [0.5, 0.5, 0.5]; // ISNet normalization: (x/255 - 0.5) / 1.0
const STD = [1.0, 1.0, 1.0];

// Config the worker needs. Absolute URLs: a worker (and the wasm loader inside it) can't
// resolve root-relative paths against the page.
function workerConfig() {
  return {
    ortUrl: new URL("/ort/ort.umd.js", location.href).href,
    wasmPaths: new URL("/ort/", location.href).href,
    modelUrl: new URL("/models/isnet.onnx", location.href).href,
  };
}

let worker: Worker | null = null;
let reqId = 0;
const pending = new Map<number, { resolve: (v: Float32Array) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker("/isnet-worker.js");
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data || {};
      if (m.type === "result") {
        pending.get(m.id)?.resolve(m.out as Float32Array);
        pending.delete(m.id);
      } else if (m.type === "error") {
        pending.get(m.id)?.reject(new Error(m.message || "Inference failed"));
        pending.delete(m.id);
      }
      // "ready" is the warmup ack — nothing to resolve.
    };
    worker.onerror = () => {
      const err = new Error("Background-removal worker crashed");
      pending.forEach((p) => p.reject(err));
      pending.clear();
    };
  }
  return worker;
}

/** Run ISNet in the worker; returns the raw saliency map. Transfers the input buffer over. */
function infer(chw: Float32Array): Promise<Float32Array> {
  const w = getWorker();
  const id = ++reqId;
  return new Promise<Float32Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: "run", id, size: SIZE, data: chw, ...workerConfig() }, [chw.buffer]);
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })!] as const;
}

/** Start loading the runtime + model in the worker (call early to reduce first-run wait). */
export function warmupModel(): void {
  try {
    getWorker().postMessage({ type: "init", ...workerConfig() });
  } catch {
    /* ignore — a real call will surface any error */
  }
}

/** Remove the background locally; returns a transparent PNG cutout. */
export async function removeBackgroundOnnx(input: Blob): Promise<Blob> {
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

  const pred = await infer(chw); // runs in the worker — UI stays responsive

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
