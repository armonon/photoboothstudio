import type { Colorway } from "@/lib/types";

/**
 * Standard blank-apparel colorways. The studio renders any garment by recoloring
 * a single white base plate to one of these — so every colorway is ~free and instant.
 * `dark` flags fabrics that need a white underbase under printed artwork.
 */
export const COLORWAYS: Colorway[] = [
  { id: "white", name: "White", hex: "#FFFFFF" },
  { id: "natural", name: "Natural", hex: "#ECE4CF" },
  { id: "sand", name: "Sand", hex: "#D8C5A4" },
  { id: "athletic-heather", name: "Athletic Heather", hex: "#B4B6B9" },
  { id: "ash", name: "Ash", hex: "#CDCFCC" },
  { id: "charcoal", name: "Charcoal", hex: "#3C4146", dark: true },
  { id: "black", name: "Black", hex: "#161616", dark: true },
  { id: "navy", name: "Navy", hex: "#1F2740", dark: true },
  { id: "true-royal", name: "True Royal", hex: "#1E50A2", dark: true },
  { id: "sapphire", name: "Sapphire", hex: "#0F6FB3" },
  { id: "carolina", name: "Carolina Blue", hex: "#7FA8D8" },
  { id: "teal", name: "Teal", hex: "#1C6E6E", dark: true },
  { id: "mint", name: "Mint", hex: "#9ED9BE" },
  { id: "forest", name: "Forest", hex: "#213D2C", dark: true },
  { id: "kelly", name: "Kelly Green", hex: "#2C8A4B" },
  { id: "military", name: "Military Green", hex: "#565A48", dark: true },
  { id: "mustard", name: "Mustard", hex: "#D29B2C" },
  { id: "gold", name: "Gold", hex: "#ECB732" },
  { id: "orange", name: "Orange", hex: "#E2682A" },
  { id: "red", name: "Red", hex: "#C01F2E", dark: true },
  { id: "cardinal", name: "Cardinal", hex: "#8E2333", dark: true },
  { id: "maroon", name: "Maroon", hex: "#5C2030", dark: true },
  { id: "berry", name: "Berry", hex: "#71265A", dark: true },
  { id: "pink", name: "Pink", hex: "#F2A8C2" },
  { id: "coral", name: "Coral", hex: "#F2785C" },
  { id: "purple", name: "Purple", hex: "#5A2D86", dark: true },
  { id: "lavender", name: "Lavender", hex: "#BCA9D9" },
  { id: "brown", name: "Brown", hex: "#5A4632", dark: true },
];

export const colorwayById = (id: string): Colorway | undefined =>
  COLORWAYS.find((c) => c.id === id);
