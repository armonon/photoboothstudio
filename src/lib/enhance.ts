import type { FreeBackground } from "@/lib/bg";

export type EnhanceFraming = "keep" | "square";

export interface StudioOptions {
  background: FreeBackground;
  autoColor: boolean; // auto white-balance + levels + gentle contrast
  shadow: boolean; // procedural contact shadow under the garment
  framing: EnhanceFraming; // keep original dimensions, or center on a square
}

const BG_FILL: Record<Exclude<FreeBackground, "transparent">, string> = {
  white: "#ffffff",
  softGrey: "#ececec",
};

const SQUARE_MARGIN = 0.08; // breathing room around the garment when framing square
const CONTRAST = 1.08; // gentle S-curve strength
const WB_DAMP = 0.6; // how far to push gray-world white balance (0 = none, 1 = full)

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return { c, ctx };
}

async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bmp = await createImageBitmap(blob);
  try {
    const { ctx } = makeCanvas(bmp.width, bmp.height);
    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(0, 0, bmp.width, bmp.height);
  } finally {
    bmp.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))), "image/png"),
  );
}

const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sCurve = (v: number) => clamp8(((v / 255 - 0.5) * CONTRAST + 0.5) * 255);

function percentile(hist: Uint32Array, total: number, p: number): number {
  const target = total * p;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return 255;
}

/**
 * Gray-world white balance + percentile levels stretch + gentle contrast,
 * measured and applied only over the garment (where the cutout is opaque).
 * Mutates `img` in place; alpha is left untouched.
 */
function autoCorrect(img: ImageData): void {
  const d = img.data;
  const n = d.length;
  let sumR = 0,
    sumG = 0,
    sumB = 0,
    count = 0;
  const lumHist = new Uint32Array(256);

  for (let i = 0; i < n; i += 4) {
    if (d[i + 3] < 128) continue;
    const r = d[i],
      g = d[i + 1],
      b = d[i + 2];
    sumR += r;
    sumG += g;
    sumB += b;
    count++;
    lumHist[(r * 0.299 + g * 0.587 + b * 0.114) | 0]++;
  }
  if (!count) return;

  const mr = sumR / count,
    mg = sumG / count,
    mb = sumB / count;
  const gray = (mr + mg + mb) / 3;
  const sr = lerp(1, gray / Math.max(1, mr), WB_DAMP);
  const sg = lerp(1, gray / Math.max(1, mg), WB_DAMP);
  const sb = lerp(1, gray / Math.max(1, mb), WB_DAMP);

  const lo = percentile(lumHist, count, 0.005);
  const hi = percentile(lumHist, count, 0.995);
  const range = Math.max(1, hi - lo);

  for (let i = 0; i < n; i += 4) {
    if (d[i + 3] < 16) continue;
    d[i] = sCurve(((d[i] * sr - lo) / range) * 255);
    d[i + 1] = sCurve(((d[i + 1] * sg - lo) / range) * 255);
    d[i + 2] = sCurve(((d[i + 2] * sb - lo) / range) * 255);
  }
}

/** Tight bounding box of the visible (alpha) pixels. */
function alphaBounds(img: ImageData) {
  const { data, width, height } = img;
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0,
    found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return { x: 0, y: 0, w: width, h: height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** A solid-black copy of `src` that keeps only its alpha — used as a drop shadow. */
function makeSilhouette(src: HTMLCanvasElement) {
  const { c, ctx } = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * Turn a transparent garment cutout into a finished studio mockup, entirely on
 * the local canvas: auto color correction, optional procedural contact shadow,
 * optional square framing, composited onto the chosen background.
 */
export async function studioEnhance(cutout: Blob, opts: StudioOptions): Promise<Blob> {
  const img = await blobToImageData(cutout);
  if (opts.autoColor) autoCorrect(img);

  const { c: garment } = (() => {
    const made = makeCanvas(img.width, img.height);
    made.ctx.putImageData(img, 0, 0);
    return made;
  })();

  // Placement: keep the original frame, or center the garment on a square.
  let outW = img.width,
    outH = img.height,
    drawX = 0,
    drawY = 0,
    drawW = img.width,
    drawH = img.height;

  if (opts.framing === "square") {
    const side = Math.max(img.width, img.height);
    outW = outH = side;
    const box = alphaBounds(img);
    const avail = side * (1 - 2 * SQUARE_MARGIN);
    const scale = Math.min(avail / box.w, avail / box.h, 1.5);
    drawW = img.width * scale;
    drawH = img.height * scale;
    drawX = side / 2 - (box.x + box.w / 2) * scale;
    drawY = side / 2 - (box.y + box.h / 2) * scale;
  }

  const { c: out, ctx } = makeCanvas(outW, outH);
  const onSurface = opts.background !== "transparent";
  if (opts.background !== "transparent") {
    ctx.fillStyle = BG_FILL[opts.background];
    ctx.fillRect(0, 0, outW, outH);
  }

  // Contact shadow only makes sense on an actual surface, not on transparency.
  if (opts.shadow && onSurface) {
    const sil = makeSilhouette(garment);
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.filter = `blur(${Math.max(2, Math.round(Math.max(outW, outH) * 0.018))}px)`;
    ctx.drawImage(sil, drawX, drawY + Math.round(drawH * 0.02), drawW, drawH);
    ctx.restore();
  }

  ctx.drawImage(garment, drawX, drawY, drawW, drawH);
  return canvasToBlob(out);
}
