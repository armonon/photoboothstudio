"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

const TeeViewer = dynamic(() => import("@/components/TeeViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-[3/2] w-full items-center justify-center rounded-xl border border-neutral-800 text-sm text-neutral-500">
      Loading 3D viewer…
    </div>
  ),
});

const COLORS: { hex: string; label: string; textDark: boolean }[] = [
  { hex: "#f0f0ee", label: "White",       textDark: true  },
  { hex: "#1a1a1a", label: "Black",       textDark: false },
  { hex: "#1e3a5f", label: "Navy",        textDark: false },
  { hex: "#8b1a1a", label: "Red",         textDark: false },
  { hex: "#2d5a27", label: "Forest",      textDark: false },
  { hex: "#c8a96e", label: "Sand",        textDark: true  },
  { hex: "#4a3728", label: "Espresso",    textDark: false },
  { hex: "#6b3fa0", label: "Purple",      textDark: false },
];

export default function TeePage() {
  const [color, setColor] = useState(COLORS[0].hex);
  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [designName, setDesignName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load design from sessionStorage (set by Enhancer "Preview in 3D" button)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("tee-design");
      if (stored) {
        setDesignUrl(stored);
        setDesignName("from Studio");
        sessionStorage.removeItem("tee-design");
      }
    } catch {
      // sessionStorage unavailable (private mode etc.)
    }
  }, []);

  function handleFile(file: File) {
    const url = URL.createObjectURL(file);
    if (designUrl && !designUrl.startsWith("data:")) URL.revokeObjectURL(designUrl);
    setDesignUrl(url);
    setDesignName(file.name);
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">3D tee preview</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Drag to rotate · scroll to zoom · upload a design to see it on the shirt
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
        {/* Viewer */}
        <TeeViewer color={color} designUrl={designUrl} />

        {/* Controls */}
        <div className="space-y-6">
          {/* Color */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Shirt colour
            </p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                  style={{ background: c.hex }}
                  className={clsx(
                    "h-8 w-8 rounded-full transition-transform hover:scale-110",
                    color === c.hex ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-950" : "",
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              {COLORS.find((c) => c.hex === color)?.label ?? "Custom"}
            </p>
          </div>

          {/* Design upload */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Design / graphic
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-neutral-700 px-4 py-3 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
            >
              {designName ? `✓ ${designName}` : "Upload image or PNG cutout"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f) handleFile(f);
                e.currentTarget.value = "";
              }}
            />
            {designUrl && (
              <button
                onClick={() => {
                  if (!designUrl.startsWith("data:")) URL.revokeObjectURL(designUrl);
                  setDesignUrl(null);
                  setDesignName(null);
                }}
                className="mt-1.5 text-xs text-neutral-500 hover:text-neutral-300"
              >
                Remove design
              </button>
            )}
          </div>

          {/* Hint */}
          <p className="text-xs text-neutral-600">
            Transparent PNGs from the Studio tab show only the design — no background.
          </p>

          {/* Back to studio */}
          <a
            href="/"
            className="block rounded border border-neutral-700 px-4 py-2 text-center text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
          >
            ← Back to Studio
          </a>
        </div>
      </div>
    </main>
  );
}
