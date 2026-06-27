import { describe, expect, it } from "vitest";
import { runPool } from "@/lib/pool";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("runPool", () => {
  it("processes every item exactly once", async () => {
    const items = Array.from({ length: 40 }, (_, i) => i);
    const seen: number[] = [];
    await runPool(items, 3, async (n) => {
      seen.push(n);
    });
    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });

  it("never exceeds the concurrency limit", async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    let inFlight = 0;
    let peak = 0;
    await runPool(items, 4, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBe(4); // with 20 items it should actually saturate all 4 lanes
  });

  it("keeps going when individual items fail (errors handled in the worker)", async () => {
    const items = [1, 2, 3, 4, 5];
    const done: number[] = [];
    const errors: number[] = [];
    await runPool(items, 2, async (n) => {
      try {
        if (n % 2 === 0) throw new Error("boom");
        done.push(n);
      } catch {
        errors.push(n);
      }
    });
    expect(done.sort()).toEqual([1, 3, 5]);
    expect(errors.sort()).toEqual([2, 4]);
  });

  it("handles an empty list without spawning lanes", async () => {
    let calls = 0;
    await runPool([], 5, async () => {
      calls++;
    });
    expect(calls).toBe(0);
  });

  it("clamps lanes to the item count when limit exceeds it", async () => {
    const items = [1, 2];
    let inFlight = 0;
    let peak = 0;
    await runPool(items, 10, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("treats a limit below 1 as a single lane", async () => {
    const items = [1, 2, 3];
    let inFlight = 0;
    let peak = 0;
    await runPool(items, 0, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight--;
    });
    expect(peak).toBe(1);
  });
});
