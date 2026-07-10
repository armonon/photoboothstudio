// Stage the onnxruntime-web runtime into public/ort/ so it is served locally
// (works offline in the bundled desktop app — no CDN, no network).
//
// We run inference SINGLE-THREADED on the MAIN THREAD (numThreads:1, proxy:false),
// loading the UMD build via a <script> tag (see src/lib/segmenter.ts). That path:
//   • needs NO Web Workers or SharedArrayBuffer — the ESM build's proxy/thread
//     workers are `type:"module"`, which the desktop app's WKWebView blocks, and
//     which also fail to resolve the wasm URL inside the worker;
//   • selects the NON-threaded wasm binary (ort-wasm-simd.wasm), which uses
//     growable memory instead of a fixed-size SharedArrayBuffer.
//
// So we stage the UMD bundle + the non-threaded binaries. onnxruntime-web is pinned
// to 1.18.0 because 1.19+ stopped shipping the non-threaded wasm binaries.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = "node_modules/onnxruntime-web/dist";
const out = "public/ort";

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const stripSourceMap = (t) => t.replace(/\/\/[#@]\s*sourceMappingURL=\S*/g, "");

// UMD bundle -> ort.umd.js (defines the global `ort`, initialises wasm on the main thread).
const umd = join(dist, "ort.wasm.min.js");
if (!existsSync(umd)) throw new Error("missing UMD build " + umd + " (is onnxruntime-web installed?)");
writeFileSync(join(out, "ort.umd.js"), stripSourceMap(readFileSync(umd, "utf8")));

// Only the non-threaded binaries are needed for main-thread, single-thread inference:
// ort-wasm-simd.wasm (used on every modern browser/WKWebView) and ort-wasm.wasm as a
// no-SIMD fallback. Skip the threaded/jsep/training variants to keep the repo lean.
const wanted = new Set(["ort-wasm-simd.wasm", "ort-wasm.wasm"]);
let wasm = 0;
for (const f of readdirSync(dist)) {
  if (wanted.has(f)) {
    copyFileSync(join(dist, f), join(out, f));
    wasm++;
  }
}

console.log(`ORT runtime staged to ${out}/ (ort.umd.js + ${wasm} wasm binaries)`);
