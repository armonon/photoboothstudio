import type {
  GarmentDesign,
  LightingPreset,
  MannequinPlate,
  PlateRegion,
  PrintArt,
  Scene,
} from "@/lib/types";

export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: "2d", options?: unknown): any;
  toDataURL?(type?: string): string;
  toBuffer?(mimeType?: string): Buffer;
}

export interface ImageLike {
  width: number;
  height: number;
}

export interface CompositeAdapter {
  createCanvas(width: number, height: number): CanvasLike;
  loadImage(src: string): Promise<ImageLike>;
}

interface Point {
  x: number;
  y: number;
}

const solidBackgrounds = {
  white: "#f7f7f2",
  dark: "#141414",
} as const;

const backdropUrls = {
  editorial: "/plates/backdrop-editorial.png",
  concrete: "/plates/backdrop-concrete.png",
  luxury: "/plates/backdrop-luxury.png",
} as const;

export async function renderComposite(
  scene: Scene,
  design: GarmentDesign,
  plate: MannequinPlate,
  adapter: CompositeAdapter,
) {
  const canvas = adapter.createCanvas(plate.width, plate.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  await compositeBackground(ctx, scene, plate, adapter);
  await drawRecoloredGarment(ctx, plate, design.baseColor, adapter);

  for (const print of design.prints) {
    const region = plate.regions.find((candidate) => candidate.placement === print.placement);
    if (region) await warpPrintOntoRegion(ctx, print, region, adapter);
  }

  await applyLighting(ctx, scene.lighting);
  return canvas;
}

export async function compositeBackground(
  ctx: any,
  scene: Scene,
  plate: MannequinPlate,
  adapter: CompositeAdapter,
): Promise<void> {
  ctx.clearRect(0, 0, plate.width, plate.height);
  if (scene.background === "transparent") return;

  const imageUrl =
    scene.background === "custom"
      ? scene.customBackgroundUrl
      : scene.background in backdropUrls
        ? backdropUrls[scene.background as keyof typeof backdropUrls]
        : undefined;

  if (imageUrl) {
    try {
      const image = await adapter.loadImage(imageUrl);
      drawImageCover(ctx, image, plate.width, plate.height);
      return;
    } catch {
      // Fall through to a neutral fill if a custom/background image is unavailable.
    }
  }

  ctx.fillStyle =
    scene.background in solidBackgrounds
      ? solidBackgrounds[scene.background as keyof typeof solidBackgrounds]
      : "#f7f7f2";
  ctx.fillRect(0, 0, plate.width, plate.height);
}

export async function drawRecoloredGarment(
  ctx: any,
  plate: MannequinPlate,
  hex: string,
  adapter: CompositeAdapter,
): Promise<void> {
  const base = await adapter.loadImage(plate.baseImageUrl);
  ctx.drawImage(base, 0, 0, plate.width, plate.height);

  const maskSource = plate.recolorMaskUrl ? await adapter.loadImage(plate.recolorMaskUrl) : base;
  const tint = adapter.createCanvas(plate.width, plate.height);
  const tintCtx = tint.getContext("2d");
  tintCtx.fillStyle = hex;
  tintCtx.fillRect(0, 0, plate.width, plate.height);
  tintCtx.globalCompositeOperation = "destination-in";
  tintCtx.drawImage(maskSource, 0, 0, plate.width, plate.height);

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(tint, 0, 0);
  ctx.restore();
}

export async function warpPrintOntoRegion(
  ctx: any,
  print: PrintArt,
  region: PlateRegion,
  adapter: CompositeAdapter,
): Promise<void> {
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const bounds = region.bounds ?? boundsFromMesh(region.warpMesh, canvasWidth, canvasHeight);
  const localWidth = Math.max(1, Math.round(bounds.width));
  const localHeight = Math.max(1, Math.round(bounds.height));
  const printImage = await adapter.loadImage(print.assetUrl);
  const local = adapter.createCanvas(localWidth, localHeight);
  const localCtx = local.getContext("2d", { willReadFrequently: true });

  localCtx.imageSmoothingEnabled = true;
  localCtx.imageSmoothingQuality = "high";
  localCtx.translate(print.x * localWidth, print.y * localHeight);
  localCtx.rotate((print.rotation * Math.PI) / 180);

  const drawWidth = localWidth * print.scale;
  const drawHeight = drawWidth * (printImage.height / printImage.width);
  localCtx.drawImage(printImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

  if (region.displacementMapUrl) {
    await applyDisplacement(local, region.displacementMapUrl, bounds, adapter);
  }

  const warped = adapter.createCanvas(canvasWidth, canvasHeight);
  const warpedCtx = warped.getContext("2d", { willReadFrequently: true });
  warpedCtx.imageSmoothingEnabled = true;
  warpedCtx.imageSmoothingQuality = "high";
  drawWarpedCanvas(warpedCtx, local, region, bounds, canvasWidth, canvasHeight);

  if (region.shadowMapUrl) {
    await multiplyCanvasByMap(warped, region.shadowMapUrl, adapter);
  }

  ctx.drawImage(warped, 0, 0);
}

export async function applyLighting(ctx: any, preset: LightingPreset): Promise<void> {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const center = ctx.createRadialGradient(width * 0.52, height * 0.42, width * 0.1, width / 2, height / 2, width * 0.72);
  const side = ctx.createLinearGradient(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";

  if (preset === "softStudio") {
    center.addColorStop(0, "rgba(255,255,255,0.16)");
    center.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = center;
    ctx.fillRect(0, 0, width, height);
  }

  if (preset === "dramatic") {
    side.addColorStop(0, "rgba(255,255,255,0.12)");
    side.addColorStop(0.52, "rgba(0,0,0,0)");
    side.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, width, height);
  }

  if (preset === "highContrast") {
    center.addColorStop(0, "rgba(255,255,255,0.22)");
    center.addColorStop(0.64, "rgba(0,0,0,0)");
    center.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = center;
    ctx.fillRect(0, 0, width, height);
  }

  if (preset === "ecommerce") {
    center.addColorStop(0, "rgba(255,255,255,0.08)");
    center.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = center;
    ctx.fillRect(0, 0, width, height);
  }

  if (preset === "cinematic") {
    side.addColorStop(0, "rgba(26,62,87,0.18)");
    side.addColorStop(0.5, "rgba(255,255,255,0)");
    side.addColorStop(1, "rgba(173,105,52,0.18)");
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

function drawImageCover(ctx: any, image: ImageLike, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function boundsFromMesh(mesh: number[][], canvasWidth: number, canvasHeight: number) {
  const points = mesh.map(([x, y]) => normalizePoint({ x, y }, canvasWidth, canvasHeight));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

function normalizePoint(point: Point, canvasWidth: number, canvasHeight: number): Point {
  return {
    x: point.x <= 1 ? point.x * canvasWidth : point.x,
    y: point.y <= 1 ? point.y * canvasHeight : point.y,
  };
}

async function applyDisplacement(
  canvas: CanvasLike,
  mapUrl: string,
  bounds: { x: number; y: number; width: number; height: number },
  adapter: CompositeAdapter,
) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const map = await adapter.loadImage(mapUrl);
  const mapCanvas = adapter.createCanvas(canvas.width, canvas.height);
  const mapCtx = mapCanvas.getContext("2d", { willReadFrequently: true });
  mapCtx.drawImage(map, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, canvas.width, canvas.height);

  const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mapData = mapCtx.getImageData(0, 0, canvas.width, canvas.height);
  const displaced = ctx.createImageData(canvas.width, canvas.height);
  const maxShift = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) * 0.018));

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4;
      if (source.data[i + 3] === 0) continue;

      const dx = Math.round(((mapData.data[i] - 128) / 128) * maxShift);
      const dy = Math.round(((mapData.data[i + 1] - 128) / 128) * maxShift * 0.55);
      const tx = clamp(x + dx, 0, canvas.width - 1);
      const ty = clamp(y + dy, 0, canvas.height - 1);
      const target = (ty * canvas.width + tx) * 4;

      if (source.data[i + 3] >= displaced.data[target + 3]) {
        displaced.data[target] = source.data[i];
        displaced.data[target + 1] = source.data[i + 1];
        displaced.data[target + 2] = source.data[i + 2];
        displaced.data[target + 3] = source.data[i + 3];
      }
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(displaced, 0, 0);
}

function drawWarpedCanvas(
  ctx: any,
  source: CanvasLike,
  region: PlateRegion,
  bounds: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
) {
  const mesh = region.warpMesh.length >= 4 ? region.warpMesh : [
    [bounds.x, bounds.y],
    [bounds.x + bounds.width, bounds.y],
    [bounds.x + bounds.width, bounds.y + bounds.height],
    [bounds.x, bounds.y + bounds.height],
  ];

  const [topLeft, topRight, bottomRight, bottomLeft] = mesh
    .slice(0, 4)
    .map(([x, y]) => normalizePoint({ x, y }, canvasWidth, canvasHeight));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(
    (topRight.x - topLeft.x) / source.width,
    (topRight.y - topLeft.y) / source.width,
    (bottomLeft.x - topLeft.x) / source.height,
    (bottomLeft.y - topLeft.y) / source.height,
    topLeft.x,
    topLeft.y,
  );
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}

function bilinear(tl: Point, tr: Point, br: Point, bl: Point, u: number, v: number): Point {
  const top = lerpPoint(tl, tr, u);
  const bottom = lerpPoint(bl, br, u);
  return lerpPoint(top, bottom, v);
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function drawTexturedTriangle(
  ctx: any,
  image: CanvasLike,
  s0: Point,
  s1: Point,
  s2: Point,
  d0: Point,
  d1: Point,
  d2: Point,
) {
  const denom = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denom) < 0.00001) return;

  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denom;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denom;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denom;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denom;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denom;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denom;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

async function multiplyCanvasByMap(canvas: CanvasLike, mapUrl: string, adapter: CompositeAdapter) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const map = await adapter.loadImage(mapUrl);
  const mapCanvas = adapter.createCanvas(canvas.width, canvas.height);
  const mapCtx = mapCanvas.getContext("2d", { willReadFrequently: true });
  mapCtx.drawImage(map, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mapData = mapCtx.getImageData(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < imageData.data.length; i += 4) {
    if (imageData.data[i + 3] === 0) continue;
    imageData.data[i] = Math.round((imageData.data[i] * mapData.data[i]) / 255);
    imageData.data[i + 1] = Math.round((imageData.data[i + 1] * mapData.data[i + 1]) / 255);
    imageData.data[i + 2] = Math.round((imageData.data[i + 2] * mapData.data[i + 2]) / 255);
  }

  ctx.putImageData(imageData, 0, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
