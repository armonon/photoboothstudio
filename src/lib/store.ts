import { create } from "zustand";
import type { Scene, ModelType, FitStyle, View, BackgroundType, LightingPreset } from "@/lib/types";
import type { CustomPrint } from "@/lib/design";

/** Sensible starting placement for a freshly uploaded print (centered, upper-chest). */
const DEFAULT_CUSTOM_PRINT: Omit<CustomPrint, "assetUrl"> = { x: 0.5, y: 0.44, scale: 0.5, rotation: 0 };

interface StudioState extends Scene {
  /** The user's uploaded print artwork, composited onto the current view's region. */
  customPrint?: CustomPrint;
  setProduct: (productId: string) => void;
  setModelType: (m: ModelType) => void;
  setFit: (f: FitStyle) => void;
  setView: (v: View) => void;
  setBackground: (b: BackgroundType) => void;
  setCustomBackgroundUrl: (url?: string) => void;
  setLighting: (l: LightingPreset) => void;
  setCustomPrintUrl: (assetUrl: string) => void;
  updateCustomPrint: (patch: Partial<CustomPrint>) => void;
  clearCustomPrint: () => void;
}

export const useStudio = create<StudioState>((set) => ({
  productId: "",
  modelType: "neutralMannequin",
  fitStyle: "regular",
  view: "front",
  background: "white",
  lighting: "ecommerce",
  customPrint: undefined,
  setProduct: (productId) => set({ productId }),
  setModelType: (modelType) => set({ modelType }),
  setFit: (fitStyle) => set({ fitStyle }),
  setView: (view) => set({ view }),
  setBackground: (background) => set({ background }),
  setCustomBackgroundUrl: (customBackgroundUrl) => set({ customBackgroundUrl }),
  setLighting: (lighting) => set({ lighting }),
  setCustomPrintUrl: (assetUrl) =>
    set((state) => ({ customPrint: { ...DEFAULT_CUSTOM_PRINT, ...state.customPrint, assetUrl } })),
  updateCustomPrint: (patch) =>
    set((state) => (state.customPrint ? { customPrint: { ...state.customPrint, ...patch } } : {})),
  clearCustomPrint: () => set({ customPrint: undefined }),
}));
