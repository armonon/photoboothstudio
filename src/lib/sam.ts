// "Smart select" — MobileSAM, driven from a classic Web Worker (public/sam-worker.js).
// Encode a layer's image once (cached in the worker by id), then decode click points
// into a mask. All single-thread wasm, so it runs on web and in the desktop WKWebView.

const ENCODER_SIZE = 1024; // SAM resizes the longest side to this

function samConfig() {
  return {
    ortUrl: new URL("/ort/ort.umd.js", location.href).href,
    wasmPaths: new URL("/ort/", location.href).href,
    encoderUrl: new URL("/models/sam/encoder.onnx", location.href).href,
    decoderUrl: new URL("/models/sam/decoder.onnx", location.href).href,
  };
}

let worker: Worker | null = null;
let reqId = 0;
type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
const pending = new Map<number, Pending>();
const scales = new Map<string, number>(); // layer id -> encoder resize scale

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker("/sam-worker.js");
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data || {};
      const key = m.reqId as number | undefined;
      if (m.type === "encoded" && key != null) {
        pending.get(key)?.resolve(undefined);
        pending.delete(key);
      } else if (m.type === "mask" && key != null) {
        pending.get(key)?.resolve(m);
        pending.delete(key);
      } else if (m.type === "error" && key != null) {
        pending.get(key)?.reject(new Error(m.message || "SAM failed"));
        pending.delete(key);
      }
    };
    worker.onerror = () => {
      const err = new Error("Smart-select worker crashed");
      pending.forEach((p) => p.reject(err));
      pending.clear();
    };
  }
  return worker;
}

export function samWarm(): void {
  try {
    getWorker().postMessage({ type: "init", ...samConfig() });
  } catch {
    /* ignore */
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })!] as const;
}

/** Encode a layer's original RGBA (once). Returns when the embedding is ready. */
export function samEncode(id: string, rgba: Uint8ClampedArray, W: number, H: number): Promise<void> {
  const scale = ENCODER_SIZE / Math.max(W, H);
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));
  scales.set(id, scale);
  // resize to longest-side-1024, then pack HWC float32 (0..255)
  const [src, sctx] = canvas(W, H);
  sctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), W, H), 0, 0);
  const [, dctx] = canvas(w, h);
  dctx.drawImage(src, 0, 0, w, h);
  const img = dctx.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h * 3);
  for (let p = 0, q = 0; p < w * h; p++, q += 3) {
    data[q] = img[p * 4];
    data[q + 1] = img[p * 4 + 1];
    data[q + 2] = img[p * 4 + 2];
  }
  const id2 = ++reqId;
  return new Promise<void>((resolve, reject) => {
    pending.set(id2, { resolve: () => resolve(), reject });
    getWorker().postMessage({ type: "encode", id, reqId: id2, data, w, h, ...samConfig() }, [data.buffer]);
  });
}

export function samForget(id: string): void {
  scales.delete(id);
  try {
    worker?.postMessage({ type: "forget", id });
  } catch {
    /* ignore */
  }
}

export interface SamPoint {
  x: number; // native layer pixel
  y: number;
  keep: boolean; // true = include, false = exclude
}

/** Decode click points (native layer coords) into a binary mask at native W×H. */
export function samDecode(id: string, points: SamPoint[], W: number, H: number): Promise<{ mask: Uint8Array; w: number; h: number }> {
  const s = scales.get(id) ?? ENCODER_SIZE / Math.max(W, H);
  const pts = points.map((p) => [p.x * s, p.y * s, p.keep ? 1 : 0]);
  const id2 = ++reqId;
  return new Promise((resolve, reject) => {
    pending.set(id2, { resolve: (v) => resolve(v as { mask: Uint8Array; w: number; h: number }), reject });
    getWorker().postMessage({ type: "decode", id, reqId: id2, points: pts, origW: W, origH: H, ...samConfig() });
  });
}
