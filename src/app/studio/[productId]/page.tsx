import Studio from "@/components/Studio";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return <Studio productId={productId} />;
}
