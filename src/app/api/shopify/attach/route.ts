import { NextResponse } from "next/server";
import { attachMediaToDraftProduct } from "@/lib/shopify/client";

export async function POST(req: Request) {
  const { productGid, assets } = await req.json();
  const attached = await attachMediaToDraftProduct(productGid, assets);
  return NextResponse.json({ attached });
}
