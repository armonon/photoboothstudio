"use client";

import { useState } from "react";
import { useStudio } from "@/lib/store";

export default function ExportDialog() {
  const scene = useStudio();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  async function exportAssets() {
    setBusy(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scene),
      });
      const data = await res.json();
      setLast(data.assets?.[0]?.url ?? "done");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {last && <span className="text-xs text-neutral-400">Exported: {last}</span>}
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
