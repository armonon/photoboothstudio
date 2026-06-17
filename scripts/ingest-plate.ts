/**
 * Photo -> Plate ingestion (deterministic, no AI).
 *
 * Turns one clean photo of a WHITE blank garment into the four assets the composite
 * engine needs, plus a default print region:
 *   <name>.png              cutout garment on transparent background  (baseImageUrl)
 *   <name>-mask.png         garment alpha mask                        (recolorMaskUrl)
 *   <name>-shadow.png       luminance/fold map (darkens prints)       (region.shadowMapUrl)
 *   <name>-displacement.png gradient map (bends prints over folds)    (region.displacementMapUrl)
 * and prints a MannequinPlate JSON entry to paste into your seed/DB.
 *
 * Usage:
 *   npx tsx scripts/ingest-plate.ts --in photo.png --garment tank --view front \
 *     --color white [--fit regular] [--model neutralMannequin] \
 *     [--premasked] [--bg auto|#RRGGBB] [--region cx,cy,w,h] [--size 2048]
 *
 *   --premasked   input already has a transparent background (skip cutout)
 *   --bg          background color to key out (default: auto = sample corners)
 *   --region      print box, normalized to the garment bbox (default chest)
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Args = Record<string, string | boolean>;
function parseArgs(argv: string[]): Args {
  const a: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) a[key] = true;
      else { a[key] = next; i++; }
    }
  }
  return a;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.in as string;
  if (!input) throw new Error("Missing --in <photo>");
  const garment = (args.garment as string) ?? "tshirt";
  const view = (args.view as string) ?? "front";
  const fit = (args.fit as string) ?? "regular";
  const model = (args.model as string) ?? "neutralMannequin";
  const color = (args.color as string) ?? "white";
  const size = parseInt((args.size as string) ?? "2048", 10);
  const premasked = Boolean(args.premasked);
  const outDir = (args.out as string) ?? path.join(process.cwd(), "public", "plates");
  await mkdir(outDir, { recursive: true });

  // 1. Draw the photo centered/contained on a square canvas.
  const img = await loadImage(input);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const scale = Math.min(size / img.width, size / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  const data = ctx.getImageData(0, 0, size, size);
  const px = data.data;

  // 2. Alpha: premasked uses existing alpha; otherwise chroma-key the background.
  const alpha = new Uint8ClampedArray(size * size);
  if (premasked) {
    for (let i = 0; i < size * size; i++) alpha[i] = px[i * 4 + 3];
  } else {
    let bg = { r: 255, g: 255, b: 255 };
    if (typeof args.bg === "string" && args.bg !== "auto") bg = hexToRgb(args.bg);
    else {
      // average the 4 corners
      const corners = [0, size - 1, (size - 1) * size, size * size - 1];
      let r = 0, g = 0, b = 0;
      for (const c of corners) { r += px[c * 4]; g += px[c * 4 + 1]; b += px[c * 4 + 2]; }
      bg = { r: r / 4, g: g / 4, b: b / 4 };
    }
    const lo = 38, hi = 85; // soft key band on color distance
    for (let i = 0; i < size * size; i++) {
      const dr = px[i * 4] - bg.r, dg = px[i * 4 + 1] - bg.g, db = px[i * 4 + 2] - bg.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      alpha[i] = Math.round(clamp((dist - lo) / (hi - lo), 0, 1) * 255);
    }
  }

  // bbox of garment for region placement
  let minX = size, minY = size, maxX = 0, maxY = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (alpha[y * size + x] > 24) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);

  // 3. Cutout base (garment on transparent bg)
  const base = createCanvas(size, size);
  const bctx = base.getContext("2d");
  const baseData = bctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    baseData.data[i * 4] = px[i * 4]; baseData.data[i * 4 + 1] = px[i * 4 + 1];
    baseData.data[i * 4 + 2] = px[i * 4 + 2]; baseData.data[i * 4 + 3] = alpha[i];
  }
  bctx.putImageData(baseData, 0, 0);

  // 4. Mask (white where garment, transparent elsewhere)
  const mask = createCanvas(size, size);
  const mctx = mask.getContext("2d");
  const maskData = mctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    maskData.data[i * 4] = 255; maskData.data[i * 4 + 1] = 255; maskData.data[i * 4 + 2] = 255;
    maskData.data[i * 4 + 3] = alpha[i];
  }
  mctx.putImageData(maskData, 0, 0);

  // 5. Shadow map: garment luminance (folds), white(=no darkening) off-garment.
  //    Contrast-stretched around the garment's own mean so folds read.
  let sum = 0, n = 0;
  for (let i = 0; i < size * size; i++) if (alpha[i] > 24) { sum += lum(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); n++; }
  const mean = n ? sum / n : 200;
  const shadow = createCanvas(size, size);
  const sctx = shadow.getContext("2d");
  const shadowData = sctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    let v = 255;
    if (alpha[i] > 24) {
      const l = lum(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
      v = clamp(Math.round(255 + (l - mean) * 1.35), 120, 255); // keep highlights ~255, deepen folds
    }
    shadowData.data[i * 4] = v; shadowData.data[i * 4 + 1] = v; shadowData.data[i * 4 + 2] = v; shadowData.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(shadowData, 0, 0);

  // 6. Displacement map: luminance gradient -> R(dx) G(dy), neutral 128 elsewhere.
  const disp = createCanvas(size, size);
  const dctx = disp.getContext("2d");
  const dispData = dctx.createImageData(size, size);
  const L = (x: number, y: number) => lum(px[(y * size + x) * 4], px[(y * size + x) * 4 + 1], px[(y * size + x) * 4 + 2]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    let rr = 128, gg = 128;
    if (alpha[i] > 24 && x > 0 && x < size - 1 && y > 0 && y < size - 1) {
      const gx = (L(x + 1, y) - L(x - 1, y)) / 2;
      const gy = (L(x, y + 1) - L(x, y - 1)) / 2;
      rr = clamp(Math.round(128 + gx * 1.6), 0, 255);
      gg = clamp(Math.round(128 + gy * 1.6), 0, 255);
    }
    dispData.data[i * 4] = rr; dispData.data[i * 4 + 1] = gg; dispData.data[i * 4 + 2] = 128; dispData.data[i * 4 + 3] = 255;
  }
  dctx.putImageData(dispData, 0, 0);

  // 7. Default print region (chest), or --region cx,cy,w,h normalized to bbox.
  const placement = view === "back" ? "back" : "front";
  let cx = 0.5, cy = 0.34, rw = 0.46, rh = 0.5;
  if (typeof args.region === "string") {
    const [a, b, c, d] = args.region.split(",").map(Number);
    cx = a; cy = b; rw = c; rh = d;
  }
  const regX = minX + (cx - rw / 2) * bw;
  const regY = minY + cy * bh;
  const regW = rw * bw, regH = rh * bw; // height keyed to width to keep prints square-ish
  const bounds = { x: Math.round(regX), y: Math.round(regY), width: Math.round(regW), height: Math.round(regH) };

  // write files
  const baseName = `${garment}-${view}-${fit}-${color}`;
  const files: Array<[string, any]> = [
    [`${baseName}.png`, base], [`${baseName}-mask.png`, mask],
    [`${baseName}-shadow.png`, shadow], [`${baseName}-displacement.png`, disp],
  ];
  for (const [fname, cv] of files) await writeFile(path.join(outDir, fname), cv.toBuffer("image/png"));

  const plate = {
    id: `${baseName}-${model}`,
    garmentType: garment, view, fitStyle: fit, modelType: model,
    baseImageUrl: `/plates/${baseName}.png`,
    recolorMaskUrl: `/plates/${baseName}-mask.png`,
    regions: [{
      placement,
      warpMesh: [
        [bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y],
        [bounds.x + bounds.width, bounds.y + bounds.height], [bounds.x, bounds.y + bounds.height],
      ],
      bounds,
      displacementMapUrl: `/plates/${baseName}-displacement.png`,
      shadowMapUrl: `/plates/${baseName}-shadow.png`,
    }],
    width: size, height: size,
  };
  console.log("\nGenerated 4 assets in", outDir);
  console.log("Garment bbox:", { minX, minY, bw, bh });
  console.log("\nPlate entry (paste into seed):\n" + JSON.stringify(plate, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
