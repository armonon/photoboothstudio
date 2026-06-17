import { getStore } from "@netlify/blobs";
import { buildInstruction, normalizeOptions } from "../../src/lib/ai/enhance";

// A Netlify *background* function (the "-background" suffix): returns 202 immediately
// and may run up to 15 minutes — long enough for image generation that would blow
// past a normal serverless function's ~10s timeout. The browser polls enhance-status
// for the result, which we stash in Netlify Blobs keyed by jobId.
export default async (req: Request) => {
  const store = getStore("enhance-jobs");
  let jobId = "";
  try {
    const body = await req.json();
    jobId = String(body?.jobId ?? "");
    if (!jobId) return;

    const { mimeType, base64 } = splitDataUrl(String(body?.imageDataUrl ?? ""));
    const instruction = buildInstruction(normalizeOptions(body?.options));
    const resultDataUrl = await callGemini(base64, mimeType, instruction);
    await store.setJSON(jobId, { status: "done", resultDataUrl });
  } catch (err) {
    if (jobId) {
      await store.setJSON(jobId, { status: "error", error: err instanceof Error ? err.message : "Failed" });
    }
  }
};

function splitDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("imageDataUrl must be a data:image/* URL.");
  const [, mimeType, isBase64, payload] = match;
  return { mimeType, base64: isBase64 ? payload : Buffer.from(decodeURIComponent(payload)).toString("base64") };
}

// Self-contained Gemini call (kept in sync with src/lib/ai/gemini.ts) so the function
// bundles cleanly without the "@/" path alias.
async function callGemini(imageBase64: string, mimeType: string, instruction: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: instruction }, { inlineData: { mimeType, data: imageBase64 } }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });

  const json: { candidates?: { content?: { parts?: { text?: string; inlineData?: { data?: string; mimeType?: string } }[] } }[]; error?: { message?: string } } =
    await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${json?.error?.message ?? "unknown error"}`);

  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
    }
  }
  const text = parts.map((p) => p.text).filter(Boolean).join(" ").trim();
  throw new Error(text || "Gemini returned no image.");
}
