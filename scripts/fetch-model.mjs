// Download the background-removal model at build time (too large for git).
// isnet-general-use is the high-quality general model used by rembg.
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";

const URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx";
const OUT = "public/models/isnet-general-use.onnx";

mkdirSync("public/models", { recursive: true });
if (existsSync(OUT)) {
  console.log("model already present — skipping download");
} else {
  console.log("downloading isnet-general-use.onnx (~170MB)…");
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`model download failed: ${res.status}`);
  await writeFile(OUT, Buffer.from(await res.arrayBuffer()));
  console.log("model downloaded");
}
