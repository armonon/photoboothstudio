"use client";

import clsx from "clsx";
import { useRef, useState } from "react";
import { runPool } from "@/lib/pool";
import { compositeOnBackground, removeBackgroundLocal, type FreeBackground } from "@/lib/bg";
import { studioEnhance, type EnhanceFraming } from "@/lib/enhance";
import { downloadBlob, zipImages } from "@/lib/zip";

const FREE_CONCURRENCY = 1; // local model inference — run one at a time

type Mode = "free" | "studio";

const freeBackgrounds: { value: FreeBackground; label: string }[] = [
  { value: "white", label: "White" },
  { value: "softGrey", label: "Soft grey" },
  { value: "transparent", label: "Transparent" },
];

const framings: { value: EnhanceFraming; label: string }[] = [
  { value: "keep", label: "As shot" },
  { value: "square", label: "Centered square" },
];

type Status = "queued" | "working" | "done" | "error";

interface ResultFile {
  suffix: string; // "" for the primary, "-transparent" for the cutout
  blob: Blob;
  url: string;
}

interface Item {
  id: string;
  order: number;
  name: string;
  file: File;
  preview: string;
  status: Status;
  results?: ResultFile[];
  error?: string;
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, "");

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded border px-3 py-1.5 text-sm",
            value === o.value
              ? "border-white bg-white text-black"
              : "border-neutral-700 text-neutral-300 hover:border-neutral-500",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const statusBadge: Record<Status, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-neutral-800 text-neutral-300" },
  working: { label: "Working…", className: "bg-amber-500/20 text-amber-300" },
  done: { label: "Done", className: "bg-emerald-500/20 text-emerald-300" },
  error: { label: "Failed", className: "bg-red-500/20 text-red-300" },
};

export default function Enhancer() {
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<Mode>("free");
  const [freeBg, setFreeBg] = useState<FreeBackground>("white");
  const [alsoTransparent, setAlsoTransparent] = useState(false);
  const [framing, setFraming] = useState<EnhanceFraming>("keep");
  const [autoColor, setAutoColor] = useState(true);
  const [shadow, setShadow] = useState(true);
  const [running, setRunning] = useState(false);
  const [zipping, setZipping] = useState(false);
  const orderRef = useRef(0);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: Item[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      order: orderRef.current++,
      name: file.name,
      file,
      preview: URL.createObjectURL(file),
      status: "queued" as Status,
    }));
    setItems((prev) => [...prev, ...next]);
  }

  function patch(id: string, partial: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...partial } : it)));
  }

  function clearAll() {
    items.forEach((it) => {
      URL.revokeObjectURL(it.preview);
      it.results?.forEach((r) => URL.revokeObjectURL(r.url));
    });
    setItems([]);
  }

  async function run() {
    const pending = items.filter((it) => it.status === "queued" || it.status === "error");
    if (!pending.length || running) return;
    setRunning(true);
    setItems((prev) =>
      prev.map((it) => (pending.some((p) => p.id === it.id) ? { ...it, status: "working", error: undefined } : it)),
    );
    await runPool(pending, FREE_CONCURRENCY, async (it) => {
      try {
        const results: ResultFile[] = [];
        const cutout = await removeBackgroundLocal(it.file);
        if (mode === "free") {
          const primary = await compositeOnBackground(cutout, freeBg);
          results.push({ suffix: freeBg === "transparent" ? "-transparent" : "", blob: primary, url: URL.createObjectURL(primary) });
          if (alsoTransparent && freeBg !== "transparent") {
            const transparent = await compositeOnBackground(cutout, "transparent");
            results.push({ suffix: "-transparent", blob: transparent, url: URL.createObjectURL(transparent) });
          }
        } else {
          const primary = await studioEnhance(cutout, { background: freeBg, autoColor, shadow, framing });
          results.push({ suffix: freeBg === "transparent" ? "-transparent" : "", blob: primary, url: URL.createObjectURL(primary) });
          if (alsoTransparent && freeBg !== "transparent") {
            const transparent = await studioEnhance(cutout, { background: "transparent", autoColor, shadow: false, framing });
            results.push({ suffix: "-transparent", blob: transparent, url: URL.createObjectURL(transparent) });
          }
        }
        patch(it.id, { status: "done", results });
      } catch (err) {
        patch(it.id, { status: "error", error: err instanceof Error ? err.message : "Failed" });
      }
    });

    setRunning(false);
  }

  async function downloadAll() {
    const files: { name: string; blob: Blob }[] = [];
    for (const it of items) {
      if (it.status !== "done" || !it.results) continue;
      const base = `${String(it.order).padStart(3, "0")}-${baseName(it.name)}`;
      for (const r of it.results) files.push({ name: `${base}${r.suffix || "-mockup"}.png`, blob: r.blob });
    }
    if (!files.length) return;
    setZipping(true);
    try {
      downloadBlob(await zipImages(files), "mockups.zip");
    } finally {
      setZipping(false);
    }
  }

  const done = items.filter((it) => it.status === "done").length;
  const failed = items.filter((it) => it.status === "error").length;
  const pending = items.filter((it) => it.status === "queued" || it.status === "error").length;
  const fileCount = items.reduce((n, it) => n + (it.status === "done" ? it.results?.length ?? 0 : 0), 0);
  const runCount = pending || items.length;

  return (
    <div className="space-y-5">
      {/* Mode */}
      <div className="inline-flex rounded-lg border border-neutral-800 p-1">
        {(["free", "studio"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm",
              mode === m ? "bg-white text-black" : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            {m === "free" ? "Remove background · free" : "Studio enhance · free"}
          </button>
        ))}
      </div>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900 px-6 py-10 text-center hover:border-neutral-500"
      >
        <span className="text-sm text-neutral-300">Drop garment photos here, or click to choose</span>
        <span className="mt-1 text-xs text-neutral-600">Add as many as you like — PNG, JPG or WEBP</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
        />
      </label>

      {/* Controls */}
      <div className="space-y-4 rounded-lg border border-neutral-800 p-4">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Background</div>
          <Choice options={freeBackgrounds} value={freeBg} onChange={setFreeBg} />
        </div>

        {mode === "studio" && (
          <>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Framing</div>
              <Choice options={framings} value={framing} onChange={setFraming} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={autoColor}
                  onChange={(e) => setAutoColor(e.currentTarget.checked)}
                  className="h-4 w-4 accent-white"
                />
                Auto color &amp; lighting
              </label>
              <label
                className={clsx(
                  "flex items-center gap-2 text-sm",
                  freeBg === "transparent" ? "text-neutral-600" : "text-neutral-300",
                )}
              >
                <input
                  type="checkbox"
                  checked={shadow && freeBg !== "transparent"}
                  disabled={freeBg === "transparent"}
                  onChange={(e) => setShadow(e.currentTarget.checked)}
                  className="h-4 w-4 accent-white"
                />
                Contact shadow
              </label>
            </div>
          </>
        )}

        {freeBg !== "transparent" && (
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={alsoTransparent}
              onChange={(e) => setAlsoTransparent(e.currentTarget.checked)}
              className="h-4 w-4 accent-white"
            />
            Also export a transparent PNG of each
          </label>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!pending || running}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            {running
              ? mode === "free"
                ? "Removing backgrounds…"
                : "Building mockups…"
              : mode === "free"
                ? `Remove ${runCount} background${runCount === 1 ? "" : "s"} · free`
                : `Enhance ${runCount} photo${runCount === 1 ? "" : "s"} · free`}
          </button>
          {fileCount > 0 && (
            <button
              type="button"
              onClick={downloadAll}
              disabled={zipping || running}
              className="rounded border border-neutral-600 px-3 py-2 text-sm font-medium text-neutral-100 hover:border-neutral-400 disabled:opacity-40"
            >
              {zipping ? "Zipping…" : `Download all (${fileCount}) as ZIP`}
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              disabled={running}
              className="text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-40"
            >
              Clear
            </button>
          )}
          {items.length > 0 && (
            <span className="text-sm text-neutral-400">
              {done}/{items.length} done{failed ? ` · ${failed} failed` : ""}
            </span>
          )}
        </div>

        <p className="text-xs text-neutral-600">
          {mode === "free"
            ? "Runs locally in your browser — free, no credits, nothing uploaded. The first photo downloads a small one-time model."
            : "Removes the background, then auto-corrects color & lighting and adds a soft contact shadow — all locally, no credits, nothing uploaded."}
        </p>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((it) => {
            const primary = it.status === "done" ? it.results?.[0] : undefined;
            return (
              <div key={it.id} className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                <div
                  className="relative flex aspect-square items-center justify-center bg-neutral-900"
                  style={
                    primary
                      ? {
                          backgroundImage:
                            "linear-gradient(45deg,#2a2a2a 25%,transparent 25%),linear-gradient(-45deg,#2a2a2a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2a 75%),linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)",
                          backgroundSize: "16px 16px",
                          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
                        }
                      : undefined
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={primary ? primary.url : it.preview}
                    alt={it.name}
                    className={clsx("h-full w-full object-contain", it.status === "working" && "opacity-40")}
                  />
                  <span
                    className={clsx(
                      "absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      statusBadge[it.status].className,
                    )}
                  >
                    {statusBadge[it.status].label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="truncate text-[11px] text-neutral-400" title={it.error ?? it.name}>
                    {it.status === "error" ? it.error : it.name}
                  </span>
                  {primary && (
                    <span className="flex shrink-0 gap-2">
                      {it.results!.map((r) => (
                        <a
                          key={r.suffix}
                          href={r.url}
                          download={`${baseName(it.name)}${r.suffix || "-mockup"}.png`}
                          className="text-[11px] text-neutral-300 underline-offset-2 hover:underline"
                        >
                          {r.suffix === "-transparent" ? "Transparent" : "Save"}
                        </a>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
