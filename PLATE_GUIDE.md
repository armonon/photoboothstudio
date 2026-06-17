# Plate Guide — turning real blank photos into recolorable plates

Model Studio renders every product by compositing your art onto a **white base plate** and
recoloring it to any of the 28 colorways (`src/lib/colors.ts`). So for each garment **shape**
you only need **one clean photo of a white/light blank** — not one per color.

## What to give me (per garment shape)

One photo for each view you want (front is required; back/side optional):

- **A white or light-grey blank**, no print on it.
- **Shot straight-on**, flat-lay or on a ghost/invisible mannequin, garment filling most of the frame.
- **On a contrasting solid background** — mid-grey, light blue, or green screen — so the cutout
  keys cleanly. *White-on-white does not cut well deterministically.*
  - Already have a transparent-background PNG? Even better — use the `--premasked` flag and skip the keying.
- **Even, soft lighting.** Keep the natural fabric folds visible — they become the shadow + displacement maps.
- **High-res, roughly square, 2000px+.**

Cover the shapes you sell: `tshirt`, `longsleeve`, `tank`, `polo`, `hoodie`, `crewneck`,
`sweater`, `shorts`. (Your five blanks map to: LAT 3520 → tshirt, BC 3511 → longsleeve,
Gildan G520 → tank, Gildan G648L → polo, Shaka Active → tshirt.)

## How to ingest (per photo)

1. Drop the file in `public/plates/incoming/`.
2. Run:

   ```bash
   npx tsx scripts/ingest-plate.ts --in public/plates/incoming/your-photo.png \
     --garment tank --view front --color white --bg auto
   ```

   Add `--premasked` if the photo already has a transparent background. Override the print box
   with `--region cx,cy,w,h` (normalized to the garment), e.g. a polo's small left chest:
   `--region 0.34,0.30,0.18,0.18`.

3. It writes 4 assets to `public/plates/` and prints a **plate JSON** entry — paste it into your
   seed (`src/lib/data/seed.ts`) or DB. That garment is now live in all 28 colorways.

## Honest limits

- I **can't pull images off the retailer product pages** (Jiffy/Shaka) with my tools, and those
  colorways are dark anyway — you want **white** blanks. Provide your own photos or a white-blank
  mockup pack.
- The print region is auto-placed (chest); adjust per garment with `--region`.
- Deterministic cutout needs background contrast; for tricky shots, give me a transparent PNG.
