import type {
  FitStyle,
  GarmentDesign,
  MannequinPlate,
  ModelType,
  PlateRegion,
  PrintPlacement,
  View,
} from "@/lib/types";

const fitStyles: FitStyle[] = ["regular", "oversized", "cropped", "relaxed", "boxy", "streetwear"];
const modelTypes: ModelType[] = ["neutralMannequin", "ghostMannequin", "croppedProductOnly", "facelessMannequin"];
const views: View[] = ["front", "back", "side"];

const fitScale: Record<FitStyle, number> = {
  regular: 1,
  oversized: 1.13,
  cropped: 0.9,
  relaxed: 1.06,
  boxy: 1.1,
  streetwear: 1.18,
};

const regionPlacement: Record<View, PrintPlacement> = {
  front: "front",
  back: "back",
  side: "leftSleeve",
};

function regionFor(view: View, fitStyle: FitStyle): PlateRegion {
  const scale = fitScale[fitStyle];
  const width = view === "side" ? 360 * scale : 680 * scale;
  const height = view === "side" ? 560 * scale : 760 * (fitStyle === "cropped" ? 0.82 : 1);
  const centerX = view === "side" ? 1088 : 1024;
  const y = view === "side" ? 660 : fitStyle === "cropped" ? 600 : 610;
  const x = centerX - width / 2;
  const skew = view === "front" ? 28 : view === "back" ? -20 : 44;
  const bow = view === "side" ? 34 : 18;

  return {
    placement: regionPlacement[view],
    bounds: { x, y, width, height },
    warpMesh: [
      [x + Math.max(skew, 0), y + bow],
      [x + width + Math.min(skew, 0), y],
      [x + width - Math.max(skew, 0), y + height - bow],
      [x - Math.min(skew, 0), y + height],
    ],
    displacementMapUrl: `/plates/tee-${view}-${fitStyle}-displacement.png`,
    shadowMapUrl: `/plates/tee-${view}-${fitStyle}-shadow.png`,
  };
}

export const seedProducts: GarmentDesign[] = [
  {
    id: "demo-tee",
    name: "Demo Tee - Exact Art Set",
    type: "tshirt",
    baseColor: "#f4f0e8",
    fitStyle: "regular",
    prints: [
      { placement: "front", assetUrl: "/plates/sample-print.png", x: 0.5, y: 0.44, scale: 0.48, rotation: 0 },
      { placement: "back", assetUrl: "/plates/sample-print-back.png", x: 0.5, y: 0.48, scale: 0.58, rotation: 0 },
      { placement: "leftSleeve", assetUrl: "/plates/sample-sleeve-print.png", x: 0.5, y: 0.42, scale: 0.62, rotation: 90 },
    ],
  },
  {
    id: "demo-black-tee",
    name: "Demo Tee - Dark Variant",
    type: "tshirt",
    baseColor: "#18191c",
    fitStyle: "oversized",
    prints: [
      { placement: "front", assetUrl: "/plates/sample-print.png", x: 0.5, y: 0.42, scale: 0.5, rotation: 0 },
      { placement: "back", assetUrl: "/plates/sample-print-back.png", x: 0.5, y: 0.48, scale: 0.55, rotation: 0 },
    ],
  },
];

export const seedPlates: MannequinPlate[] = fitStyles.flatMap((fitStyle) =>
  modelTypes.flatMap((modelType) =>
    views.map((view) => ({
      id: `tee-${view}-${fitStyle}-${modelType}`,
      garmentType: "tshirt",
      view,
      fitStyle,
      modelType,
      baseImageUrl: `/plates/tee-${view}-${fitStyle}-${modelType}.png`,
      recolorMaskUrl: `/plates/tee-${view}-${fitStyle}-mask.png`,
      regions: [regionFor(view, fitStyle)],
      width: 2048,
      height: 2048,
    })),
  ),
);

export const seedPlateIds = seedPlates.map((plate) => plate.id);
