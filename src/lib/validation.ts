import type { CustomPrint } from "@/lib/design";
import type { GarmentDesign, PrintArt, Scene } from "@/lib/types";

/** Thrown when request input fails validation; routes map this to HTTP 400. */
export class ValidationError extends Error {}

// Runtime-checkable copies of the type unions in types.ts. Kept in sync by hand
// because TypeScript unions don't exist at runtime.
const VIEWS = ["front", "back", "side"] as const;
const MODEL_TYPES = ["neutralMannequin", "ghostMannequin", "croppedProductOnly", "facelessMannequin"] as const;
const FIT_STYLES = ["regular", "oversized", "cropped", "relaxed", "boxy", "streetwear"] as const;
const BACKGROUNDS = ["transparent", "white", "dark", "editorial", "concrete", "luxury", "custom"] as const;
const LIGHTINGS = ["softStudio", "dramatic", "highContrast", "ecommerce", "cinematic"] as const;
const GARMENT_TYPES = ["tshirt", "longsleeve", "tank", "polo", "hoodie", "crewneck", "sweater", "shorts", "set"] as const;
const PLACEMENTS = ["front", "back", "leftSleeve", "rightSleeve", "legL", "legR"] as const;

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError(`"${field}" must be an object`);
  }
  return value as Record<string, unknown>;
}

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`"${field}" must be a non-empty string`);
  }
  return value;
}

function num(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`"${field}" must be a finite number`);
  }
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(`"${field}" must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

/** A slug-safe id: usable as a single filesystem path segment without traversal. */
function id(value: unknown, field: string): string {
  const s = str(value, field);
  if (s.length > 100 || !SAFE_ID.test(s)) {
    throw new ValidationError(`"${field}" may only contain letters, numbers, "-" and "_"`);
  }
  return s;
}

/** An absolute public path ("/plates/x.png") with no traversal — safe to read from ./public. */
function publicPath(value: unknown, field: string): string {
  const s = str(value, field);
  if (!s.startsWith("/") || s.includes("..")) {
    throw new ValidationError(`"${field}" must be an absolute public path without ".."`);
  }
  return s;
}

/** An image source: an inline data: image (e.g. an upload) or a safe public path. */
function imageSource(value: unknown, field: string): string {
  const s = str(value, field);
  if (s.startsWith("data:image/")) return s;
  return publicPath(value, field);
}

function parsePrint(value: unknown, field: string): PrintArt {
  const o = asObject(value, field);
  return {
    placement: oneOf(o.placement, PLACEMENTS, `${field}.placement`),
    assetUrl: publicPath(o.assetUrl, `${field}.assetUrl`),
    x: num(o.x, `${field}.x`),
    y: num(o.y, `${field}.y`),
    scale: num(o.scale, `${field}.scale`),
    rotation: num(o.rotation, `${field}.rotation`),
  };
}

export function parseScene(input: unknown): Scene {
  const o = asObject(input, "scene");
  return {
    productId: id(o.productId, "productId"),
    modelType: oneOf(o.modelType, MODEL_TYPES, "modelType"),
    fitStyle: oneOf(o.fitStyle, FIT_STYLES, "fitStyle"),
    view: oneOf(o.view, VIEWS, "view"),
    background: oneOf(o.background, BACKGROUNDS, "background"),
    customBackgroundUrl:
      o.customBackgroundUrl == null ? undefined : imageSource(o.customBackgroundUrl, "customBackgroundUrl"),
    lighting: oneOf(o.lighting, LIGHTINGS, "lighting"),
  };
}

export function parseGarmentDesign(input: unknown): GarmentDesign {
  const o = asObject(input, "product");
  if (!Array.isArray(o.prints)) throw new ValidationError(`"prints" must be an array`);
  return {
    id: id(o.id, "id"),
    name: str(o.name, "name"),
    type: oneOf(o.type, GARMENT_TYPES, "type"),
    baseColor: str(o.baseColor, "baseColor"),
    fitStyle: oneOf(o.fitStyle, FIT_STYLES, "fitStyle"),
    prints: o.prints.map((print, i) => parsePrint(print, `prints[${i}]`)),
    mockupUrl: o.mockupUrl == null ? undefined : str(o.mockupUrl, "mockupUrl"),
  };
}

function parseCustomPrint(input: unknown): CustomPrint {
  const o = asObject(input, "customPrint");
  return {
    assetUrl: imageSource(o.assetUrl, "customPrint.assetUrl"),
    x: num(o.x, "customPrint.x"),
    y: num(o.y, "customPrint.y"),
    scale: num(o.scale, "customPrint.scale"),
    rotation: num(o.rotation, "customPrint.rotation"),
  };
}

/** The export request body: a Scene plus an optional uploaded print to composite in. */
export function parseExportRequest(input: unknown): { scene: Scene; customPrint?: CustomPrint } {
  const o = asObject(input, "body");
  return {
    scene: parseScene(o),
    customPrint: o.customPrint == null ? undefined : parseCustomPrint(o.customPrint),
  };
}
