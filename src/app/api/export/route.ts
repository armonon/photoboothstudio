import { NextResponse } from "next/server";
import type { Scene, ExportAsset } from "@/lib/types";

export async function POST(req: Request) {
  const scene = (await req.json()) as Scene;

  // TODO: render server-side with @napi-rs/canvas (so export does not depend on the browser),
  //       build the Shopify product-listing set, and run ffmpeg for video/vertical crops.
  const assets: ExportAsset[] = [
    {
      url: `/exports/${scene.productId}-${scene.view}.png`,
      format: "png",
      width: 2048,
      height: 2048,
      channel: "shopify",
    },
  ];

  return NextResponse.json({ assets });
}
