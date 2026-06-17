"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/store";
import { findPlate } from "@/lib/composite/plates";
import { renderScene } from "@/lib/composite/engine";
import { designWithCustomPrint } from "@/lib/design";
import type { GarmentDesign, MannequinPlate } from "@/lib/types";

export default function StudioCanvas({
  product,
  plates,
}: {
  product: GarmentDesign;
  plates: MannequinPlate[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useStudio();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const plate = findPlate(plates, product.type, scene.view, scene.fitStyle, scene.modelType);
    if (!product || !plate || !ref.current) return;

    const design = designWithCustomPrint(product, scene.view, scene.customPrint);
    let cancelled = false;
    setMessage(null);
    renderScene(scene, design, plate)
      .then((res) => {
        if (cancelled || !ref.current) return;
        ref.current.width = res.canvas.width;
        ref.current.height = res.canvas.height;
        ref.current.getContext("2d")?.drawImage(res.canvas, 0, 0);
      })
      .catch(() => {
        if (!cancelled) setMessage("Unable to render this plate.");
      });
    return () => {
      cancelled = true;
    };
  }, [scene, product, plates]);

  return (
    <div className="relative flex aspect-square w-full max-w-[620px] items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <canvas ref={ref} className="max-h-full max-w-full" />
      {message && (
        <p className="pointer-events-none absolute px-6 text-center text-sm text-neutral-400">
          {message}
        </p>
      )}
    </div>
  );
}
