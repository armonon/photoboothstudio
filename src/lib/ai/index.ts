import { geminiEnhancer } from "@/lib/ai/gemini";
import type { ImageEnhancer } from "@/lib/ai/enhance";

/**
 * Resolve the configured image enhancer. Provider-agnostic so a different model
 * (OpenAI, FLUX, etc.) can be added here without touching the route or UI.
 */
export function getEnhancer(): ImageEnhancer {
  const provider = (process.env.IMAGE_AI_PROVIDER ?? "gemini").toLowerCase();
  switch (provider) {
    case "gemini":
      return geminiEnhancer();
    default:
      throw new Error(`Unknown IMAGE_AI_PROVIDER "${provider}". Supported: gemini.`);
  }
}
