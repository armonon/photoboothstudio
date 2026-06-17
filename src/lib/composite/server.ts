import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "node:path";
import { renderComposite, type CanvasLike, type CompositeAdapter } from "@/lib/composite/core";
import type { GarmentDesign, MannequinPlate, Scene } from "@/lib/types";

function resolveImageSource(src: string) {
  if (/^(https?:|data:|file:)/.test(src)) return src;
  if (src.startsWith("/")) return path.join(process.cwd(), "public", src.slice(1));
  return src;
}

export function nodeCanvasAdapter(): CompositeAdapter {
  return {
    createCanvas(width, height) {
      return createCanvas(width, height) as unknown as CanvasLike;
    },
    async loadImage(src) {
      // Uploaded artwork arrives as a base64 data: URL; @napi-rs/canvas loads it
      // from a Buffer rather than a path/URL.
      if (src.startsWith("data:")) {
        const buffer = Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
        return loadImage(buffer) as Promise<any>;
      }
      return loadImage(resolveImageSource(src)) as Promise<any>;
    },
  };
}

export async function renderSceneToCanvas(scene: Scene, design: GarmentDesign, plate: MannequinPlate) {
  return renderComposite(scene, design, plate, nodeCanvasAdapter());
}

export async function renderSceneToPngBuffer(scene: Scene, design: GarmentDesign, plate: MannequinPlate) {
  const canvas = await renderSceneToCanvas(scene, design, plate);
  return canvas.toBuffer ? canvas.toBuffer("image/png") : Buffer.from("");
}
