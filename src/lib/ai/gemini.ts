import type { EnhanceInput, EnhanceResult, ImageEnhancer } from "@/lib/ai/enhance";

const DEFAULT_MODEL = "gemini-2.5-flash-image";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Google Gemini image model ("Nano Banana") as an ImageEnhancer.
 * Reads GEMINI_API_KEY (required) and GEMINI_IMAGE_MODEL (optional override).
 */
export function geminiEnhancer(): ImageEnhancer {
  return {
    async enhance({ imageBase64, mimeType, instruction }: EnhanceInput): Promise<EnhanceResult> {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set. Add it to .env to enable the enhancer.");
      }
      const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;

      const res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: instruction }, { inlineData: { mimeType, data: imageBase64 } }] },
          ],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });

      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(`Gemini error ${res.status}: ${json?.error?.message ?? JSON.stringify(json)}`);
      }

      const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        const inline = part.inlineData ?? part.inline_data;
        if (inline?.data) {
          return { imageBase64: inline.data, mimeType: inline.mimeType ?? inline.mime_type ?? "image/png" };
        }
      }

      // No image came back — surface any text (often a refusal or safety explanation).
      const text = parts.map((p) => p?.text).filter(Boolean).join(" ").trim();
      const finish = json?.candidates?.[0]?.finishReason;
      throw new Error(text || `Gemini returned no image${finish ? ` (finishReason: ${finish})` : ""}.`);
    },
  };
}
