"use client";

import clsx from "clsx";
import { useStudio } from "@/lib/store";
import type { ModelType, FitStyle, View, BackgroundType, LightingPreset } from "@/lib/types";

const models: ModelType[] = ["neutralMannequin", "croppedProductOnly", "facelessMannequin"];
const fits: FitStyle[] = ["regular", "oversized", "cropped", "relaxed", "boxy", "streetwear"];
const views: View[] = ["front", "back", "side"];
const backgrounds: BackgroundType[] = ["transparent", "white", "dark", "editorial", "concrete", "luxury", "custom"];
const lightings: LightingPreset[] = ["softStudio", "dramatic", "highContrast", "ecommerce", "cinematic"];

function Group<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={clsx(
              "rounded border px-2.5 py-1 text-sm",
              value === o
                ? "border-white bg-white text-black"
                : "border-neutral-700 text-neutral-300 hover:border-neutral-500",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ControlRail() {
  const s = useStudio();
  return (
    <aside className="w-72 shrink-0 space-y-5 overflow-y-auto border-l border-neutral-800 p-4">
      <Group label="Mannequin" options={models} value={s.modelType} onChange={s.setModelType} />
      <Group label="Fit" options={fits} value={s.fitStyle} onChange={s.setFit} />
      <Group label="View" options={views} value={s.view} onChange={s.setView} />
      <Group label="Background" options={backgrounds} value={s.background} onChange={s.setBackground} />
      <Group label="Lighting" options={lightings} value={s.lighting} onChange={s.setLighting} />
    </aside>
  );
}
