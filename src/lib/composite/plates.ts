import type { GarmentType, View, FitStyle, MannequinPlate } from "@/lib/types";
import { mockPlates } from "@/lib/mock-data";

/** Find the best plate for a garment/view/fit, falling back to any matching view. */
export function findPlate(
  garmentType: GarmentType,
  view: View,
  fitStyle: FitStyle,
): MannequinPlate | undefined {
  return (
    mockPlates.find(
      (p) => p.garmentType === garmentType && p.view === view && p.fitStyle === fitStyle,
    ) ?? mockPlates.find((p) => p.garmentType === garmentType && p.view === view)
  );
}
