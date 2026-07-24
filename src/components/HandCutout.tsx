"use client";

import { useState } from "react";
import MaskEditor from "@/components/MaskEditor";

// The Studio tab: a from-scratch, by-hand cutout workspace. Open a photo and the mask
// editor opens on the whole image — cut the subject out yourself (brush / magic wand /
// lasso), then download the transparent PNG. No auto-removal, no model, no waiting.

interface Cut {
  id: string;
  name: string;
  file: File; // the original image
  cutout: Blob; // transparent PNG
  url: string;
}

const baseName = (n: string) => n.replace(/\.[^.]+$/, "");

export default function HandCutout() {
  const [newFile, setNewFile] = useState<File | null>(null); // a fresh image to cut from scratch
  const [editing, setEditing] = useState<Cut | null>(null); // re-opening a saved cut
  const [cuts, setCuts] = useState<Cut[]>([]);

  function download(c: Cut) {
    const a = document.createElement("a");
    a.href = c.url;
    a.download = `${baseName(c.name)}-cutout.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function saveNew(file: File, cutout: Blob) {
    setCuts((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: file.name, file, cutout, url: URL.createObjectURL(cutout) },
    ]);
    setNewFile(null);
  }

  function saveEdit(c: Cut, cutout: Blob) {
    setCuts((prev) =>
      prev.map((x) => {
        if (x.id !== c.id) return x;
        URL.revokeObjectURL(x.url);
        return { ...x, cutout, url: URL.createObjectURL(cutout) };
      }),
    );
    setEditing(null);
  }

  return (
    <div className="space-y-5">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) setNewFile(f);
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900 px-6 py-12 text-center hover:border-neutral-500"
      >
        <svg viewBox="0 0 16 16" className="mb-2 h-6 w-6 text-sky-300" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <span className="text-sm text-neutral-200">Open a photo to cut out by hand</span>
        <span className="mt-1 text-xs text-neutral-600">Drop an image, or click to choose — PNG, JPG or WEBP</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) setNewFile(f);
            e.currentTarget.value = "";
          }}
        />
      </label>

      {cuts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {cuts.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
              <div
                className="flex aspect-square items-center justify-center"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg,#2a2a2a 25%,transparent 25%),linear-gradient(-45deg,#2a2a2a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2a 75%),linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.url} alt={c.name} className="h-full w-full object-contain" />
              </div>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="text-[11px] text-sky-300 underline-offset-2 hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => download(c)}
                  className="text-[11px] text-neutral-300 underline-offset-2 hover:underline"
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {newFile && (
        <MaskEditor original={newFile} onSave={(b) => saveNew(newFile, b)} onClose={() => setNewFile(null)} />
      )}
      {editing && (
        <MaskEditor
          original={editing.file}
          cutout={editing.cutout}
          onSave={(b) => saveEdit(editing, b)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
