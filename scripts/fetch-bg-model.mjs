// Download the @imgly background-removal model assets for OFFLINE bundling.
// Only the smallest variant (isnet_quint8) + the onnxruntime wasm are fetched, so
// the desktop app can run background removal with no network. Served at /bg-model/.
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const VERSION = "1.7.0";
const BASE = `https://staticimgly.com/@imgly/background-removal-data/${VERSION}/dist`;
const OUT = path.join("public", "bg-model");
const WANT = ["/onnxruntime-web/", "/models/isnet_quint8"];

const manifest = await (await fetch(`${BASE}/resources.json`)).json();
await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "resources.json"), JSON.stringify(manifest));

const chunks = new Map();
for (const [key, val] of Object.entries(manifest)) {
  if (!WANT.some((w) => key.startsWith(w))) continue;
  for (const c of val.chunks ?? []) chunks.set(c.hash, c);
}

let bytes = 0,
  fetched = 0;
for (const [hash] of chunks) {
  const dest = path.join(OUT, hash);
  if (existsSync(dest)) continue;
  const r = await fetch(`${BASE}/${hash}`);
  if (!r.ok) throw new Error(`Failed ${hash}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await writeFile(dest, buf);
  bytes += buf.length;
  fetched++;
}
console.log(`bg-model: ${chunks.size} chunks (${fetched} new), ${(bytes / 1048576).toFixed(1)} MB → ${OUT}/`);
