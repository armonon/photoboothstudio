# Model Studio

Deterministic garment mockup studio — composite your **exact** print artwork onto blank
apparel mannequin plates and export product images + basic video. **No generative AI,
no 3D, ~$0 per product.** It's a Printful/Printify-style mockup generator you own end to end.

See `MODEL_STUDIO_GAME_PLAN.md` for the full plan and `BUILD_PROMPT.md` to hand the build to a coding agent.

## Run

```bash
npm install
cp .env.example .env   # fill in when you wire storage/DB
npm run dev            # http://localhost:3000
```

Open the home page, click **Open in Model Studio** on a demo product. The control rail
(mannequin / fit / view / background / lighting) updates a `Scene`; the canvas calls the
deterministic composite engine and redraws the live mockup.

Useful scripts:

```bash
npm run generate:plates  # regenerate local deterministic tee plates/maps/backdrops
npm run prisma:generate  # regenerate Prisma client
npm run db:push          # push the Prisma schema to Postgres when DATABASE_URL is set
npm run typecheck
npm run build
```

## Structure

```
src/
  app/
    page.tsx                     product list (entry point)
    studio/[productId]/page.tsx  the Model Studio tab
    api/products | export         route stubs
  lib/
    types.ts                     data model (GarmentDesign, MannequinPlate, Scene, ExportAsset)
    composite/engine.ts          browser wrapper for the 2.5D composite pipeline
    composite/core.ts            shared deterministic canvas renderer
    composite/server.ts          @napi-rs/canvas server adapter
    composite/plates.ts          plate lookup
    store.ts                     Zustand scene state
    data.ts                      Prisma-backed data access with local seeded fallback
    data/seed.ts                 deterministic seed product + plate catalog
  components/                    Studio, StudioCanvas, ControlRail, ExportDialog
public/plates/                   generated blank tee plates, masks, maps, backdrops
prisma/schema.prisma             GarmentDesign/MannequinPlate/Scene/ExportAsset persistence
```

## Scope (locked)

In: tees/hoodies/crews/sweaters/long sleeves/shorts/sets; front/back/sleeve/leg prints;
neutral & product-only mannequins; front/back/side views; backgrounds + lighting overlays;
image, transparent PNG, listing-set, and ffmpeg video export.

Out (optional future add-ons): photoreal human models, AI try-on, realistic 3D avatars,
custom brand avatar. The data model leaves room to switch these on later without a rewrite.
