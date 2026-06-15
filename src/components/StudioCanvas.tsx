"use client";

import { useEffect, useRef } from "react";
import { useStudio } from "@/lib/store";
import { mockProducts } from "@/lib/mock-data";
import { findPlate } from "@/lib/composite/plates";
import { renderScene } from "@/lib/composite/engine";

export default function StudioCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useStudio();

  useEffect(() => {
    const product = mockProducts.find((p) => p.id === scene.productId);
    const plate = findPlate(product?.type ?? "tshirt", scene.view, scene.fitStyle);
    if (!product || !plate || !ref.current) return;

    let cancelled = false;
    renderScene(scene, product, plate)
      .then((res) => {
        if (cancelled || !ref.current) return;
        ref.current.width = res.canvas.width;
        ref.current.height = res.canvas.height;
        ref.current.getContext("2d")?.drawImage(res.canvas, 0, 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [scene]);

  return (
    <div className="relative flex aspect-square w-full max-w-[520px] items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-950">
      <canvas ref={ref} className="max-h-full max-w-full" />
      <p className="pointer-events-none absolute px-6 text-center text-sm text-neutral-500">
        Composite engine is stubbed — implement <code>renderScene()</code> and add plate
        assets to <code>/public/plates</code> to see the mockup.
      </p>
    </div>
  );
}
