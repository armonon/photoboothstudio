# Model Studio — Game Plan (Lean / deterministic)

**Show your garments on a simple mannequin with pixel-exact prints, export product images + basic video, and push them to Shopify — zero per-product cost, no AI.**

Date: 2026-06-15 · Status: scope locked · Type: greenfield (new project)

**Mental model:** your own Printful/Printify-style mockup generator, built in. Blank apparel plates + your exact print warped onto the print regions + recolor + background/lighting overlays → export → Shopify.

---

## Decisions locked (from our conversation)

- **No generative AI** — no photoreal humans, no AI try-on, no AI video.
- **No realistic 3D avatars.**
- **One engine: 2.5D composite** onto simple blank-mannequin plates.
- **~$0 per product.** Cost is one-time (base plates + build), not per output.
- Photoreal humans / 3D / custom brand avatar are **optional future add-ons, off by default** — cleanly decoupled so we're never locked out.

---

## 1. The core bet: exact-print fidelity (now automatic)

The whole value of a print product is the *exact* print — placement, scale, colors, fine text and logos. Because this engine only ever **composites** your locked art onto a garment region (never regenerates it), fidelity is automatic and free. There's no model that can "drift" your logo. This was the hardest problem in the AI version; cutting AI makes it disappear.

## 2. The engine: 2.5D composite

For each garment type and view we have a **blank apparel plate** — a neutral tee/hoodie/crew/etc. on a simple mannequin (or flat/ghost form). Each plate defines **print regions** (front, back, left/right sleeve, left/right leg) as warp meshes with a baked displacement + shadow map. To render:

1. Recolor the blank garment to the chosen base color (multiply/hue layer).
2. Warp the user's exact print onto each region's mesh so it follows folds.
3. Blend with displacement + the plate's shadow map for realistic drape.
4. Composite onto the chosen background; apply a lighting-preset overlay/LUT.

Result: pixel-exact prints, instant, rendered locally, **$0 per output**, perfectly repeatable. This is exactly how POD mockup generators work — proven, cheap, and trustworthy for live PDPs.

## 3. Where base plates come from (one-time)

You need a small library of blank apparel plates (per garment type × view × maybe color). Cheapest sourcing, in order:

- **Buy a blank-apparel mockup pack** (front/back, neutral mannequin, transparent bg) — fastest, a few dollars.
- **Render a simple gray 3D mannequin once** to generate consistent front/back/side/angle plates with clean alpha — most flexible for adding angles later, and *not* a realistic avatar (just a plain form used as a plate factory).
- **Shoot a real dress form once** — if you want your own look.

Recommendation: start with a bought tee + hoodie pack to ship, add a one-time gray-mannequin render set when you want more angles.

## 4. Scope — in vs. cut

**In (core, $0/product):**

- Garments: t-shirts, hoodies, crewnecks, sweaters, long sleeves, shorts, matching sets.
- Prints: front, back, sleeve, shorts-leg — color, placement, scale all preserved exactly.
- Models: neutral mannequin, cropped/product-only mannequin, faceless mannequin form.
- Fit look: regular / oversized / cropped / relaxed / boxy / streetwear — expressed by which blank plate you composite onto (a plate per fit), not by physics.
- Views: front, back, side — one plate per view.
- Backgrounds: transparent PNG, white/dark/studio colors, editorial/concrete/luxury backdrops (image layers), custom uploaded background.
- Lighting: preset overlays/LUTs (soft studio, dramatic, high-contrast, ecommerce, cinematic) — compositing, not physical simulation.
- Exports: front/back/side images, transparent PNG, product-listing set, Shopify-ready set, basic rotating/zoom video (ffmpeg pan/crossfade across plates), vertical 9:16 crop for TikTok/Reels.
- Shopify: attach exported assets to the draft product via Admin API.

**Cut → optional future add-ons (off by default):**

- Realistic human models, male/female photoreal, oversized-streetwear *human*.
- AI Model Image Mode (feature 10).
- Realistic 3D avatars + true free-spin 3D mode (feature 11) — a *simple* 3D mannequin could return later just for free 360, if wanted.
- Custom brand avatar/mascot (feature 9).
- Premium AI video; physically-simulated lighting.

## 5. Stack (lean)

Next.js (App Router, TS) + Tailwind + shadcn/ui · Canvas/WebGL compositing (PixiJS or plain canvas) · ffmpeg worker for video/crops · Postgres free tier (Supabase/Neon) · Cloudflare R2 storage (zero egress) · Shopify Admin GraphQL API.

No React Three Fiber, no GPU, no AI keys, no per-call providers, and the job queue is optional (compositing is instant and local; only video assembly needs a short-lived worker).

## 6. Data model (trimmed)

- **GarmentDesign** — `type`, `baseColor`, `fitStyle`, and `prints[]`: `{ placement: front|back|leftSleeve|rightSleeve|legL|legR, assetUrl, x, y, scale, rotation }`. The locked-art record.
- **MannequinPlate** — `{ garmentType, view: front|back|side, fitStyle, baseImageUrl, recolorMask, regions[]: { placement, warpMesh, displacementMap, shadowMap } }`. The reusable base.
- **Scene** — `{ productId, plateSet, background, lighting, view }`. The reproducible recipe.
- **ExportAsset** — `{ url, format, dimensions, channel: shopify|tiktok|reels, shopifyMediaId }`.

(No RenderJob/provider/AI-QA entities — nothing to bill or verify.)

## 7. Export & Shopify

Images: front/back/side, transparent PNG, and a product-listing set at Shopify sizes (1:1 ~2048px hero + variants) with alt text and clean filenames. Video: ffmpeg pan/zoom/crossfade across the plates → short rotating/product clip and a 9:16 vertical crop — all $0. Handoff: staged upload → `productCreateMedia` attaches assets to the **draft** product; store `shopifyMediaId` to avoid dupes. Closes your flow: create product → Open in Model Studio → pick mannequin/background/lighting/view → preview → export → attach to Shopify.

## 8. Studio tab UX

Entry: "Open in Model Studio" on each product. Center: live composite preview + Front/Back/Side view tabs. Right rail: Mannequin → Fit → Background → Lighting → Export. No engine toggle, no AI label — one deterministic path.

## 9. Roadmap (lean)

| Phase | Ships | Effort* |
|---|---|---|
| **0** | Scaffold, data model, product import, asset storage (R2), Shopify app connect | ~1 wk |
| **1** | Composite engine + tee plates (front/back) + recolor + transparent PNG + Shopify push | 1–2 wks |
| **2** | All garment types + sleeve/leg prints + backgrounds + lighting overlays + product-listing set | ~2 wks |
| **3** | Side/extra views + basic rotating/zoom + 9:16 video via ffmpeg | ~1 wk |
| **Future** | (optional) simple 3D mannequin for free 360; AI add-on for photoreal humans | — |

*Assumes ~1 engineer. No GPU, no model training, no provider integration to slow you down.

## 10. Cost

One-time: blank-plate pack (a few dollars) or a one-time gray-mannequin render + your build time. Ongoing: **~$0 per product** — composite and ffmpeg run on your own box. Infra fits free tiers (Vercel hobby, Neon/Supabase free, R2 zero-egress). The only way costs reappear is if you later switch on the optional AI add-on.

## 11. Spec coverage

| Spec feature | Status |
|---|---|
| Garment-on-model preview (color, placement, scale, F/B/sleeve/leg prints, fit) | In — composite |
| Fit preview (oversized/regular/cropped/relaxed/boxy/streetwear) | In — one plate per fit |
| Pose selector | Partial — limited to plates you make (no walking/seated unless shot) |
| Model rotation, 360 | Partial — front/back/side plates; true free-spin = optional 3D later |
| Backgrounds (7) + custom upload · Lighting (5) | In — compositing layers/LUTs |
| Export: F/B/side, transparent PNG, listing set, Shopify set | In |
| Export: short/rotating/vertical video | In — ffmpeg across plates |
| Export: true 360 spin | Optional later (needs more plates or simple 3D) |
| Model library (mannequin, cropped/product-only, faceless) | In |
| Model library (realistic human, male/female, oversized human) | Cut → optional AI add-on |
| AI Model Image Mode (10) · 3D realistic mode (11) · custom brand avatar (9) | Cut → optional future |

## 12. Risks

- **Plate coverage** — every view/fit/garment needs a plate; mitigate by starting with tee+hoodie front/back and expanding. *The main ongoing work.*
- **Fold realism** — flat composites can look pasted; mitigate with good displacement + shadow maps baked into each plate.
- **Shopify media constraints** — validate dimensions/format/count before push.

## 13. Next steps (week 1)

1. Scaffold the Next.js + TS + Tailwind project (this folder) + Postgres + R2.
2. Implement `GarmentDesign` + `MannequinPlate` models and a product picker with "Open in Model Studio."
3. Get one blank tee plate (front + back) with a defined chest/back print region.
4. Build the warp-composite + recolor for that region and render a transparent PNG.
5. Wire the Shopify "attach to draft" call.

That thin slice proves the whole loop. Everything after is more plates and more export formats.

---

*Supersedes the earlier AI-heavy draft. Photoreal humans, 3D, and custom avatars remain documented above as optional add-ons so they can be switched on later without re-architecting.*
