// Download the background-removal model at build time (too large for git).
// BiRefNet (lite) is the current state-of-the-art for background removal.
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";

const URL = "https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx";
const OUT = "public/models/birefnet-lite.onnx";

mkdirSync("public/models", { recursive: true });
if (existsSync(OUT)) {
  console.log("model already present — skipping download");
} else {
  console.log("downloading birefnet-lite.onnx (~214MB)…");
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`model download failed: ${res.status}`);
  await writeFile(OUT, Buffer.from(await res.arrayBuffer()));
  console.log("model downloaded");
}
