import { NextResponse } from "next/server";
import { getEnhancer } from "@/lib/ai";
import { buildInstruction, normalizeOptions } from "@/lib/ai/enhance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Image generation can take a while; give it room.
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
    if (!imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "imageDataUrl must be a data:image/* URL." }, { status: 400 });
    }

    const { mimeType, base64 } = splitDataUrl(imageDataUrl);
    const options = normalizeOptions(body?.options);

    const result = await getEnhancer().enhance({
      imageBase64: base64,
      mimeType,
      instruction: buildInstruction(options),
    });

    // Return the image to the client, which handles saving/zipping. Keeps this route
    // stateless so it works the same locally and on serverless hosts (Netlify).
    return NextResponse.json({ resultDataUrl: `data:${result.mimeType};base64,${result.imageBase64}` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to enhance image." },
      { status: 500 },
    );
  }
}

function splitDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Malformed data URL.");
  const [, mimeType, isBase64, payload] = match;
  const base64 = isBase64 ? payload : Buffer.from(decodeURIComponent(payload)).toString("base64");
  return { mimeType, base64 };
}
