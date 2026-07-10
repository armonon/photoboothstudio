// Download the background-removal model at build time (too large for git).
//
// ISNet (general use) — an IS-Net segmentation model (MIT licensed). We use it
// instead of BiRefNet because BiRefNet requires a fixed 1024×1024 input whose
// peak activations blow past the 4 GB wasm32 memory ceiling and abort inference
// in the browser. ISNet runs at the same 1024×1024 within budget, on the main
// thread, so it works both on the web and in the offline desktop app.
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";

const URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx";
const OUT = "public/models/isnet.onnx";

mkdirSync("public/models", { recursive: true });
if (existsSync(OUT)) {
  console.log("model already present — skipping download");
} else {
  console.log("downloading isnet-general-use.onnx (~178MB)…");
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`model download failed: ${res.status}`);
  await writeFile(OUT, Buffer.from(await res.arrayBuffer()));
  console.log("model downloaded");
}
