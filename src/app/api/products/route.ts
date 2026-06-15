import { NextResponse } from "next/server";
import { mockProducts } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ products: mockProducts });
}
