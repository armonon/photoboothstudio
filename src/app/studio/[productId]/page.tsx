import Studio from "@/components/Studio";
import { getPlates, getProduct } from "@/lib/data";
import { notFound } from "next/navigation";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const product = await getProduct(productId);
  if (!product) notFound();

  const plates = await getPlates();
  return <Studio product={product} plates={plates} />;
}
