Generated deterministic plate assets live here:
  tee-{view}-{fit}-{modelType}.png
  tee-{view}-{fit}-mask.png
  tee-{view}-{fit}-shadow.png
  tee-{view}-{fit}-displacement.png
  backdrop-{editorial|concrete|luxury}.png

Regenerate them with:
  npm run generate:plates

Register plate metadata in src/lib/data/seed.ts or in Postgres via Prisma.
