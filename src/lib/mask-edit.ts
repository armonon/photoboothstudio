// Canvas2D mask-refinement primitives for the Pro editor. These are the algorithms
// behind SWEET's Visual selection tools (Magic Wand, Lasso, Grow/Shrink/Smooth, Paint),
// ported from its Rust/wgpu rasterizer to plain typed-array operations on an 8-bit alpha
// mask. Everything here is pure and synchronous; the React component owns the pixels.
//
// Conventions: `alpha` is a Uint8Array of length W*H (0 = transparent, 255 = opaque).
// `rgb` is the RGBA ImageData.data of the ORIGINAL image at the same W*H (used by tools
// that key off colour, e.g. the Magic Wand). Selections are Uint8Array masks (0/255).

export type MaskValue = 0 | 255; // erase vs restore

/** Squared RGB distance between two pixels in a flat RGBA buffer. */
function colourDist2(d: Uint8ClampedArray, i: number, j: number): number {
  const dr = d[i] - d[j];
  const dg = d[i + 1] - d[j + 1];
  const db = d[i + 2] - d[j + 2];
  return dr * dr + dg * dg + db * db;
}

/**
 * Magic Wand: select pixels whose colour is within `tolerance` (0..1) of the seed pixel.
 * `contiguous` = true does a flood fill from the seed (only the connected region);
 * false selects every matching pixel in the image ("Select by Colour"). Mirrors SWEET's
 * `MagicWand` contiguous-vs-global switch. Returns a 0/255 selection mask.
 */
export function magicWandSelect(
  rgb: Uint8ClampedArray,
  W: number,
  H: number,
  sx: number,
  sy: number,
  tolerance: number,
  contiguous: boolean,
): Uint8Array {
  const sel = new Uint8Array(W * H);
  const seed = (sy * W + sx) * 4;
  // tolerance 0..1 → squared distance over 3 channels (max 3*255^2).
  const tol2 = tolerance * tolerance * 3 * 255 * 255;

  if (!contiguous) {
    for (let p = 0; p < W * H; p++) {
      if (colourDist2(rgb, p * 4, seed) <= tol2) sel[p] = 255;
    }
    return sel;
  }

  // Scanline-ish flood fill with an explicit stack (avoids recursion depth limits).
  const stack = [sy * W + sx];
  const seen = new Uint8Array(W * H);
  seen[sy * W + sx] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    if (colourDist2(rgb, p * 4, seed) > tol2) continue;
    sel[p] = 255;
    const x = p % W;
    const y = (p - x) / W;
    if (x > 0 && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
    if (x < W - 1 && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
    if (y > 0 && !seen[p - W]) { seen[p - W] = 1; stack.push(p - W); }
    if (y < H - 1 && !seen[p + W]) { seen[p + W] = 1; stack.push(p + W); }
  }
  return sel;
}

/** OR a selection into the alpha mask at `value` (255 = keep/restore, 0 = remove). */
export function applySelection(alpha: Uint8Array, sel: Uint8Array, value: MaskValue): void {
  for (let p = 0; p < alpha.length; p++) if (sel[p]) alpha[p] = value;
}

/**
 * Paint a soft round brush stamp into `alpha`, blending toward `value` by a smooth
 * falloff. `hardness` 0..1 controls the solid-core fraction. Used for the Restore/Erase
 * brushes; call once per interpolated point along a stroke.
 */
export function stampBrush(
  alpha: Uint8Array,
  W: number,
  H: number,
  cx: number,
  cy: number,
  radius: number,
  hardness: number,
  value: MaskValue,
): void {
  const r = Math.max(1, radius);
  const core = r * Math.min(0.999, hardness);
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r) continue;
      // 1 inside the hard core, smootherstep down to 0 at the edge.
      let t = d <= core ? 1 : 1 - (d - core) / (r - core || 1);
      t = t * t * (3 - 2 * t);
      const p = y * W + x;
      alpha[p] = Math.round(alpha[p] + (value - alpha[p]) * t);
    }
  }
}

/** Interpolate brush stamps between two points so fast strokes stay continuous. */
export function strokeSegment(
  alpha: Uint8Array,
  W: number,
  H: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
  hardness: number,
  value: MaskValue,
): void {
  const dist = Math.hypot(bx - ax, by - ay);
  const step = Math.max(1, radius * 0.25);
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    stampBrush(alpha, W, H, ax + (bx - ax) * t, ay + (by - ay) * t, radius, hardness, value);
  }
}

/** Fill a closed polygon (the Lasso path) into `alpha` at `value` via even-odd scanline. */
export function fillPolygon(
  alpha: Uint8Array,
  W: number,
  H: number,
  pts: { x: number; y: number }[],
  value: MaskValue,
): void {
  if (pts.length < 3) return;
  let minY = H,
    maxY = 0;
  for (const p of pts) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(H - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i].y,
        yj = pts[j].y;
      if (yi > y !== yj > y) {
        xs.push(pts[i].x + ((y - yi) / (yj - yi)) * (pts[j].x - pts[i].x));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]));
      const xb = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = xa; x <= xb; x++) alpha[y * W + x] = value;
    }
  }
}

/**
 * Grow (dilate, `radius` > 0) or shrink (erode, `radius` < 0) the opaque region by a
 * chebyshev radius, using a separable min/max pass. This is SWEET's Selection → Grow/Shrink.
 */
export function growShrink(alpha: Uint8Array, W: number, H: number, radius: number): void {
  const r = Math.abs(radius) | 0;
  if (!r) return;
  const dilate = radius > 0;
  const pick = dilate ? Math.max : Math.min;
  const tmp = new Uint8Array(alpha.length);
  // horizontal
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = alpha[y * W + x];
      for (let k = 1; k <= r; k++) {
        if (x - k >= 0) v = pick(v, alpha[y * W + x - k]);
        if (x + k < W) v = pick(v, alpha[y * W + x + k]);
      }
      tmp[y * W + x] = v;
    }
  }
  // vertical
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = tmp[y * W + x];
      for (let k = 1; k <= r; k++) {
        if (y - k >= 0) v = pick(v, tmp[(y - k) * W + x]);
        if (y + k < H) v = pick(v, tmp[(y + k) * W + x]);
      }
      alpha[y * W + x] = v;
    }
  }
}

/** Feather the mask edge with a separable box blur (SWEET's Selection → Smooth). */
export function smoothAlpha(alpha: Uint8Array, W: number, H: number, radius: number): void {
  const r = Math.max(1, radius | 0);
  const win = r * 2 + 1;
  const tmp = new Float32Array(alpha.length);
  for (let y = 0; y < H; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += alpha[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = acc / win;
      const add = Math.min(W - 1, x + r + 1);
      const sub = Math.max(0, x - r);
      acc += alpha[y * W + add] - alpha[y * W + sub];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      alpha[y * W + x] = Math.round(acc / win);
      const add = Math.min(H - 1, y + r + 1);
      const sub = Math.max(0, y - r);
      acc += tmp[add * W + x] - tmp[sub * W + x];
    }
  }
}

/** Read the alpha channel of an RGBA buffer into a compact Uint8Array. */
export function extractAlpha(data: Uint8ClampedArray, W: number, H: number): Uint8Array {
  const a = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) a[p] = data[p * 4 + 3];
  return a;
}
