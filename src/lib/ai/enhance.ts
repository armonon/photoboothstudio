// Provider-agnostic contract for turning an uploaded garment photo into a polished
// product shot. Swap the underlying model by adding another ImageEnhancer in ./index.

export interface EnhanceInput {
  imageBase64: string;
  mimeType: string;
  instruction: string;
}

export interface EnhanceResult {
  imageBase64: string;
  mimeType: string;
}

export interface ImageEnhancer {
  enhance(input: EnhanceInput): Promise<EnhanceResult>;
}

export type BackgroundStyle = "studioWhite" | "softGrey" | "editorial" | "lifestyle" | "keepOriginal";
export type Framing = "keep" | "flatLay" | "ghostMannequin";

export interface EnhanceOptions {
  background: BackgroundStyle;
  framing: Framing;
  notes?: string;
}

const BACKGROUND_STYLES: BackgroundStyle[] = ["studioWhite", "softGrey", "editorial", "lifestyle", "keepOriginal"];
const FRAMINGS: Framing[] = ["keep", "flatLay", "ghostMannequin"];

/** Coerce untrusted request input into a valid options object with safe defaults. */
export function normalizeOptions(raw: unknown): EnhanceOptions {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    background: BACKGROUND_STYLES.includes(o.background as BackgroundStyle)
      ? (o.background as BackgroundStyle)
      : "studioWhite",
    framing: FRAMINGS.includes(o.framing as Framing) ? (o.framing as Framing) : "keep",
    notes: typeof o.notes === "string" && o.notes.trim() ? o.notes.trim().slice(0, 500) : undefined,
  };
}

const BACKGROUND_PROMPT: Record<BackgroundStyle, string> = {
  studioWhite:
    "Place the garment on a seamless pure white (#ffffff) studio background, like a premium e-commerce hero image, with a very soft natural contact shadow.",
  softGrey:
    "Place the garment on a seamless soft light-grey studio background with a subtle, realistic floor shadow.",
  editorial:
    "Place the garment in a tasteful, minimal editorial setting with soft neutral tones and gentle directional light. Keep it understated so the product stays the hero.",
  lifestyle:
    "Place the garment in a clean, aspirational lifestyle setting appropriate to the item, with the surroundings softly out of focus so the product stays the clear hero.",
  keepOriginal:
    "Keep the original background but clean it up: remove clutter and distractions, even out the lighting, and make it look professionally shot.",
};

const FRAMING_PROMPT: Record<Framing, string> = {
  keep: "Keep the garment's original orientation (e.g. if it is laid flat, keep it flat; if it is on a form, keep that), just cleaned up and well composed.",
  flatLay:
    "Present the garment as a clean, neatly arranged top-down flat-lay, perfectly centered and symmetrical.",
  ghostMannequin:
    "Present the garment as a 3D 'ghost mannequin' / invisible-mannequin shot: shaped as if worn by an invisible person, with natural volume and a hollow neckline that shows the inside back collar. No visible mannequin, body, or hanger.",
};

/**
 * Build the edit instruction. The dominant rule is product fidelity — the model may
 * restyle the *photography* but must never alter the garment's design, color, or printed art.
 */
export function buildInstruction(options: EnhanceOptions): string {
  const lines = [
    "You are a professional product photographer and retoucher. Transform the provided photo of a garment into a clean, high-end e-commerce product image.",
    "",
    "CRITICAL — preserve the product exactly: keep the garment's exact shape, cut, color, fabric, and every print, graphic, logo, and piece of text EXACTLY as in the original photo. Do not add, remove, redesign, restyle, recolor, or re-letter anything on the garment itself. It must stay identical and recognizable — only the photography (background, lighting, cleanliness, framing) may change. Never invent text or artwork.",
    "",
    "Make it look professionally shot: sharp focus, true-to-life color, soft even studio lighting, natural fabric drape, no harsh shadows, no distracting creases, no color casts. Remove hands, hangers, faces, reflections, watermarks, and background clutter. Keep the garment straight, centered, and nicely filling the frame with a little margin. Output a square, high-resolution image.",
    "",
    BACKGROUND_PROMPT[options.background],
    FRAMING_PROMPT[options.framing],
  ];
  if (options.notes) lines.push("", `Additional art direction (does not override product fidelity): ${options.notes}`);
  return lines.join("\n");
}
