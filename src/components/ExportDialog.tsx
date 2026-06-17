"use client";

import { useState } from "react";
import { useStudio } from "@/lib/store";
import { findPlate } from "@/lib/composite/plates";
import { renderScene } from "@/lib/composite/engine";
import { designWithCustomPrint } from "@/lib/design";
import type { ExportAsset, GarmentDesign, MannequinPlate, Scene } from "@/lib/types";

export default function ExportDialog({
  product,
  plates,
}: {
  product: GarmentDesign;
  plates: MannequinPlate[];
}) {
  const scene = useStudio();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ExportAsset | null>(null);

  const scenePayload: Scene = {
    productId: product.id,
    modelType: scene.modelType,
    fitStyle: scene.fitStyle,
    view: scene.view,
    background: scene.background,
    customBackgroundUrl: scene.customBackgroundUrl,
    lighting: scene.lighting,
  };

  async function exportAssets() {
    setBusy(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scenePayload, customPrint: scene.customPrint }),
      });
      const data = await res.json();
      setLast(data.assets?.[0] ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function downloadTransparentPng() {
    const plate = findPlate(plates, product.type, scene.view, scene.fitStyle, scene.modelType);
    if (!plate) return;

    const design = designWithCustomPrint(product, scene.view, scene.customPrint);
    const render = await renderScene({ ...scenePayload, background: "transparent" }, design, plate);
    const link = document.createElement("a");
    link.href = render.dataUrl;
    link.download = `${product.id}-${scene.view}-transparent.png`;
    link.click();
  }

  return (
    <div className="flex items-center gap-3">
      {last && (
        <a href={last.url} className="text-xs text-neutral-400 underline-offset-4 hover:underline">
          Exported: {last.filename ?? last.url}
        </a>
      )}
      <button
        onClick={downloadTransparentPng}
        className="rounded border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:border-neutral-500"
      >
        Transparent PNG
      </button>
      <button
        onClick={exportAssets}
        disabled={busy}
        className="rounded bg-white px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {busy ? "Exporting…" : "Export"}
      </button>
    </div>
  );
}
