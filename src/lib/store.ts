import { create } from "zustand";
import type { Scene, ModelType, FitStyle, View, BackgroundType, LightingPreset } from "@/lib/types";

interface StudioState extends Scene {
  setProduct: (productId: string) => void;
  setModelType: (m: ModelType) => void;
  setFit: (f: FitStyle) => void;
  setView: (v: View) => void;
  setBackground: (b: BackgroundType) => void;
  setLighting: (l: LightingPreset) => void;
}

export const useStudio = create<StudioState>((set) => ({
  productId: "",
  modelType: "neutralMannequin",
  fitStyle: "regular",
  view: "front",
  background: "white",
  lighting: "ecommerce",
  setProduct: (productId) => set({ productId }),
  setModelType: (modelType) => set({ modelType }),
  setFit: (fitStyle) => set({ fitStyle }),
  setView: (view) => set({ view }),
  setBackground: (background) => set({ background }),
  setLighting: (lighting) => set({ lighting }),
}));
