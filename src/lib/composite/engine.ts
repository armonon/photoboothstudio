import {
  applyLighting,
  compositeBackground,
  drawRecoloredGarment,
  renderComposite,
  warpPrintOntoRegion,
  type CompositeAdapter,
} from "@/lib/composite/core";
import type { GarmentDesign, MannequinPlate, Scene } from "@/lib/types";

export interface RenderResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
}

/**
 * Deterministic 2.5D composite pipeline. No AI, no 3D. Pixel-exact prints.
 *
 * Order: background -> recolored blank garment -> warped prints -> lighting overlay.
 */
export async function renderScene(
  scene: Scene,
  design: GarmentDesign,
  plate: MannequinPlate,
): Promise<RenderResult> {
  const canvas = (await renderComposite(scene, design, plate, browserAdapter())) as HTMLCanvasElement;
  return { canvas, dataUrl: canvas.toDataURL("image/png") };
}

function browserAdapter(): CompositeAdapter {
  return {
    createCanvas(width, height) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    loadImage(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
        image.src = src;
      });
    },
  };
}

export { applyLighting, compositeBackground, drawRecoloredGarment, warpPrintOntoRegion };
