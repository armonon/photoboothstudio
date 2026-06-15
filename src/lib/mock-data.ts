import type { GarmentDesign, MannequinPlate } from "@/lib/types";

// Placeholder data so the UI runs before plates + DB exist.
export const mockProducts: GarmentDesign[] = [
  {
    id: "demo-tee",
    name: "Demo Tee — Front Logo",
    type: "tshirt",
    baseColor: "#1a1a1a",
    fitStyle: "regular",
    prints: [
      { placement: "front", assetUrl: "/plates/sample-print.png", x: 0.5, y: 0.4, scale: 0.4, rotation: 0 },
    ],
  },
  {
    id: "demo-hoodie",
    name: "Demo Hoodie — Back Print",
    type: "hoodie",
    baseColor: "#2b2b2b",
    fitStyle: "oversized",
    prints: [
      { placement: "back", assetUrl: "/plates/sample-print.png", x: 0.5, y: 0.45, scale: 0.6, rotation: 0 },
    ],
  },
];

export const mockPlates: MannequinPlate[] = [
  {
    id: "tee-front-regular",
    garmentType: "tshirt",
    view: "front",
    fitStyle: "regular",
    modelType: "neutralMannequin",
    baseImageUrl: "/plates/tee-front.png",
    regions: [{ placement: "front", warpMesh: [] }],
    width: 2048,
    height: 2048,
  },
  {
    id: "tee-back-regular",
    garmentType: "tshirt",
    view: "back",
    fitStyle: "regular",
    modelType: "neutralMannequin",
    baseImageUrl: "/plates/tee-back.png",
    regions: [{ placement: "back", warpMesh: [] }],
    width: 2048,
    height: 2048,
  },
];
