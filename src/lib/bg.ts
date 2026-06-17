import type { ImageSource } from "@imgly/background-removal";

export type FreeBackground = "transparent" | "white" | "softGrey";

const BG_FILL: Record<Exclude<FreeBackground, "transparent">, string> = {
  white: "#ffffff",
  softGrey: "#ececec",
};

/**
 * Remove the background locally in the browser (free, no API, no per-image cost).
 * The model assets download once on first call and are cached after. Returns a
 * transparent PNG blob.
 */
export async function removeBackgroundLocal(input: ImageSource): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  return removeBackground(input);
}

/** Flatten a transparent cutout onto a solid color (or keep it transparent). */
export async function compositeOnBackground(cutout: Blob, background: FreeBackground): Promise<Blob> {
  const bitmap = await createImageBitmap(cutout);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    if (background !== "transparent") {
      ctx.fillStyle = BG_FILL[background];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode image"))),
        "image/png",
      ),
    );
  } finally {
    bitmap.close();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image data"));
    reader.readAsDataURL(blob);
  });
}
