// Download the on-device models at build time (too large for git; public/models is gitignored).
//
// - ISNet (general use, MIT) for automatic background removal — chosen over BiRefNet,
//   which OOM'd the 4 GB wasm32 ceiling at its fixed 1024×1024 input.
// - MobileSAM encoder + decoder for the Studio "Smart select" tool (click a subject →
//   Segment-Anything mask). Tiny ViT encoder, runs in single-thread wasm within budget.
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";

const MODELS = [
  { url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx", out: "public/models/isnet.onnx", note: "isnet-general-use (~178MB)" },
  { url: "https://huggingface.co/spaces/Akbartus/projects/resolve/main/mobilesam.encoder.onnx", out: "public/models/sam/encoder.onnx", note: "MobileSAM encoder (~28MB)" },
  { url: "https://raw.githubusercontent.com/akbartus/MobileSAM-in-the-Browser/main/models/mobilesam.decoder.onnx", out: "public/models/sam/decoder.onnx", note: "MobileSAM decoder (~16MB)" },
];

mkdirSync("public/models/sam", { recursive: true });
for (const m of MODELS) {
  if (existsSync(m.out)) {
    console.log(`${m.out} present — skipping`);
    continue;
  }
  console.log(`downloading ${m.note}…`);
  const res = await fetch(m.url);
  if (!res.ok) throw new Error(`download failed (${res.status}) for ${m.url}`);
  await writeFile(m.out, Buffer.from(await res.arrayBuffer()));
  console.log(`  → ${m.out}`);
}
