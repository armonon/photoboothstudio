/* MobileSAM (Segment Anything) in a classic Web Worker — the "Smart select" tool.
   The ViT-tiny encoder runs once per image (~6s) → an embedding; the decoder runs
   per click (~0.3s) → a mask. Kept off the main thread so the UI stays live.
   Classic worker (importScripts) so it works in the desktop WKWebView too. */

let ready = false;
let RT = null;
let encP = null; // cached session promises
let decP = null;
const embeddings = {}; // layerId -> image_embeddings tensor (cached across clicks)

function ensure(cfg) {
  if (!ready) {
    importScripts(cfg.ortUrl);
    RT = self.ort;
    RT.env.wasm.wasmPaths = cfg.wasmPaths;
    RT.env.wasm.numThreads = 1;
    RT.env.wasm.proxy = false;
    RT.env.wasm.simd = true;
    ready = true;
  }
  if (!encP) encP = RT.InferenceSession.create(cfg.encoderUrl, { executionProviders: ["wasm"] });
  if (!decP) decP = RT.InferenceSession.create(cfg.decoderUrl, { executionProviders: ["wasm"] });
  return Promise.all([encP, decP]);
}

self.onmessage = async (e) => {
  const m = e.data || {};
  try {
    const [enc, dec] = await ensure(m);
    if (m.type === "init") {
      self.postMessage({ type: "ready" });
      return;
    }
    if (m.type === "encode") {
      // m.data = HWC float32 (0..255), resized so the longest side is 1024
      const input = new RT.Tensor("float32", m.data, [m.h, m.w, 3]);
      const out = await enc.run({ input_image: input });
      embeddings[m.id] = out.image_embeddings;
      self.postMessage({ type: "encoded", id: m.id, reqId: m.reqId });
      return;
    }
    if (m.type === "decode") {
      const emb = embeddings[m.id];
      if (!emb) {
        self.postMessage({ type: "error", reqId: m.reqId, message: "layer not encoded yet" });
        return;
      }
      // m.points: [[xResized, yResized, label], ...] (label 1 = keep, 0 = exclude)
      const n = m.points.length;
      const coords = new Float32Array((n + 1) * 2);
      const labels = new Float32Array(n + 1);
      m.points.forEach((p, i) => {
        coords[i * 2] = p[0];
        coords[i * 2 + 1] = p[1];
        labels[i] = p[2];
      });
      coords[n * 2] = 0;
      coords[n * 2 + 1] = 0;
      labels[n] = -1; // required padding point
      const feeds = {
        image_embeddings: emb,
        point_coords: new RT.Tensor("float32", coords, [1, n + 1, 2]),
        point_labels: new RT.Tensor("float32", labels, [1, n + 1]),
        mask_input: new RT.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]),
        has_mask_input: new RT.Tensor("float32", new Float32Array([0]), [1]),
        orig_im_size: new RT.Tensor("float32", new Float32Array([m.origH, m.origW]), [2]),
      };
      const out = await dec.run(feeds);
      const masks = out.masks;
      const iou = out.iou_predictions;
      const [, nm, mh, mw] = masks.dims;
      let best = 0;
      for (let i = 1; i < nm; i++) if (iou.data[i] > iou.data[best]) best = i;
      const off = best * mh * mw;
      const bin = new Uint8Array(mh * mw);
      for (let i = 0; i < mh * mw; i++) bin[i] = masks.data[off + i] > 0 ? 255 : 0;
      self.postMessage({ type: "mask", reqId: m.reqId, mask: bin, w: mw, h: mh }, [bin.buffer]);
      return;
    }
    if (m.type === "forget") {
      delete embeddings[m.id];
      return;
    }
  } catch (err) {
    self.postMessage({ type: "error", reqId: m.reqId, id: m.id, message: String((err && err.message) || err) });
  }
};
