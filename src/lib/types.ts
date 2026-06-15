// Core data model for Model Studio — deterministic, AI-free mockup generation.

export type GarmentType =
  | "tshirt" | "hoodie" | "crewneck" | "sweater" | "longsleeve" | "shorts" | "set";

export type PrintPlacement =
  | "front" | "back" | "leftSleeve" | "rightSleeve" | "legL" | "legR";

export type FitStyle =
  | "regular" | "oversized" | "cropped" | "relaxed" | "boxy" | "streetwear";

// AI-free: only mannequin/product forms. Photoreal humans are an optional future add-on.
export type ModelType = "neutralMannequin" | "croppedProductOnly" | "facelessMannequin";

export type BackgroundType =
  | "transparent" | "white" | "dark" | "editorial" | "concrete" | "luxury" | "custom";

export type LightingPreset =
  | "softStudio" | "dramatic" | "highContrast" | "ecommerce" | "cinematic";

export type View = "front" | "back" | "side";
export type ExportChannel = "shopify" | "tiktok" | "reels";

/** A single piece of print artwork, placed on one garment region. Never regenerated. */
export interface PrintArt {
  placement: PrintPlacement;
  assetUrl: string;
  x: number;        // normalized 0..1 within the region
  y: number;        // normalized 0..1 within the region
  scale: number;    // relative to region size
  rotation: number; // degrees
}

/** The locked design record — the source of truth for what actually ships. */
export interface GarmentDesign {
  id: string;
  name: string;
  type: GarmentType;
  baseColor: string; // hex
  fitStyle: FitStyle;
  prints: PrintArt[];
  mockupUrl?: string;
}

/** A print region on a plate, with maps that make a flat print follow folds. */
export interface PlateRegion {
  placement: PrintPlacement;
  warpMesh: number[][];      // control points for perspective/mesh warp
  displacementMapUrl?: string;
  shadowMapUrl?: string;
}

/** A reusable blank-apparel plate (the thing we composite onto). */
export interface MannequinPlate {
  id: string;
  garmentType: GarmentType;
  view: View;
  fitStyle: FitStyle;
  modelType: ModelType;
  baseImageUrl: string;
  recolorMaskUrl?: string;   // limits recolor to the garment pixels
  regions: PlateRegion[];
  width: number;
  height: number;
}

/** The reproducible recipe for one rendered shot. */
export interface Scene {
  productId: string;
  modelType: ModelType;
  fitStyle: FitStyle;
  view: View;
  background: BackgroundType;
  customBackgroundUrl?: string;
  lighting: LightingPreset;
}

export interface ExportAsset {
  url: string;
  format: "png" | "jpg" | "mp4";
  width: number;
  height: number;
  channel: ExportChannel;
  shopifyMediaId?: string;
}
