import { describe, expect, it } from "vitest";
import {
  applySelection,
  fillPolygon,
  growShrink,
  magicWandSelect,
  smoothAlpha,
  stampBrush,
} from "./mask-edit";

// Build a WxH RGBA buffer from a per-pixel colour function.
function rgba(W: number, H: number, colour: (x: number, y: number) => [number, number, number]) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = colour(x, y);
      const i = (y * W + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  return d;
}

const count = (a: Uint8Array) => a.reduce((n, v) => n + (v > 127 ? 1 : 0), 0);

describe("magicWandSelect", () => {
  // 10x10: left half white, right half red, plus one isolated white pixel at (8,0).
  const W = 10,
    H = 10;
  const img = rgba(W, H, (x, y) => (x < 5 ? [255, 255, 255] : x === 8 && y === 0 ? [255, 255, 255] : [200, 0, 0]));

  it("contiguous flood selects only the connected region", () => {
    const sel = magicWandSelect(img, W, H, 0, 0, 0.1, true);
    expect(count(sel)).toBe(50); // the left white block, NOT the isolated white pixel
    expect(sel[0 * W + 8]).toBe(0);
  });

  it("global select-by-colour grabs every matching pixel", () => {
    const sel = magicWandSelect(img, W, H, 0, 0, 0.1, false);
    expect(count(sel)).toBe(51); // left block + the isolated white pixel
    expect(sel[0 * W + 8]).toBe(255);
  });

  it("high tolerance swallows the whole image", () => {
    const sel = magicWandSelect(img, W, H, 0, 0, 1, true);
    expect(count(sel)).toBe(100);
  });
});

describe("applySelection", () => {
  it("writes the value only where selected", () => {
    const alpha = new Uint8Array(4).fill(255);
    const sel = new Uint8Array([255, 0, 255, 0]);
    applySelection(alpha, sel, 0);
    expect(Array.from(alpha)).toEqual([0, 255, 0, 255]);
  });
});

describe("stampBrush", () => {
  it("paints a filled disc into the alpha", () => {
    const W = 21,
      H = 21;
    const alpha = new Uint8Array(W * H); // all 0
    stampBrush(alpha, W, H, 10, 10, 6, 1, 255);
    expect(alpha[10 * W + 10]).toBe(255); // centre solid
    expect(alpha[0]).toBe(0); // far corner untouched
    expect(count(alpha)).toBeGreaterThan(60); // ~pi*6^2
  });
});

describe("fillPolygon", () => {
  it("fills the interior of a triangle", () => {
    const W = 20,
      H = 20;
    const alpha = new Uint8Array(W * H);
    fillPolygon(alpha, W, H, [
      { x: 2, y: 2 },
      { x: 18, y: 2 },
      { x: 2, y: 18 },
    ], 255);
    expect(alpha[3 * W + 3]).toBe(255); // inside near the right angle
    expect(alpha[17 * W + 17]).toBe(0); // outside the hypotenuse
  });
});

describe("growShrink", () => {
  const W = 11,
    H = 11;
  function centreDot() {
    const a = new Uint8Array(W * H);
    a[5 * W + 5] = 255;
    return a;
  }

  it("grow (dilate) expands the opaque region", () => {
    const a = centreDot();
    growShrink(a, W, H, 1);
    expect(a[5 * W + 4]).toBe(255);
    expect(a[4 * W + 5]).toBe(255);
    expect(count(a)).toBeGreaterThan(1);
  });

  it("shrink (erode) removes a thin feature", () => {
    const a = centreDot();
    growShrink(a, W, H, -1);
    expect(count(a)).toBe(0);
  });
});

describe("smoothAlpha", () => {
  it("feathers a hard edge into intermediate values", () => {
    const W = 20,
      H = 4;
    const a = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[y * W + x] = x < 10 ? 255 : 0;
    smoothAlpha(a, W, H, 2);
    // near the seam the value should be partial (not a pure 0/255 step)
    const seam = a[1 * W + 10];
    expect(seam).toBeGreaterThan(0);
    expect(seam).toBeLessThan(255);
  });
});
