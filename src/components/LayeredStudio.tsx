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

interface TextSpec {
  content: string;
  family: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

// Common families likely present on macOS/desktop; plus the user can upload font
// files and (where supported) pull in every installed font. See the font toolbar.
const BUILTIN_FONTS = [
  "Helvetica Neue",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Palatino",
  "Impact",
  "Futura",
  "Gill Sans",
  "Optima",
  "Baskerville",
  "American Typewriter",
  "Menlo",
  "Snell Roundhand",
  "Chalkboard SE",
  "Marker Felt",
];

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
  scale: number; // display scale (non-destructive resize); native pixels stay w*h
  kind: "image" | "text";
  text?: TextSpec; // present on text layers
}

function fontCss(t: TextSpec): string {
  const fam = /["',]/.test(t.family) ? t.family : `"${t.family}"`;
  return `${t.italic ? "italic " : ""}${t.bold ? "700" : "400"} ${t.size}px ${fam}, sans-serif`;
}

// Rasterise a text layer into its rgba/alpha/cvs (call after any text/font change).
function renderText(l: Layer) {
  const t = l.text!;
  const lines = (t.content || " ").split("\n");
  const [mc, mctx] = make2d(4, 4);
  mctx.font = fontCss(t);
  const pad = Math.ceil(t.size * 0.3);
  const lineH = Math.ceil(t.size * 1.32);
  const textW = Math.max(1, ...lines.map((ln) => Math.ceil(mctx.measureText(ln).width)));
  const w = textW + pad * 2;
  const h = lineH * lines.length + pad * 2;
  void mc;
  l.w = w;
  l.h = h;
  l.cvs.width = w;
  l.cvs.height = h;
  const ctx = l.cvs.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, w, h);
  ctx.font = fontCss(t);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = t.color;
  lines.forEach((ln, i) => ctx.fillText(ln, pad, pad + i * lineH));
  const img = ctx.getImageData(0, 0, w, h);
  l.rgba = img.data;
  l.alpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) l.alpha[p] = img.data[p * 4 + 3];
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
  const [fonts, setFonts] = useState<string[]>(BUILTIN_FONTS);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const addFont = (family: string) =>
    setFonts((prev) => (prev.includes(family) ? prev : [...prev, family].sort((a, b) => a.localeCompare(b))));

  // Upload a font file (.ttf/.otf/.woff) → register it so it's usable in text layers.
  async function addFontFile(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const family = file.name.replace(/\.[^.]+$/, "");
        const face = new FontFace(family, await file.arrayBuffer());
        await face.load();
        (document.fonts as FontFaceSet).add(face);
        addFont(family);
        // re-render any text layer already using this family
        updateText({});
      } catch {
        /* ignore an unreadable font file */
      }
    }
  }

  // Pull in every installed font where the browser supports it (Chromium web). Not
  // available in the desktop WKWebView — that's why upload + built-ins exist too.
  async function useInstalledFonts() {
    const q = (window as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> }).queryLocalFonts;
    if (!q) {
      alert("Browsing installed fonts isn't supported here — use “Add font file”, or type any installed font's exact name.");
      return;
    }
    try {
      const list = await q();
      const fams = Array.from(new Set(list.map((f) => f.family))).sort((a, b) => a.localeCompare(b));
      setFonts((prev) => Array.from(new Set([...prev, ...fams])).sort((a, b) => a.localeCompare(b)));
    } catch {
      /* permission denied */
    }
  }

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
          scale: 1,
          kind: "image",
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

  // ---- text ----
  function addText() {
    if (!doc.current.w) doc.current = { w: 1024, h: 1024 };
    const [cvs] = make2d(1, 1);
    const layer: Layer = {
      id: crypto.randomUUID(),
      name: "Text",
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      rgba: new Uint8ClampedArray(4),
      alpha: new Uint8Array(1),
      cvs,
      thumb: "",
      scale: 1,
      kind: "text",
      text: { content: "Your text", family: fonts[0] || "Arial", size: Math.round(doc.current.h / 12) || 64, color: "#ffffff", bold: true, italic: false },
    };
    renderText(layer);
    layer.x = Math.round((doc.current.w - layer.w) / 2);
    layer.y = Math.round((doc.current.h - layer.h) / 2);
    layer.thumb = makeThumb(layer);
    layers.current.push(layer);
    setActiveId(layer.id);
    setTool("move");
    if (!didFit.current) fitView();
    rerender();
    scheduleDraw();
  }

  // Update the active text layer's spec, re-rasterise, keep it centred on its anchor.
  function updateText(patch: Partial<TextSpec>) {
    const l = active();
    if (!l || l.kind !== "text" || !l.text) return;
    const cx = l.x + (l.w * l.scale) / 2;
    const cy = l.y + (l.h * l.scale) / 2;
    l.text = { ...l.text, ...patch };
    renderText(l);
    l.x = Math.round(cx - (l.w * l.scale) / 2);
    l.y = Math.round(cy - (l.h * l.scale) / 2);
    l.thumb = makeThumb(l);
    rerender();
    scheduleDraw();
  }

  // Resize the active layer (scales around its centre; non-destructive).
  function setLayerScale(s: number) {
    const l = active();
    if (!l) return;
    const cx = l.x + (l.w * l.scale) / 2;
    const cy = l.y + (l.h * l.scale) / 2;
    l.scale = s;
    l.x = Math.round(cx - (l.w * l.scale) / 2);
    l.y = Math.round(cy - (l.h * l.scale) / 2);
    rerender();
    scheduleDraw();
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

    ctx.imageSmoothingEnabled = true;
    for (const l of layers.current) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l.cvs, panX + l.x * zoom, panY + l.y * zoom, l.w * l.scale * zoom, l.h * l.scale * zoom);
    }
    ctx.globalAlpha = 1;

    // active layer outline
    const a = active();
    if (a) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(panX + a.x * zoom, panY + a.y * zoom, a.w * a.scale * zoom, a.h * a.scale * zoom);
      ctx.setLineDash([]);
    }

    // lasso overlay (points stored in layer-native space)
    if (lasso.current.length > 1 && a) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      lasso.current.forEach((p, i) => {
        const sx = panX + (a.x + p.x * a.scale) * zoom;
        const sy = panY + (a.y + p.y * a.scale) * zoom;
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
      const lx = Math.floor((dx - l.x) / l.scale);
      const ly = Math.floor((dy - l.y) / l.scale);
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
    // paint tools act on the active layer, in its native (unscaled) pixel space
    const a = active();
    if (!a) return;
    const lx = (x - a.x) / a.scale;
    const ly = (y - a.y) / a.scale;
    const rad = brush / view.current.zoom / a.scale / 2;
    ptr.current.mode = "paint";
    if (tool === "brush") {
      pushUndo(a);
      strokeSegment(a.alpha, a.w, a.h, lx, ly, lx, ly, rad, hardness, value(e.altKey));
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
          const rad = brush / view.current.zoom / a.scale / 2;
          strokeSegment(a.alpha, a.w, a.h, (ptr.current.lx - a.x) / a.scale, (ptr.current.ly - a.y) / a.scale, (x - a.x) / a.scale, (y - a.y) / a.scale, rad, hardness, value(e.altKey));
          bake(a);
          scheduleDraw();
        } else if (tool === "lasso") {
          lasso.current.push({ x: (x - a.x) / a.scale, y: (y - a.y) / a.scale });
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
      ctx.drawImage(l.cvs, l.x, l.y, l.w * l.scale, l.h * l.scale);
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
  const act = active();
  const tbtn = (on: boolean) => clsx("rounded px-2 py-1 text-xs font-medium", on ? "bg-white text-black" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700");

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
          <button className={btn(false)} onClick={addText} title="Add a text layer">+ Text</button>
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

      {/* properties row — resize any layer; edit text + fonts on text layers */}
      {act && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-800 px-3 py-2 text-xs text-neutral-400">
          <label className="flex items-center gap-2">
            Size
            <input type="range" min={10} max={400} value={Math.round(act.scale * 100)} onChange={(e) => setLayerScale(+e.target.value / 100)} />
            <span className="w-10 tabular-nums text-neutral-500">{Math.round(act.scale * 100)}%</span>
          </label>

          {act.kind === "text" && act.text && (
            <>
              <div className="h-5 w-px bg-neutral-800" />
              <input
                value={act.text.content}
                onChange={(e) => updateText({ content: e.target.value })}
                placeholder="Type your text"
                className="w-44 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
              />
              <select
                value={fonts.includes(act.text.family) ? act.text.family : ""}
                onChange={(e) => updateText({ family: e.target.value })}
                className="max-w-[10rem] rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
              >
                {!fonts.includes(act.text.family) && <option value="">{act.text.family}</option>}
                {fonts.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                placeholder="or type a font name ↵"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = e.currentTarget.value.trim();
                    if (v) {
                      addFont(v);
                      updateText({ family: v });
                      e.currentTarget.value = "";
                    }
                  }
                }}
                className="w-36 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
              />
              <label className="flex items-center gap-1">
                Size
                <input type="number" min={8} max={600} value={act.text.size} onChange={(e) => updateText({ size: +e.target.value })} className="w-16 rounded border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-neutral-200" />
              </label>
              <input type="color" value={act.text.color} onChange={(e) => updateText({ color: e.target.value })} className="h-7 w-8 cursor-pointer rounded border border-neutral-700 bg-neutral-900" />
              <button className={tbtn(act.text.bold)} onClick={() => updateText({ bold: !act.text!.bold })}><b>B</b></button>
              <button className={tbtn(act.text.italic)} onClick={() => updateText({ italic: !act.text!.italic })}><i>I</i></button>
              <label className="cursor-pointer rounded border border-neutral-600 px-2 py-1 text-neutral-200 hover:border-neutral-400">
                Add font file
                <input type="file" accept=".ttf,.otf,.woff,.woff2" multiple className="hidden" onChange={(e) => { addFontFile(e.currentTarget.files); e.currentTarget.value = ""; }} />
              </label>
              <button className={tbtn(false)} onClick={useInstalledFonts}>Installed fonts</button>
            </>
          )}
        </div>
      )}

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
