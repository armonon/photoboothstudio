/* ISNet background-removal inference, run in a CLASSIC Web Worker so the ~15-20s
   wasm inference never blocks the UI thread. Classic workers (importScripts) work
   in the desktop WKWebView; ORT's own proxy/pthread workers are `type:"module"`,
   which WKWebView blocks — that's why the main app loads the UMD build directly.

   Only inference lives here. The main thread does the (fast) canvas pre/post-processing
   and streams the CHW float tensor in and the saliency map out (both transferable). */

let ready = false;
let ort = null;
let sessionPromise = null; // cached so init + a racing run build the session only once

function ensure(cfg) {
  if (!ready) {
    importScripts(cfg.ortUrl);
    ort = self.ort;
    ort.env.wasm.wasmPaths = cfg.wasmPaths;
    ort.env.wasm.numThreads = 1; // non-threaded binary, growable memory, no SharedArrayBuffer
    ort.env.wasm.proxy = false;
    ort.env.wasm.simd = true;
    ready = true;
  }
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(cfg.modelUrl, { executionProviders: ["wasm"] });
  }
  return sessionPromise;
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  try {
    if (msg.type === "init") {
      await ensure(msg);
      self.postMessage({ type: "ready" });
      return;
    }
    if (msg.type === "run") {
      const session = await ensure(msg);
      const feeds = {};
      feeds[session.inputNames[0]] = new ort.Tensor("float32", msg.data, [1, 3, msg.size, msg.size]);
      const result = await session.run(feeds);
      const out = result[session.outputNames[0]].data;
      // transfer the buffer back (zero-copy)
      self.postMessage({ type: "result", id: msg.id, out: out }, [out.buffer]);
      return;
    }
  } catch (err) {
    self.postMessage({ type: "error", id: msg.id, message: String((err && err.message) || err) });
  }
};
