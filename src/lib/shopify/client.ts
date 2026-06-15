import type { ExportAsset } from "@/lib/types";

/**
 * Attach exported assets to a Shopify DRAFT product.
 *
 * Flow (Admin GraphQL API):
 *   1. stagedUploadsCreate  -> get signed upload targets
 *   2. PUT the bytes to each signed URL
 *   3. productCreateMedia   -> attach the uploaded files to the product
 *
 * Requires SHOPIFY_SHOP + SHOPIFY_ADMIN_TOKEN in .env.
 */
export async function attachMediaToDraftProduct(
  productGid: string,
  assets: ExportAsset[],
): Promise<ExportAsset[]> {
  // TODO: implement the three GraphQL calls above and set asset.shopifyMediaId.
  void productGid;
  return assets;
}
