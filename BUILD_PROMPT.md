# Build Prompt — Model Studio

Paste this into your coding agent (Claude Code, Cursor, etc.) to implement the app on top of
this scaffold. It encodes the locked scope; do not expand it without being asked.

---

You are implementing **Model Studio**, a Next.js (App Router, TypeScript) app that produces
garment product images by compositing a user's **exact** print artwork onto blank apparel
mannequin plates. Think Printful/Printify mockup generator. Build on the existing scaffold.

## Hard constraints — do not violate
- **No generative AI** anywhere: no try-on models, no image/video diffusion, no LLM image
  calls, no third-party "AI photo" APIs. Everything is deterministic compositing + ffmpeg.
- **No 3D / no React Three Fiber.** 2D canvas only.
- **Prints are never regenerated** — only loaded, positioned, warped, and blended. Pixel-exact
  print fidelity is the entire value of the product.
- **~$0 per product.** All rendering runs locally (browser canvas and/or server via
  `@napi-rs/canvas` + `ffmpeg`). No paid per-call services.
- Everything stays typed against `src/lib/types.ts`.

## Implement, in order

1. **Composite engine** (`src/lib/composite/engine.ts`) — fill the four stubbed stages:
   - `compositeBackground` — transparent (no fill) | solid color | backdrop image, per
     `Scene.background` (+ `customBackgroundUrl`).
   - `drawRecoloredGarment` — draw `plate.baseImageUrl`, then multiply-tint to
     `design.baseColor` **within the recolor mask only**.
   - `warpPrintOntoRegion` — load `print.assetUrl`; place by `x/y/scale/rotation`; warp using
     `region.warpMesh` (start with a 4-point perspective transform, improve to a mesh warp);
     multiply by `shadowMap` and offset by `displacementMap` so the print follows folds.
   - `applyLighting` — apply a per-preset LUT/overlay for each `LightingPreset`.
   Keep render order: background → garment → prints → lighting.

2. **Plate assets** — add at least a blank tee (front + back), 2048², neutral mannequin,
   transparent bg, with defined chest/back print regions + baked shadow maps. Put them in
   `public/plates/` and register in `src/lib/mock-data.ts`.

3. **Transparent PNG export** end to end (canvas → download).

4. **Server export** (`src/app/api/export/route.ts`) with `@napi-rs/canvas` so exports don't
   depend on the browser. Generate the **Shopify product-listing set** (1:1 2048 hero +
   variants) with alt text and clean filenames.

5. **Video export** — an ffmpeg step that pans/zooms/crossfades across the available view
   plates into a short MP4 plus a 9:16 vertical crop for TikTok/Reels.

6. **Shopify attach** (`src/lib/shopify/client.ts`) — `stagedUploadsCreate` → PUT bytes →
   `productCreateMedia` against the DRAFT product; persist returned media IDs onto the assets.

7. **Persistence** — replace mock data with Postgres + Prisma for `GarmentDesign`,
   `MannequinPlate`, `Scene`, `ExportAsset`; import products from the creation workflow.

8. **Control rail depth** — per-fit plates, all backgrounds and lighting presets, and
   Front/Back/Side as plate switches.

## Acceptance criteria
- Changing mannequin/fit/background/lighting/view updates the preview live, with the print
  pixel-identical to the source art (no color, scale, or position drift).
- Export produces front/back/side PNGs, a transparent PNG, a Shopify-ready set, and a short +
  9:16 video.
- "Attach to Shopify draft" puts the assets on the draft product.
- Grep proves it: **zero** network calls to any AI provider in the codebase.

## Pointers
- Read `MODEL_STUDIO_GAME_PLAN.md` for full context and scope.
- Server image ops: `@napi-rs/canvas` + `sharp`. Video: `ffmpeg` (e.g. via `fluent-ffmpeg`).
- Storage: Cloudflare R2 (zero egress). DB: Neon/Supabase free tier.
