"use client";

import clsx from "clsx";
import { useStudio } from "@/lib/store";
import type { ModelType, FitStyle, View, BackgroundType, LightingPreset } from "@/lib/types";

const models: ModelType[] = ["neutralMannequin", "ghostMannequin", "croppedProductOnly", "facelessMannequin"];
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

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-neutral-400">
        <span>{label}</span>
        <span>{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="w-full accent-white"
      />
    </label>
  );
}

export default function ControlRail() {
  const s = useStudio();

  function readImage(file: File | undefined, onLoad: (dataUrl: string) => void) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onLoad(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <aside className="w-72 shrink-0 space-y-5 overflow-y-auto border-l border-neutral-800 p-4">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Your Artwork</div>
        <label className="block">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(event) => readImage(event.currentTarget.files?.[0], s.setCustomPrintUrl)}
            className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black"
          />
        </label>
        {s.customPrint?.assetUrl ? (
          <div className="mt-3 space-y-3">
            <Slider label="Size" value={s.customPrint.scale} min={0.05} max={1.5} step={0.01}
              onChange={(v) => s.updateCustomPrint({ scale: v })} />
            <Slider label="Horizontal" value={s.customPrint.x} min={0} max={1} step={0.01}
              onChange={(v) => s.updateCustomPrint({ x: v })} />
            <Slider label="Vertical" value={s.customPrint.y} min={0} max={1} step={0.01}
              onChange={(v) => s.updateCustomPrint({ y: v })} />
            <Slider label="Rotation" value={s.customPrint.rotation} min={-180} max={180} step={1}
              format={(v) => `${Math.round(v)}°`} onChange={(v) => s.updateCustomPrint({ rotation: v })} />
            <button
              onClick={s.clearCustomPrint}
              className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-500"
            >
              Remove artwork
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-neutral-500">
            Upload a print and it&rsquo;s composited onto the {s.view} of the garment, pixel-exact.
          </p>
        )}
      </div>

      <Group label="Mannequin" options={models} value={s.modelType} onChange={s.setModelType} />
      <Group label="Fit" options={fits} value={s.fitStyle} onChange={s.setFit} />
      <Group label="View" options={views} value={s.view} onChange={s.setView} />
      <Group label="Background" options={backgrounds} value={s.background} onChange={s.setBackground} />
      {s.background === "custom" && (
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Backdrop Image
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) =>
              readImage(event.currentTarget.files?.[0], (url) => {
                s.setCustomBackgroundUrl(url);
                s.setBackground("custom");
              })
            }
            className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black"
          />
        </label>
      )}
      <Group label="Lighting" options={lightings} value={s.lighting} onChange={s.setLighting} />
    </aside>
  );
}
