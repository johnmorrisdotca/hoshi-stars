// How a name on the sky looks, as one plain object and as CSS custom properties, so that a look is a setting and never new code.
// Pure: no DOM, no clock, no state. A page that draws with SVG, canvas or HTML text reads the same object.

/**
 * The look of a name drawn on the sky. Every part is a plain value, so a page can keep one in its settings, in its address or in CSS custom properties (`labelStyleVars`, `labelStyleFrom`).
 *
 * @example
 * ```ts
 * import { labelStyle, type LabelStyle } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const style: LabelStyle = labelStyle({ case: "upper", letterSpacing: 0.12 });
 * console.log(style.size, style.case);
 * ```
 */
export interface LabelStyle {
  /** The font family, as CSS writes it. `Michroma, system-ui, sans-serif` by default: Michroma is the family's font for a name on a body, and the page loads it (kazoku-ui's `loadBodyLabelFont`); until it is in, the next family is used. */
  font: string;
  /** The text size in pixels, 6 to 48. 11 by default. */
  size: number;
  /** The font weight, 100 to 900. 400 by default. */
  weight: number;
  /** The text colour, any CSS colour. A quiet white by default. */
  colour: string;
  /** The colour of the outline round the letters that keeps them readable over stars, any CSS colour, or `none` for no outline. A dark blue by default. */
  halo: string;
  /** The width of that outline in pixels, 0 to 12. 3 by default. */
  haloWidth: number;
  /** `small-caps` writes the name in small capitals (the page draws it with CSS `font-variant: small-caps`), `as-written` keeps it as it is, `upper` and `lower` change the case (Japanese is not changed by any). `small-caps` by default. */
  case: "small-caps" | "as-written" | "upper" | "lower";
  /** The space added between letters, in em, -0.1 to 1. 0.14 by default. */
  letterSpacing: number;
  /** The length in pixels of a short line from the star to its name, 0 to 80, or 0 for no line and the name set beside the star. 0 by default. */
  leader: number;
  /** The colour of that line, any CSS colour. A quiet blue-white by default. */
  leaderColour: string;
  /** The gap in pixels between the ring round a star (or the star) and its name (or its line), 0 to 40. 4 by default. */
  offset: number;
  /** The radius in pixels of a thin ring drawn round each named star, 0 to 30, or 0 for no ring. 6 by default. */
  ring: number;
  /** The colour of the ring, any CSS colour. A quiet blue-white by default. */
  ringColour: string;
  /** The line width of the ring in pixels, 0.25 to 4. 0.75 by default. */
  ringWidth: number;
  /** `below` writes the star's catalogue letter (`α Ori`) in small type under its name; `none` leaves it out. A star with no Bayer letter or Flamsteed number has none to write. `below` by default. */
  designation: "below" | "none";
  /** The font family of that line. A small monospace by default. */
  designationFont: string;
  /** Its size in pixels, 6 to 24. 9 by default. */
  designationSize: number;
  /** Its colour, any CSS colour. A quieter white by default. */
  designationColour: string;
}

/**
 * The look a name has when nothing is asked for, chosen from several proposals, "Display with catalogue letters": the name in Michroma in small capitals with wide letter spacing, a thin ring round the star, and the star's catalogue letter under it in small monospace. Every part can be changed by a setting.
 *
 * @example
 * ```ts
 * import { DEFAULT_LABEL_STYLE } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(DEFAULT_LABEL_STYLE.font, DEFAULT_LABEL_STYLE.size);
 * ```
 */
export const DEFAULT_LABEL_STYLE: Readonly<LabelStyle> = Object.freeze({
  font: "Michroma, system-ui, sans-serif",
  size: 11,
  weight: 400,
  colour: "rgba(232, 236, 255, 0.9)",
  halo: "#0b1020",
  haloWidth: 3,
  case: "small-caps",
  letterSpacing: 0.14,
  leader: 0,
  leaderColour: "rgba(232, 236, 255, 0.45)",
  offset: 4,
  ring: 6,
  ringColour: "rgba(232, 236, 255, 0.55)",
  ringWidth: 0.75,
  designation: "below",
  designationFont: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  designationSize: 9,
  designationColour: "rgba(232, 236, 255, 0.6)",
});

/**
 * The name of the CSS custom property for each part of the look, for a page that styles its labels from a stylesheet.
 *
 * @example
 * ```ts
 * import { LABEL_STYLE_PROPERTIES } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(LABEL_STYLE_PROPERTIES.letterSpacing);
 * ```
 */
export const LABEL_STYLE_PROPERTIES: Readonly<Record<keyof LabelStyle, string>> = Object.freeze({
  font: "--hoshi-label-font",
  size: "--hoshi-label-size",
  weight: "--hoshi-label-weight",
  colour: "--hoshi-label-colour",
  halo: "--hoshi-label-halo",
  haloWidth: "--hoshi-label-halo-width",
  case: "--hoshi-label-case",
  letterSpacing: "--hoshi-label-letter-spacing",
  leader: "--hoshi-label-leader",
  leaderColour: "--hoshi-label-leader-colour",
  offset: "--hoshi-label-offset",
  ring: "--hoshi-label-ring",
  ringColour: "--hoshi-label-ring-colour",
  ringWidth: "--hoshi-label-ring-width",
  designation: "--hoshi-label-designation",
  designationFont: "--hoshi-label-designation-font",
  designationSize: "--hoshi-label-designation-size",
  designationColour: "--hoshi-label-designation-colour",
});

const LIMITS = { size: [6, 48], weight: [100, 900], haloWidth: [0, 12], letterSpacing: [-0.1, 1], leader: [0, 80], offset: [0, 40], ring: [0, 30], ringWidth: [0.25, 4], designationSize: [6, 24] } as const;
const CASES = ["small-caps", "as-written", "upper", "lower"] as const;
const DESIGNATIONS = ["below", "none"] as const;

const clamp = (value: unknown, [low, high]: readonly [number, number], fallback: number): number => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
};
const text = (value: unknown, fallback: string): string => (typeof value === "string" && value.trim() !== "" ? value.trim() : fallback);

/**
 * A complete look from a partial one: every part left out or not usable takes its default, and every number is held to its range, so a bad setting never breaks a label.
 *
 * @param part - Any of the parts of the look.
 * @returns A new, complete look.
 *
 * @example
 * ```ts
 * import { labelStyle } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(labelStyle({ size: 400, case: "upper" }).size, labelStyle({ size: 400 }).case);
 * ```
 */
export function labelStyle(part: Partial<LabelStyle> = {}): LabelStyle {
  const d = DEFAULT_LABEL_STYLE;
  return {
    font: text(part.font, d.font),
    size: clamp(part.size, LIMITS.size, d.size),
    weight: Math.round(clamp(part.weight, LIMITS.weight, d.weight)),
    colour: text(part.colour, d.colour),
    halo: text(part.halo, d.halo),
    haloWidth: clamp(part.haloWidth, LIMITS.haloWidth, d.haloWidth),
    case: (CASES as readonly unknown[]).includes(part.case) ? part.case! : d.case,
    letterSpacing: clamp(part.letterSpacing, LIMITS.letterSpacing, d.letterSpacing),
    leader: clamp(part.leader, LIMITS.leader, d.leader),
    leaderColour: text(part.leaderColour, d.leaderColour),
    offset: clamp(part.offset, LIMITS.offset, d.offset),
    ring: clamp(part.ring, LIMITS.ring, d.ring),
    ringColour: text(part.ringColour, d.ringColour),
    ringWidth: clamp(part.ringWidth, LIMITS.ringWidth, d.ringWidth),
    designation: (DESIGNATIONS as readonly unknown[]).includes(part.designation) ? part.designation! : d.designation,
    designationFont: text(part.designationFont, d.designationFont),
    designationSize: clamp(part.designationSize, LIMITS.designationSize, d.designationSize),
    designationColour: text(part.designationColour, d.designationColour),
  };
}

/**
 * A look as CSS custom properties, to set on the element that holds the labels (`element.style.setProperty(name, value)`), so a stylesheet can restyle them as well.
 *
 * @param style - A complete or partial look.
 * @returns The property names (`--hoshi-label-size`) with their values as text.
 *
 * @example
 * ```ts
 * import { labelStyleVars } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(labelStyleVars({ size: 14 })["--hoshi-label-size"]);
 * ```
 */
export function labelStyleVars(style: Partial<LabelStyle> = {}): Record<string, string> {
  const whole = labelStyle(style);
  const out: Record<string, string> = {};
  for (const key of Object.keys(LABEL_STYLE_PROPERTIES) as Array<keyof LabelStyle>) out[LABEL_STYLE_PROPERTIES[key]] = String(whole[key]);
  return out;
}

/**
 * A look read back from CSS custom properties: any property the page has not set keeps its default. Pass how the page reads one, for example `(name) => getComputedStyle(element).getPropertyValue(name)`.
 *
 * @param read - Gives the value of a custom property by name, or an empty text where it has none.
 * @returns A complete look.
 *
 * @example
 * ```ts
 * import { labelStyleFrom } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const style = labelStyleFrom((name) => (name === "--hoshi-label-case" ? "upper" : ""));
 * console.log(style.case, style.size);
 * ```
 */
export function labelStyleFrom(read: (name: string) => string): LabelStyle {
  const part: Record<string, string> = {};
  for (const key of Object.keys(LABEL_STYLE_PROPERTIES) as Array<keyof LabelStyle>) {
    const value = read(LABEL_STYLE_PROPERTIES[key]).trim();
    if (value !== "") part[key] = value;
  }
  return labelStyle(part as unknown as Partial<LabelStyle>);
}

/**
 * A name with the look's case applied. Japanese letters have no case and are never changed, and `small-caps` leaves the name as written for the page to draw with `font-variant: small-caps`.
 *
 * @param name - The name as written.
 * @param style - A complete look.
 * @returns The text to draw.
 *
 * @example
 * ```ts
 * import { labelStyle, labelText } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(labelText("Sirius", labelStyle({ case: "upper" })), labelText("シリウス", labelStyle({ case: "upper" })));
 * ```
 */
export function labelText(name: string, style: LabelStyle): string {
  return style.case === "upper" ? name.toUpperCase() : style.case === "lower" ? name.toLowerCase() : name;
}

/**
 * The width a name takes in pixels, from its length and the look: a Latin letter is about 0.6 of the size wide (0.75 in small capitals, which are wide in Michroma), a Japanese letter the whole size, and the letter spacing is added after each letter. It allocates nothing.
 *
 * @param name - The text to draw.
 * @param style - A complete look.
 * @returns The width in pixels.
 *
 * @example
 * ```ts
 * import { labelStyle, labelWidth } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(labelWidth("Sirius", labelStyle()), labelWidth("シリウス", labelStyle()));
 * ```
 */
export function labelWidth(name: string, style: LabelStyle): number {
  let width = 0;
  let letters = 0;
  for (const ch of name) {
    width += ch.charCodeAt(0) > 0x2e7f ? style.size : style.size * (style.case === "small-caps" ? 0.75 : 0.6);
    letters += 1;
  }
  return Math.ceil(width + letters * style.letterSpacing * style.size);
}

/**
 * The height a line of text takes in pixels: 1.2 times its size.
 *
 * @param style - A complete look.
 * @returns The height in pixels.
 *
 * @example
 * ```ts
 * import { labelHeight, labelStyle } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(labelHeight(labelStyle({ size: 20 })));
 * ```
 */
export const labelHeight = (style: LabelStyle): number => Math.ceil(style.size * 1.2);

/**
 * The width a star's catalogue letter (`α Ori`) takes in pixels in the look's small monospace, 0.6 of its size a letter; 0 where it is not drawn.
 *
 * @param designation - The text, or an empty text for a star with none.
 * @param style - A complete look.
 * @returns The width in pixels.
 *
 * @example
 * ```ts
 * import { designationWidth, labelStyle } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(designationWidth("α Ori", labelStyle()), designationWidth("α Ori", labelStyle({ designation: "none" })));
 * ```
 */
export const designationWidth = (designation: string, style: LabelStyle): number => (style.designation === "none" ? 0 : Math.ceil(designation.length * style.designationSize * 0.6));
