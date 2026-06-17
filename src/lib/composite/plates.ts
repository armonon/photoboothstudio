import type { FitStyle, GarmentType, MannequinPlate, ModelType, View } from "@/lib/types";

/** Find the best plate for a garment/view/fit, falling back to any matching view. */
export function findPlate(
  plates: MannequinPlate[],
  garmentType: GarmentType,
  view: View,
  fitStyle: FitStyle,
  modelType: ModelType,
): MannequinPlate | undefined {
  return (
    plates.find(
      (p) =>
        p.garmentType === garmentType &&
        p.view === view &&
        p.fitStyle === fitStyle &&
        p.modelType === modelType,
    ) ??
    plates.find(
      (p) => p.garmentType === garmentType && p.view === view && p.fitStyle === fitStyle,
    ) ??
    plates.find((p) => p.garmentType === garmentType && p.view === view)
  );
}
