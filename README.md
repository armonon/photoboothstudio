# Model Studio

Deterministic garment mockup studio — composite your **exact** print artwork onto blank
apparel mannequin plates, export product images + basic video, and push them to a Shopify
draft product. **No generative AI, no 3D, ~$0 per product.** It's a Printful/Printify-style
mockup generator you own end to end.

See `MODEL_STUDIO_GAME_PLAN.md` for the full plan and `BUILD_PROMPT.md` to hand the build to a coding agent.

## Run

```bash
npm install
cp .env.example .env   # fill in when you wire Shopify/storage/DB
npm run dev            # http://localhost:3000
```

Open the home page, click **Open in Model Studio** on a demo product. The control rail
(mannequin / fit / view / background / lighting) updates a `Scene`; the canvas calls the
composite engine. The engine and plate assets are stubbed — implement them next.

## Structure

```
src/
  app/
    page.tsx                     product list (entry point)
    studio/[productId]/page.tsx  the Model Studio tab
    api/products | export | shopify/attach   route stubs
  lib/
    types.ts                     data model (GarmentDesign, MannequinPlate, Scene, ExportAsset)
    composite/engine.ts          2.5D composite pipeline (IMPLEMENT THIS)
    composite/plates.ts          plate lookup
    store.ts                     Zustand scene state
    mock-data.ts                 demo product + plates
    shopify/client.ts            Admin API attach stub
  components/                    Studio, StudioCanvas, ControlRail, ExportDialog
public/plates/                   blank apparel plates go here
```

## Scope (locked)

In: tees/hoodies/crews/sweaters/long sleeves/shorts/sets; front/back/sleeve/leg prints;
neutral & product-only mannequins; front/back/side views; backgrounds + lighting overlays;
image, transparent PNG, listing-set, and ffmpeg video export; Shopify draft attach.

Out (optional future add-ons): photoreal human models, AI try-on, realistic 3D avatars,
custom brand avatar. The data model leaves room to switch these on later without a rewrite.
