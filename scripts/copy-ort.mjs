// Copy ORT runtime files from node_modules to public/ort/ at build time.
// ORT 1.17.3 ships four WASM variants so the runtime can fall back to the
// non-threaded build when SharedArrayBuffer is unavailable (e.g. Tauri WKWebView).
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = "node_modules/onnxruntime-web/dist";
const dst = "public/ort";
mkdirSync(dst, { recursive: true });

// WASM binaries (all four variants for automatic fallback selection)
for (const f of readdirSync(src)) {
  if (f.endsWith(".wasm") && !f.includes("training") && !f.includes("jsep")) {
    copyFileSync(join(src, f), join(dst, f));
  }
}

// ESM bundle — rename .js → .mjs so the dynamic import in segmenter.ts works
copyFileSync(join(src, "esm/ort.wasm.min.js"), join(dst, "ort.wasm.min.mjs"));

console.log("ORT runtime files copied to public/ort/");
