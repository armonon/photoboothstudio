import { NextResponse } from "next/server";
import { getProducts, upsertProduct } from "@/lib/data";
import { ValidationError, parseGarmentDesign } from "@/lib/validation";

export async function GET() {
  const products = await getProducts();
  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  try {
    const product = parseGarmentDesign(await req.json());
    const saved = await upsertProduct(product);
    return NextResponse.json({ product: saved }, { status: 201 });
  } catch (err) {
    const status = err instanceof ValidationError ? 400 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save product" },
      { status },
    );
  }
}
