"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applySelection,
  fillPolygon,
  growShrink,
  magicWandSelect,
  smoothAlpha,
  strokeSegment,
  type MaskValue,
} from "@/lib/mask-edit";

// Studio = a layered, by-hand cutout compositor. Drop/import several images — each
// becomes a layer — arrange and cut them out, then export the flattened PNG. The
// cutout tools are the SWEET-ported mask ops in mask-edit.ts, applied per active layer.

const LAYER_MAX = 1600; // cap a layer's native pixel size for responsiveness
const UNDO_LIMIT = 20;

type Tool = "move" | "brush" | "wand" | "lasso";
type Paint = "keep" | "remove";

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0..1
  x: number; // top-left in document space
  y: number;
  w: number; // native pixel size
  h: number;
  rgba: Uint8ClampedArray; // w*h*4, original pixels (for the magic wand)
  alpha: Uint8Array; // w*h mask
  cvs: HTMLCanvasElement; // offscreen w*h, rgba masked by alpha (what we draw)
  thumb: string; // dataURL for the panel
}

function make2d(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })!] as const;
}

function bake(l: Layer) {
  const img = new ImageData(l.w, l.h);
  const d = img.data;
  for (let p = 0, q = 0; p < l.alpha.length; p++, q += 4) {
    d[q] = l.rgba[q];
    d[q + 1] = l.rgba[q + 1];
    d[q + 2] = l.rgba[q + 2];
    d[q + 3] = l.alpha[p];
  }
  l.cvs.getContext("2d")!.putImageData(img, 0, 0);
}

function makeThumb(l: Layer): string {
  const s = 64;
  const scale = Math.min(s / l.w, s / l.h);
  const [c, ctx] = make2d(Math.max(1, Math.round(l.w * scale)), Math.max(1, Math.round(l.h * scale)));
  ctx.drawImage(l.cvs, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

export default function LayeredStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const layers = useRef<Layer[]>([]); // bottom → top
  const doc = useRef({ w: 0, h: 0 });
  const view = useRef({ zoom: 1, panX: 0, panY: 0 });
  const ptr = useRef({ down: false, mode: "" as "" | "pan" | "drag" | "paint", lx: 0, ly: 0, dragId: "" });
  const lasso = useRef<{ x: number; y: number }[]>([]);
  const undo = useRef<{ id: string; alpha: Uint8Array }[]>([]);
  const raf = useRef(0);
  const didFit = useRef(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("move");
  const [paint, setPaint] = useState<Paint>("remove");
  const [brush, setBrush] = useState(48);
  const [hardness, setHardness] = useState(0.7);
  const [tolerance, setTolerance] = useState(0.15);
  const [contiguous, setContiguous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const active = () => layers.current.find((l) => l.id === activeId) || null;

  const scheduleDraw = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      draw();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- import ----
  async function addImages(files: FileList | File[] | null) {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(true);
    try {
      for (const file of list) {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, LAYER_MAX / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const [, tctx] = make2d(w, h);
        tctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();
        const rgba = tctx.getImageData(0, 0, w, h).data;
        if (!doc.current.w) doc.current = { w, h };
        const [cvs] = make2d(w, h);
        const layer: Layer = {
          id: crypto.randomUUID(),
          name: file.name,
          visible: true,
          opacity: 1,
          x: Math.round((doc.current.w - w) / 2),
          y: Math.round((doc.current.h - h) / 2),
          w,
          h,
          rgba,
          alpha: new Uint8Array(w * h).fill(255),
          cvs,
          thumb: "",
        };
        bake(layer);
        layer.thumb = makeThumb(layer);
        layers.current.push(layer);
        setActiveId(layer.id);
      }
      if (!didFit.current) fitView();
      rerender();
      scheduleDraw();
    } finally {
      setBusy(false);
    }
  }

  function fitView() {
    const wrap = wrapRef.current;
    const { w, h } = doc.current;
    if (!wrap || !w) return;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (!cw || !ch) return;
    const zoom = Math.min(cw / w, ch / h) * 0.9;
    view.current = { zoom, panX: (cw - w * zoom) / 2, panY: (ch - h * zoom) / 2 };
    didFit.current = true;
  }

  // keep the canvas sized to its container
  useEffect(() => {
    const wrap = wrapRef.current!;
    const sync = () => {
      const cv = canvasRef.current;
      const cw = wrap.clientWidth;
      const ch = wrap.clientHeight;
      if (!cv || !cw || !ch) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
      cv.style.width = cw + "px";
      cv.style.height = ch + "px";
      if (!didFit.current && doc.current.w) fitView();
      scheduleDraw();
    };
    const ro = new ResizeObserver(sync);
    ro.observe(wrap);
    sync();
    return () => ro.disconnect();
  }, [scheduleDraw]);

  // ---- render ----
  function draw() {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { zoom, panX, panY } = view.current;
    const { w: dw, h: dh } = doc.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!dw) return;

    // checkerboard over the document bounds
    const sq = 10;
    ctx.save();
    ctx.beginPath();
    ctx.rect(panX, panY, dw * zoom, dh * zoom);
    ctx.clip();
    for (let y = 0; y < dh * zoom; y += sq) {
      for (let x = 0; x < dw * zoom; x += sq) {
        ctx.fillStyle = ((x / sq + y / sq) & 1) === 0 ? "#3a3a3a" : "#2a2a2a";
        ctx.fillRect(panX + x, panY + y, sq, sq);
      }
    }
    ctx.restore();

    ctx.imageSmoothingEnabled = zoom < 1;
    for (const l of layers.current) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l.cvs, panX + l.x * zoom, panY + l.y * zoom, l.w * zoom, l.h * zoom);
    }
    ctx.globalAlpha = 1;

    // active layer outline
    const a = active();
    if (a) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(panX + a.x * zoom, panY + a.y * zoom, a.w * zoom, a.h * zoom);
      ctx.setLineDash([]);
    }

    // lasso overlay
    if (lasso.current.length > 1 && a) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      lasso.current.forEach((p, i) => {
        const sx = panX + (a.x + p.x) * zoom;
        const sy = panY + (a.y + p.y) * zoom;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ---- coords ----
  function toDoc(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { zoom, panX, panY } = view.current;
    return { x: (e.clientX - rect.left - panX) / zoom, y: (e.clientY - rect.top - panY) / zoom };
  }
  // topmost visible layer whose pixel under the doc point is opaque
  function pick(dx: number, dy: number): Layer | null {
    for (let i = layers.current.length - 1; i >= 0; i--) {
      const l = layers.current[i];
      if (!l.visible) continue;
      const lx = Math.floor(dx - l.x);
      const ly = Math.floor(dy - l.y);
      if (lx >= 0 && ly >= 0 && lx < l.w && ly < l.h && l.alpha[ly * l.w + lx] > 8) return l;
    }
    return null;
  }

  function pushUndo(l: Layer) {
    undo.current.push({ id: l.id, alpha: l.alpha.slice() });
    if (undo.current.length > UNDO_LIMIT) undo.current.shift();
    rerender();
  }
  const value = (invert: boolean): MaskValue => ((paint === "keep") !== invert ? 255 : 0);

  // ---- pointer ----
  function onDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    const { x, y } = toDoc(e);
    ptr.current.down = true;
    ptr.current.lx = x;
    ptr.current.ly = y;

    if (ptr.current.mode === "" && (e.button === 1 || e.shiftKey)) {
      ptr.current.mode = "pan";
      return;
    }
    if (tool === "move") {
      const l = pick(x, y);
      if (l) {
        setActiveId(l.id);
        ptr.current.mode = "drag";
        ptr.current.dragId = l.id;
      } else {
        ptr.current.mode = "pan";
      }
      return;
    }
    // paint tools act on the active layer
    const a = active();
    if (!a) return;
    const lx = x - a.x;
    const ly = y - a.y;
    ptr.current.mode = "paint";
    if (tool === "brush") {
      pushUndo(a);
      strokeSegment(a.alpha, a.w, a.h, lx, ly, lx, ly, brush / view.current.zoom / 2, hardness, value(e.altKey));
      bake(a);
      scheduleDraw();
    } else if (tool === "lasso") {
      lasso.current = [{ x: lx, y: ly }];
    } else if (tool === "wand") {
      const ix = Math.floor(lx);
      const iy = Math.floor(ly);
      if (ix < 0 || iy < 0 || ix >= a.w || iy >= a.h) return;
      pushUndo(a);
      const sel = magicWandSelect(a.rgba, a.w, a.h, ix, iy, tolerance, contiguous);
      applySelection(a.alpha, sel, value(e.altKey));
      bake(a);
      scheduleDraw();
    }
  }

  function onMove(e: React.PointerEvent) {
    if (!ptr.current.down) return;
    const { x, y } = toDoc(e);
    const dx = x - ptr.current.lx;
    const dy = y - ptr.current.ly;

    if (ptr.current.mode === "pan") {
      view.current.panX += dx * view.current.zoom;
      view.current.panY += dy * view.current.zoom;
      scheduleDraw();
      return; // keep last point in pre-pan doc space
    }
    if (ptr.current.mode === "drag") {
      const l = layers.current.find((k) => k.id === ptr.current.dragId);
      if (l) {
        l.x += dx;
        l.y += dy;
        scheduleDraw();
      }
    } else if (ptr.current.mode === "paint") {
      const a = active();
      if (a) {
        if (tool === "brush") {
          strokeSegment(a.alpha, a.w, a.h, ptr.current.lx - a.x, ptr.current.ly - a.y, x - a.x, y - a.y, brush / view.current.zoom / 2, hardness, value(e.altKey));
          bake(a);
          scheduleDraw();
        } else if (tool === "lasso") {
          lasso.current.push({ x: x - a.x, y: y - a.y });
          scheduleDraw();
        }
      }
    }
    ptr.current.lx = x;
    ptr.current.ly = y;
  }

  function onUp(e: React.PointerEvent) {
    if (tool === "lasso" && ptr.current.mode === "paint" && lasso.current.length > 2) {
      const a = active();
      if (a) {
        pushUndo(a);
        fillPolygon(a.alpha, a.w, a.h, lasso.current, value(e.altKey));
        bake(a);
      }
    }
    lasso.current = [];
    ptr.current.down = false;
    ptr.current.mode = "";
    scheduleDraw();
  }

  function onWheel(e: React.WheelEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const v = view.current;
    const z = Math.max(0.05, Math.min(16, v.zoom * Math.exp(-e.deltaY * 0.0015)));
    v.panX = mx - ((mx - v.panX) * z) / v.zoom;
    v.panY = my - ((my - v.panY) * z) / v.zoom;
    v.zoom = z;
    scheduleDraw();
  }

  // ---- layer ops ----
  function selectLayer(id: string) {
    setActiveId(id);
    scheduleDraw();
  }
  function toggleVisible(id: string) {
    const l = layers.current.find((k) => k.id === id);
    if (l) l.visible = !l.visible;
    rerender();
    scheduleDraw();
  }
  function setOpacity(id: string, o: number) {
    const l = layers.current.find((k) => k.id === id);
    if (l) l.opacity = o;
    rerender();
    scheduleDraw();
  }
  function reorder(id: string, dir: -1 | 1) {
    const arr = layers.current;
    const i = arr.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    rerender();
    scheduleDraw();
  }
  function removeLayer(id: string) {
    layers.current = layers.current.filter((l) => l.id !== id);
    if (activeId === id) setActiveId(layers.current[layers.current.length - 1]?.id ?? null);
    rerender();
    scheduleDraw();
  }
  function morph(px: number) {
    const a = active();
    if (!a) return;
    pushUndo(a);
    growShrink(a.alpha, a.w, a.h, px);
    bake(a);
    scheduleDraw();
  }
  function feather(px: number) {
    const a = active();
    if (!a) return;
    pushUndo(a);
    smoothAlpha(a.alpha, a.w, a.h, px);
    bake(a);
    scheduleDraw();
  }
  function doUndo() {
    const u = undo.current.pop();
    if (!u) return;
    const l = layers.current.find((k) => k.id === u.id);
    if (l) {
      l.alpha = u.alpha;
      bake(l);
    }
    rerender();
    scheduleDraw();
  }

  async function exportPng() {
    const { w, h } = doc.current;
    if (!w) return;
    const [out, ctx] = make2d(w, h);
    for (const l of layers.current) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l.cvs, l.x, l.y, l.w, l.h);
    }
    ctx.globalAlpha = 1;
    const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/png"));
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "composition.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        doUndo();
      }
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const btn = (on: boolean) =>
    clsx("rounded px-2.5 py-1.5 text-xs font-medium", on ? "bg-white text-black" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700");

  const ordered = [...layers.current].reverse(); // panel shows top layer first

  return (
    <div className="flex h-[72vh] flex-col overflow-hidden rounded-lg border border-neutral-800">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-3 py-2 text-sm">
        <div className="flex gap-1">
          {(["move", "brush", "wand", "lasso"] as Tool[]).map((t) => (
            <button key={t} className={btn(tool === t)} onClick={() => setTool(t)} disabled={!layers.current.length}>
              {t === "move" ? "Move" : t === "brush" ? "Brush" : t === "wand" ? "Magic Wand" : "Lasso"}
            </button>
          ))}
        </div>
        {tool !== "move" && (
          <>
            <div className="mx-1 h-5 w-px bg-neutral-800" />
            <div className="flex overflow-hidden rounded border border-neutral-700 text-xs">
              <button className={clsx("px-2 py-1.5", paint === "keep" ? "bg-emerald-500/25 text-emerald-200" : "text-neutral-400")} onClick={() => setPaint("keep")}>
                Keep
              </button>
              <button className={clsx("px-2 py-1.5", paint === "remove" ? "bg-red-500/25 text-red-200" : "text-neutral-400")} onClick={() => setPaint("remove")}>
                Remove
              </button>
            </div>
            {tool === "brush" && (
              <>
                <label className="flex items-center gap-2 text-xs text-neutral-400">
                  Size
                  <input type="range" min={4} max={200} value={brush} onChange={(e) => setBrush(+e.target.value)} />
                </label>
                <label className="flex items-center gap-2 text-xs text-neutral-400">
                  Soft
                  <input type="range" min={0} max={100} value={Math.round((1 - hardness) * 100)} onChange={(e) => setHardness(1 - +e.target.value / 100)} />
                </label>
              </>
            )}
            {tool === "wand" && (
              <>
                <label className="flex items-center gap-2 text-xs text-neutral-400">
                  Tol
                  <input type="range" min={1} max={80} value={Math.round(tolerance * 100)} onChange={(e) => setTolerance(+e.target.value / 100)} />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <input type="checkbox" checked={contiguous} onChange={(e) => setContiguous(e.target.checked)} className="accent-white" />
                  Contiguous
                </label>
              </>
            )}
            <div className="flex items-center gap-1">
              <button className={btn(false)} onClick={() => morph(2)}>Grow</button>
              <button className={btn(false)} onClick={() => morph(-2)}>Shrink</button>
              <button className={btn(false)} onClick={() => feather(2)}>Smooth</button>
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button className={btn(false)} onClick={doUndo} disabled={!undo.current.length}>Undo</button>
          <button className={btn(false)} onClick={() => { fitView(); scheduleDraw(); }} disabled={!layers.current.length}>Fit</button>
          <label className="cursor-pointer rounded border border-neutral-600 px-2.5 py-1.5 text-xs font-medium text-neutral-100 hover:border-neutral-400">
            Add images
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { addImages(e.currentTarget.files); e.currentTarget.value = ""; }} />
          </label>
          <button className="rounded bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40" onClick={exportPng} disabled={!layers.current.length}>
            Export PNG
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* canvas */}
        <div
          ref={wrapRef}
          className="relative min-w-0 flex-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addImages(e.dataTransfer.files); }}
        >
          {!layers.current.length && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-sm text-neutral-500">
              <div>
                <div className="mb-1 text-neutral-300">Drop images here to start</div>
                <div className="text-xs text-neutral-600">or use “Add images” — each becomes a layer</div>
                {busy && <div className="mt-2 text-xs text-sky-300">Loading…</div>}
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className={clsx("absolute inset-0", tool === "move" ? "cursor-move" : "cursor-crosshair")}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onWheel={onWheel}
          />
        </div>

        {/* layer panel */}
        <div className="flex w-56 shrink-0 flex-col border-l border-neutral-800">
          <div className="border-b border-neutral-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Layers
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!ordered.length && <div className="px-3 py-3 text-xs text-neutral-600">No layers yet.</div>}
            {ordered.map((l) => (
              <div
                key={l.id}
                onClick={() => selectLayer(l.id)}
                className={clsx(
                  "flex cursor-pointer items-center gap-2 border-b border-neutral-900 px-2 py-2",
                  l.id === activeId ? "bg-sky-500/10" : "hover:bg-neutral-900",
                )}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleVisible(l.id); }}
                  className={clsx("shrink-0 text-xs", l.visible ? "text-neutral-300" : "text-neutral-600")}
                  title={l.visible ? "Hide" : "Show"}
                >
                  {l.visible ? "👁" : "🚫"}
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.thumb} alt="" className="h-9 w-9 shrink-0 rounded bg-neutral-800 object-contain" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-neutral-300">{l.name}</div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(l.opacity * 100)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setOpacity(l.id, +e.target.value / 100)}
                    className="mt-1 w-full"
                  />
                </div>
                <div className="flex shrink-0 flex-col text-neutral-500">
                  <button onClick={(e) => { e.stopPropagation(); reorder(l.id, 1); }} className="text-[10px] hover:text-neutral-200" title="Move up">▲</button>
                  <button onClick={(e) => { e.stopPropagation(); reorder(l.id, -1); }} className="text-[10px] hover:text-neutral-200" title="Move down">▼</button>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeLayer(l.id); }} className="shrink-0 text-xs text-neutral-600 hover:text-red-300" title="Delete">✕</button>
              </div>
            ))}
          </div>
          <div className="border-t border-neutral-800 px-3 py-2 text-[11px] text-neutral-600">
            Move layers with the Move tool · cut out with Brush/Wand/Lasso · scroll to zoom · shift-drag to pan
          </div>
        </div>
      </div>
    </div>
  );
}
