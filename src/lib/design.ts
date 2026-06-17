import type { GarmentDesign, PrintArt, PrintPlacement, View } from "@/lib/types";

/** Which garment region an uploaded print lands on for the view you're looking at. */
export const placementForView: Record<View, PrintPlacement> = {
  front: "front",
  back: "back",
  side: "leftSleeve",
};

/** A user-uploaded print: the artwork plus how it's positioned on the region. */
export type CustomPrint = Omit<PrintArt, "placement">;

/**
 * Overlay an uploaded print onto a garment design for the current view. The custom
 * print replaces whatever print was on that view's region; other regions are kept.
 * Returns the design unchanged when there's no artwork yet.
 */
export function designWithCustomPrint(
  design: GarmentDesign,
  view: View,
  custom: CustomPrint | undefined,
): GarmentDesign {
  if (!custom?.assetUrl) return design;
  const placement = placementForView[view];
  return {
    ...design,
    prints: [
      ...design.prints.filter((print) => print.placement !== placement),
      { placement, ...custom },
    ],
  };
}
