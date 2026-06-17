import { Prisma, PrismaClient } from "@prisma/client";
import { seedPlates, seedProducts } from "@/lib/data/seed";
import type { ExportAsset, GarmentDesign, MannequinPlate, Scene } from "@/lib/types";

type Prismaish = PrismaClient;

const globalForPrisma = globalThis as unknown as { modelStudioPrisma?: Prismaish };

function databaseEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function prisma() {
  if (!databaseEnabled()) return null;
  globalForPrisma.modelStudioPrisma ??= new PrismaClient();
  return globalForPrisma.modelStudioPrisma;
}

function toDesign(row: any): GarmentDesign {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseColor: row.baseColor,
    fitStyle: row.fitStyle,
    prints: row.prints,
    mockupUrl: row.mockupUrl ?? undefined,
  };
}

function toPlate(row: any): MannequinPlate {
  return {
    id: row.id,
    garmentType: row.garmentType,
    view: row.view,
    fitStyle: row.fitStyle,
    modelType: row.modelType,
    baseImageUrl: row.baseImageUrl,
    recolorMaskUrl: row.recolorMaskUrl ?? undefined,
    regions: row.regions,
    width: row.width,
    height: row.height,
  };
}

function toAsset(row: any): ExportAsset {
  return {
    id: row.id,
    url: row.url,
    format: row.format,
    width: row.width,
    height: row.height,
    channel: row.channel,
    filename: row.filename ?? undefined,
    altText: row.altText ?? undefined,
    view: row.view ?? undefined,
    role: row.role ?? undefined,
  };
}

export async function getProducts(): Promise<GarmentDesign[]> {
  const db = prisma();
  if (!db) return seedProducts;

  const products = await db.garmentDesign.findMany({ orderBy: { createdAt: "desc" } });
  return products.map(toDesign);
}

export async function getProduct(productId: string): Promise<GarmentDesign | undefined> {
  const db = prisma();
  if (!db) return seedProducts.find((product) => product.id === productId);

  const product = await db.garmentDesign.findUnique({ where: { id: productId } });
  return product ? toDesign(product) : undefined;
}

export async function upsertProduct(input: GarmentDesign): Promise<GarmentDesign> {
  const db = prisma();
  if (!db) return input;

  const product = await db.garmentDesign.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      name: input.name,
      type: input.type,
      baseColor: input.baseColor,
      fitStyle: input.fitStyle,
      prints: input.prints as unknown as Prisma.InputJsonValue,
      mockupUrl: input.mockupUrl,
    },
    update: {
      name: input.name,
      type: input.type,
      baseColor: input.baseColor,
      fitStyle: input.fitStyle,
      prints: input.prints as unknown as Prisma.InputJsonValue,
      mockupUrl: input.mockupUrl,
    },
  });
  return toDesign(product);
}

export async function getPlates(): Promise<MannequinPlate[]> {
  const db = prisma();
  if (!db) return seedPlates;

  const plates = await db.mannequinPlate.findMany({ orderBy: { id: "asc" } });
  return plates.map(toPlate);
}

export async function getPlate(plateId: string): Promise<MannequinPlate | undefined> {
  const db = prisma();
  if (!db) return seedPlates.find((plate) => plate.id === plateId);

  const plate = await db.mannequinPlate.findUnique({ where: { id: plateId } });
  return plate ? toPlate(plate) : undefined;
}

export async function seedDatabaseFromLocalAssets() {
  const db = prisma();
  if (!db) return;

  await Promise.all(seedProducts.map((product) => upsertProduct(product)));
  await Promise.all(
    seedPlates.map((plate) =>
      db.mannequinPlate.upsert({
        where: { id: plate.id },
        create: {
          id: plate.id,
          garmentType: plate.garmentType,
          view: plate.view,
          fitStyle: plate.fitStyle,
          modelType: plate.modelType,
          baseImageUrl: plate.baseImageUrl,
          recolorMaskUrl: plate.recolorMaskUrl,
          regions: plate.regions as unknown as Prisma.InputJsonValue,
          width: plate.width,
          height: plate.height,
        },
        update: {
          garmentType: plate.garmentType,
          view: plate.view,
          fitStyle: plate.fitStyle,
          modelType: plate.modelType,
          baseImageUrl: plate.baseImageUrl,
          recolorMaskUrl: plate.recolorMaskUrl,
          regions: plate.regions as unknown as Prisma.InputJsonValue,
          width: plate.width,
          height: plate.height,
        },
      }),
    ),
  );
}

export async function createScene(scene: Scene) {
  const db = prisma();
  if (!db) return undefined;

  return db.scene.create({
    data: {
      productId: scene.productId,
      modelType: scene.modelType,
      fitStyle: scene.fitStyle,
      view: scene.view,
      background: scene.background,
      customBackgroundUrl: scene.customBackgroundUrl,
      lighting: scene.lighting,
    },
  });
}

export async function persistExportAssets(
  productId: string,
  sceneId: string | undefined,
  assets: ExportAsset[],
): Promise<ExportAsset[]> {
  const db = prisma();
  if (!db) return assets;

  const saved = await Promise.all(
    assets.map((asset) =>
      db.exportAsset.create({
        data: {
          garmentDesignId: productId,
          sceneId,
          url: asset.url,
          format: asset.format,
          width: asset.width,
          height: asset.height,
          channel: asset.channel,
          filename: asset.filename,
          altText: asset.altText,
          view: asset.view,
          role: asset.role,
        },
      }),
    ),
  );

  return saved.map(toAsset);
}
