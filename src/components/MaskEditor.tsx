"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applySelection,
  extractAlpha,
  fillPolygon,
  growShrink,
  magicWandSelect,
  smoothAlpha,
  strokeSegment,
  type MaskValue,
} from "@/lib/mask-edit";

// Cap the editing resolution for responsiveness; the mask is upscaled back to the
// cutout's native size on save so exports stay full-resolution.
const EDIT_MAX = 2048;
const UNDO_LIMIT = 24;

type Tool = "brush" | "wand" | "lasso" | "pan";
type Paint = "keep" | "remove";

interface Props {
  original: Blob;
  // The starting cutout, if refining an auto-removal. Omit to start from scratch
  // (the whole image kept — use Remove tools to cut it out by hand).
  cutout?: Blob;
  onSave: (cutout: Blob) => void;
  onClose: () => void;
}

async function drawScaled(blob: Blob, w: number, h: number): Promise<ImageData> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return ctx.getImageData(0, 0, w, h);
}

export default function MaskEditor({ original, cutout, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Hot data lives in refs (mutated per pointer event, no React churn).
  const dims = useRef({ W: 0, H: 0, nativeW: 0, nativeH: 0 });
  const origRef = useRef<Uint8ClampedArray | null>(null); // original RGBA at edit res
  const alphaRef = useRef<Uint8Array | null>(null); // current mask
  const compRef = useRef<{ canvas: HTMLCanvasElement; img: ImageData } | null>(null);
  const view = useRef({ zoom: 1, panX: 0, panY: 0 });
  const undo = useRef<Uint8Array[]>([]);
  const redo = useRef<Uint8Array[]>([]);
  const ptr = useRef({ down: false, lastX: 0, lastY: 0, space: false, panning: false });
  const lasso = useRef<{ x: number; y: number }[]>([]);
  const raf = useRef(0);
  const didFit = useRef(false);

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<Tool>("brush");
  const [paint, setPaint] = useState<Paint>("remove");
  const [brush, setBrush] = useState(48);
  const [hardness, setHardness] = useState(0.7);
  const [tolerance, setTolerance] = useState(0.15);
  const [contiguous, setContiguous] = useState(true);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const scheduleDraw = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      draw();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- load ----
  useEffect(() => {
    let alive = true;
    (async () => {
      // Native size comes from the cutout when refining, else the original (from scratch).
      const sizeSrc = cutout ?? original;
      const sbmp = await createImageBitmap(sizeSrc);
      const nativeW = sbmp.width;
      const nativeH = sbmp.height;
      sbmp.close();
      const scale = Math.min(1, EDIT_MAX / Math.max(nativeW, nativeH));
      const W = Math.round(nativeW * scale);
      const H = Math.round(nativeH * scale);
      const orig = await drawScaled(original, W, H);
      if (!alive) return;
      dims.current = { W, H, nativeW, nativeH };
      origRef.current = orig.data;
      // Refining → start from the cutout's alpha; from scratch → keep everything (255).
      if (cutout) {
        alphaRef.current = extractAlpha((await drawScaled(cutout, W, H)).data, W, H);
      } else {
        alphaRef.current = new Uint8Array(W * H).fill(255);
      }
      if (!alive) return;
      const cc = document.createElement("canvas");
      cc.width = W;
      cc.height = H;
      compRef.current = { canvas: cc, img: new ImageData(W, H) };
      setReady(true); // the ResizeObserver effect fits + draws once the container is laid out
    })();
    return () => {
      alive = false;
    };
  }, [original, cutout]);

  function fitView() {
    const wrap = wrapRef.current;
    const { W, H } = dims.current;
    if (!wrap || !W) return;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (!cw || !ch) return; // container not laid out yet — refit when it is
    const zoom = Math.min(cw / W, ch / H) * 0.92;
    view.current = { zoom, panX: (cw - W * zoom) / 2, panY: (ch - H * zoom) / 2 };
  }

  // Size the canvas backing store to its container, and fit the image the first time
  // the container actually has a size (a fitView() during load runs before layout).
  useEffect(() => {
    if (!ready) return;
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
      if (!didFit.current) {
        fitView();
        didFit.current = true;
      }
      scheduleDraw();
    };
    const ro = new ResizeObserver(sync);
    ro.observe(wrap);
    sync();
    return () => ro.disconnect();
  }, [ready, scheduleDraw]);

  // ---- compositing + render ----
  function rebuildComposite() {
    const comp = compRef.current!;
    const orig = origRef.current!;
    const alpha = alphaRef.current!;
    const d = comp.img.data;
    for (let p = 0, q = 0; p < alpha.length; p++, q += 4) {
      d[q] = orig[q];
      d[q + 1] = orig[q + 1];
      d[q + 2] = orig[q + 2];
      d[q + 3] = alpha[p];
    }
    comp.canvas.getContext("2d")!.putImageData(comp.img, 0, 0);
  }

  function draw() {
    const cv = canvasRef.current;
    const comp = compRef.current;
    if (!cv || !comp) return;
    const ctx = cv.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { W, H } = dims.current;
    const { zoom, panX, panY } = view.current;
    rebuildComposite();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);

    // checkerboard behind the image rect so removed areas read as transparent
    const sq = 10;
    ctx.save();
    ctx.beginPath();
    ctx.rect(panX, panY, W * zoom, H * zoom);
    ctx.clip();
    for (let y = 0; y < H * zoom; y += sq) {
      for (let x = 0; x < W * zoom; x += sq) {
        ctx.fillStyle = ((x / sq + y / sq) & 1) === 0 ? "#3a3a3a" : "#2a2a2a";
        ctx.fillRect(panX + x, panY + y, sq, sq);
      }
    }
    ctx.restore();

    ctx.imageSmoothingEnabled = zoom < 1;
    ctx.drawImage(comp.canvas, panX, panY, W * zoom, H * zoom);

    // lasso overlay
    if (lasso.current.length > 1) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      lasso.current.forEach((p, i) => {
        const sx = panX + p.x * zoom;
        const sy = panY + p.y * zoom;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ---- coordinate mapping ----
  function toImage(e: React.PointerEvent) {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const { zoom, panX, panY } = view.current;
    return {
      x: (e.clientX - rect.left - panX) / zoom,
      y: (e.clientY - rect.top - panY) / zoom,
    };
  }

  function pushUndo() {
    const a = alphaRef.current;
    if (!a) return;
    undo.current.push(a.slice());
    if (undo.current.length > UNDO_LIMIT) undo.current.shift();
    redo.current.length = 0;
    rerender();
  }

  const value = (invert: boolean): MaskValue => ((paint === "keep") !== invert ? 255 : 0);

  // ---- pointer handlers ----
  function onDown(e: React.PointerEvent) {
    if (!ready) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const { x, y } = toImage(e);
    const { W, H } = dims.current;
    ptr.current.down = true;
    ptr.current.lastX = x;
    ptr.current.lastY = y;

    const panning = tool === "pan" || ptr.current.space || e.button === 1;
    ptr.current.panning = panning;
    if (panning) return;

    if (tool === "brush") {
      pushUndo();
      strokeSegment(alphaRef.current!, W, H, x, y, x, y, brush / view.current.zoom / 2, hardness, value(e.altKey));
      scheduleDraw();
    } else if (tool === "lasso") {
      lasso.current = [{ x, y }];
    } else if (tool === "wand") {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      pushUndo();
      const sel = magicWandSelect(origRef.current!, W, H, Math.floor(x), Math.floor(y), tolerance, contiguous);
      applySelection(alphaRef.current!, sel, value(e.altKey));
      scheduleDraw();
    }
  }

  function onMove(e: React.PointerEvent) {
    if (!ready || !ptr.current.down) return;
    const { x, y } = toImage(e);
    const { W, H } = dims.current;

    if (ptr.current.panning) {
      view.current.panX += (x - ptr.current.lastX) * view.current.zoom;
      view.current.panY += (y - ptr.current.lastY) * view.current.zoom;
      scheduleDraw();
      return; // keep lastX/Y in pre-pan image space
    }

    if (tool === "brush") {
      strokeSegment(alphaRef.current!, W, H, ptr.current.lastX, ptr.current.lastY, x, y, brush / view.current.zoom / 2, hardness, value(e.altKey));
      scheduleDraw();
    } else if (tool === "lasso") {
      lasso.current.push({ x, y });
      scheduleDraw();
    }
    ptr.current.lastX = x;
    ptr.current.lastY = y;
  }

  function onUp(e: React.PointerEvent) {
    if (!ready) return;
    ptr.current.down = false;
    if (tool === "lasso" && lasso.current.length > 2) {
      pushUndo();
      const { W, H } = dims.current;
      fillPolygon(alphaRef.current!, W, H, lasso.current, value(e.altKey));
      lasso.current = [];
      scheduleDraw();
    }
    ptr.current.panning = false;
  }

  function onWheel(e: React.WheelEvent) {
    if (!ready) return;
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const v = view.current;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const z = Math.max(0.05, Math.min(16, v.zoom * factor));
    // zoom around the cursor
    v.panX = mx - ((mx - v.panX) * z) / v.zoom;
    v.panY = my - ((my - v.panY) * z) / v.zoom;
    v.zoom = z;
    scheduleDraw();
  }

  // ---- edits that need a redraw + undo ----
  function morph(px: number) {
    if (!ready) return;
    pushUndo();
    growShrink(alphaRef.current!, dims.current.W, dims.current.H, px);
    scheduleDraw();
  }
  function feather(px: number) {
    if (!ready) return;
    pushUndo();
    smoothAlpha(alphaRef.current!, dims.current.W, dims.current.H, px);
    scheduleDraw();
  }
  function doUndo() {
    const prev = undo.current.pop();
    if (!prev) return;
    redo.current.push(alphaRef.current!.slice());
    alphaRef.current = prev;
    scheduleDraw();
    rerender();
  }
  function doRedo() {
    const next = redo.current.pop();
    if (!next) return;
    undo.current.push(alphaRef.current!.slice());
    alphaRef.current = next;
    scheduleDraw();
    rerender();
  }

  // keyboard: space to pan, cmd/ctrl+z undo/redo
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space") ptr.current.space = true;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      }
      if (e.key === "Escape" && !lasso.current.length) onClose();
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === "Space") ptr.current.space = false;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    const { nativeW, nativeH, W, H } = dims.current;
    // upscale the edited mask to native resolution
    const maskC = document.createElement("canvas");
    maskC.width = W;
    maskC.height = H;
    const mctx = maskC.getContext("2d")!;
    const mimg = mctx.createImageData(W, H);
    const a = alphaRef.current!;
    for (let p = 0; p < a.length; p++) {
      mimg.data[p * 4] = mimg.data[p * 4 + 1] = mimg.data[p * 4 + 2] = a[p];
      mimg.data[p * 4 + 3] = 255;
    }
    mctx.putImageData(mimg, 0, 0);

    const out = document.createElement("canvas");
    out.width = nativeW;
    out.height = nativeH;
    const octx = out.getContext("2d")!;
    const obmp = await createImageBitmap(original);
    octx.drawImage(obmp, 0, 0, nativeW, nativeH);
    obmp.close();
    // scale mask up and read it as the alpha channel
    const up = document.createElement("canvas");
    up.width = nativeW;
    up.height = nativeH;
    const uctx = up.getContext("2d", { willReadFrequently: true })!;
    uctx.imageSmoothingEnabled = true;
    uctx.imageSmoothingQuality = "high";
    uctx.drawImage(maskC, 0, 0, nativeW, nativeH);
    const maskData = uctx.getImageData(0, 0, nativeW, nativeH).data;
    const outImg = octx.getImageData(0, 0, nativeW, nativeH);
    for (let i = 0; i < nativeW * nativeH; i++) outImg.data[i * 4 + 3] = maskData[i * 4];
    octx.putImageData(outImg, 0, 0);
    out.toBlob((b) => b && onSave(b), "image/png");
  }

  const btn = (active: boolean) =>
    clsx(
      "rounded px-2.5 py-1.5 text-xs font-medium",
      active ? "bg-white text-black" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700",
    );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur">
      {/* top bar */}
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2 text-sm">
        <span className="mr-2 font-medium text-neutral-200">{cutout ? "Refine cutout" : "Cut out by hand"}</span>
        <div className="flex gap-1">
          {(["brush", "wand", "lasso", "pan"] as Tool[]).map((t) => (
            <button key={t} className={btn(tool === t)} onClick={() => setTool(t)}>
              {t === "brush" ? "Brush" : t === "wand" ? "Magic Wand" : t === "lasso" ? "Lasso" : "Pan"}
            </button>
          ))}
        </div>
        <div className="mx-2 h-5 w-px bg-neutral-800" />
        {/* keep / remove */}
        <div className="flex overflow-hidden rounded border border-neutral-700">
          <button className={clsx("px-2.5 py-1.5 text-xs", paint === "keep" ? "bg-emerald-500/25 text-emerald-200" : "text-neutral-400")} onClick={() => setPaint("keep")}>
            Keep
          </button>
          <button className={clsx("px-2.5 py-1.5 text-xs", paint === "remove" ? "bg-red-500/25 text-red-200" : "text-neutral-400")} onClick={() => setPaint("remove")}>
            Remove
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className={btn(false)} disabled={!undo.current.length} onClick={doUndo}>
            Undo
          </button>
          <button className={btn(false)} disabled={!redo.current.length} onClick={doRedo}>
            Redo
          </button>
          <button className="rounded px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200" onClick={onClose}>
            Cancel
          </button>
          <button className="rounded bg-white px-3 py-1.5 text-xs font-semibold text-black" onClick={save}>
            Save
          </button>
        </div>
      </div>

      {/* tool options */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-neutral-800 px-3 py-2 text-xs text-neutral-400">
        {(tool === "brush") && (
          <>
            <label className="flex items-center gap-2">
              Size
              <input type="range" min={4} max={200} value={brush} onChange={(e) => setBrush(+e.target.value)} />
              <span className="w-8 tabular-nums text-neutral-500">{brush}</span>
            </label>
            <label className="flex items-center gap-2">
              Softness
              <input type="range" min={0} max={100} value={Math.round((1 - hardness) * 100)} onChange={(e) => setHardness(1 - +e.target.value / 100)} />
            </label>
          </>
        )}
        {tool === "wand" && (
          <>
            <label className="flex items-center gap-2">
              Tolerance
              <input type="range" min={1} max={80} value={Math.round(tolerance * 100)} onChange={(e) => setTolerance(+e.target.value / 100)} />
              <span className="w-8 tabular-nums text-neutral-500">{Math.round(tolerance * 100)}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={contiguous} onChange={(e) => setContiguous(e.target.checked)} className="accent-white" />
              Contiguous
            </label>
          </>
        )}
        {/* edge tools always available */}
        <div className="flex items-center gap-1.5">
          <span>Edge</span>
          <button className={btn(false)} onClick={() => morph(2)}>Grow</button>
          <button className={btn(false)} onClick={() => morph(-2)}>Shrink</button>
          <button className={btn(false)} onClick={() => feather(2)}>Smooth</button>
        </div>
        <button className={clsx(btn(false), "ml-auto")} onClick={() => { fitView(); scheduleDraw(); }}>
          Fit
        </button>
        <span className="text-neutral-600">Alt = invert · Space = pan · scroll = zoom</span>
      </div>

      {/* canvas */}
      <div ref={wrapRef} className="relative flex-1 overflow-hidden">
        {!ready && <div className="absolute inset-0 grid place-items-center text-sm text-neutral-500">Loading…</div>}
        <canvas
          ref={canvasRef}
          className={clsx("absolute inset-0", tool === "pan" ? "cursor-grab" : "cursor-crosshair")}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onWheel={onWheel}
        />
      </div>
    </div>
  );
}
