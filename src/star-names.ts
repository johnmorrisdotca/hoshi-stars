// The names of the brightest stars on a sky of the page's own: which to name, from a count or a magnitude, and where each name goes, in English or Japanese.
// The page owns the camera and the drawing. It gives a function that says where a star is on its screen and, if something covers part of the sky (the Earth, a planet), a function that says whether a spot is covered.
// Pure: no DOM, no clock; after the first call nothing is allocated, so a page may call `update` every frame it moves and none at rest.
import { stars, type Star } from "./stars.ts";
import { DEFAULT_LABEL_STYLE, designationWidth, labelHeight, labelStyle, labelText, labelWidth, type LabelStyle } from "./label-style.ts";

/**
 * A place on the page's screen, in pixels from its top left corner. The page's projection writes into one of these so that nothing is allocated for each star.
 *
 * @example
 * ```ts
 * import type { ScreenPoint } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const spot: ScreenPoint = { x: 640, y: 360 };
 * console.log(spot.x, spot.y);
 * ```
 */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * How a page says where a star is: it gets the star's right ascension and declination in degrees and writes the spot on its screen into `out`. It answers `false` when the star is not in front of the camera (behind it, or beyond the horizon of the view).
 *
 * @example
 * ```ts
 * import type { SkyProjector } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * // a page that looks straight at the north celestial pole with the sky 200 pixels across a quarter turn
 * const project: SkyProjector = (ra, dec, out) => {
 *   const r = ((90 - dec) / 90) * 200;
 *   out.x = 300 + r * Math.cos((ra * Math.PI) / 180);
 *   out.y = 300 - r * Math.sin((ra * Math.PI) / 180);
 *   return dec > 0;
 * };
 * console.log(project(0, 90, { x: 0, y: 0 }));
 * ```
 */
export type SkyProjector = (rightAscension: number, declination: number, out: ScreenPoint) => boolean;

/**
 * How a page says that a spot of its screen is covered by a body in front of the sky (the Earth, a planet, a panel): `true` where a star would not be seen.
 *
 * @example
 * ```ts
 * import type { CoverMask } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const belowTheHorizon: CoverMask = (_x, y) => y > 500;
 * console.log(belowTheHorizon(10, 600));
 * ```
 */
export type CoverMask = (x: number, y: number) => boolean;

/**
 * A mask for a round body, such as the Earth seen from space: every spot within `radius` pixels of its centre is covered.
 *
 * @param x - The centre's x in pixels.
 * @param y - The centre's y in pixels.
 * @param radius - The radius in pixels.
 * @returns A mask for `StarNames.update`.
 *
 * @example
 * ```ts
 * import { discCover } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const earth = discCover(400, 700, 300);
 * console.log(earth(400, 500), earth(400, 300));
 * ```
 */
export function discCover(x: number, y: number, radius: number): CoverMask {
  const squared = radius * radius;
  return (px, py) => (px - x) * (px - x) + (py - y) * (py - y) <= squared;
}

/**
 * The part of the screen names may use, in pixels. A name is kept only when the whole of it lies inside, `margin` pixels from each edge.
 *
 * @example
 * ```ts
 * import type { SkyView } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const view: SkyView = { width: 1280, height: 720, margin: 8 };
 * console.log(view.width);
 * ```
 */
export interface SkyView {
  width: number;
  height: number;
  /** The space kept clear at each edge, in pixels. 4 by default. */
  margin?: number;
}

/**
 * The language of the names: `en` for the IAU spelling (`Sirius`), `ja` for the katakana (`シリウス`, English where a star has no katakana).
 *
 * @example
 * ```ts
 * import type { NameLanguage } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const lang: NameLanguage = "ja";
 * console.log(lang);
 * ```
 */
export type NameLanguage = "en" | "ja";

/**
 * What to name. A page that sets neither `count` nor `magnitude` names nothing.
 *
 * @example
 * ```ts
 * import type { StarNamesSettings } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const settings: StarNamesSettings = { count: 12, lang: "ja", style: { case: "upper" } };
 * console.log(settings.count);
 * ```
 */
export interface StarNamesSettings {
  /** The most names to show at once, the brightest first, counting only the stars that are in view and not covered. 0 or left out for no limit by count. */
  count?: number;
  /** Only stars at least this bright (a magnitude: Sirius is -1.46, so 1.5 names the 22 brightest stars). Left out for no limit by magnitude. */
  magnitude?: number;
  /** The language of the names; `en` by default. */
  lang?: NameLanguage;
  /** Which stars' dots a name must not cover: every star brighter than this magnitude, 3 by default (about 170 stars). Lower it for a page that draws only the brightest. */
  dotMagnitude?: number;
  /** The radius in pixels of a star's dot, which a name must not cover, 3 by default. */
  dotRadius?: number;
  /** The look of the names (`labelStyle`); a quiet plain default. */
  style?: Partial<LabelStyle>;
}

/**
 * One name to draw: the star, the text with the look's case applied, and where everything goes, in the page's pixels. The objects are reused by the next `update`; copy what you keep.
 *
 * @example
 * ```ts
 * import type { StarNameLabel } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const show = (label: StarNameLabel): string => `${label.text} at ${Math.round(label.x)},${Math.round(label.y)}`;
 * console.log(typeof show);
 * ```
 */
export interface StarNameLabel {
  /** The star's Bright Star Catalogue number. */
  hr: number;
  /** The name to draw, with the look's case applied. */
  text: string;
  /** The star's visual magnitude. */
  magnitude: number;
  /** Where the star is on the screen. */
  x: number;
  y: number;
  /** Where to draw the text: its baseline start (`anchor` `start`), end (`end`) or middle (`middle`, for a name above or below its star). */
  textX: number;
  textY: number;
  anchor: "start" | "end" | "middle";
  /** The catalogue letter to write under the name (`α Ori`), or an empty text when the look leaves it out or the star has none; where its baseline starts (`anchor` as for the name). */
  designation: string;
  designationX: number;
  designationY: number;
  /** The radius of the ring to draw round the star; 0 for none. */
  ring: number;
  /** The box the name and its catalogue letter take together. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The short line from the star to the text, from (`leaderX0`, `leaderY0`) to (`leaderX1`, `leaderY1`); `leader` is false when the look has none. */
  leader: boolean;
  leaderX0: number;
  leaderY0: number;
  leaderX1: number;
  leaderY1: number;
}

/**
 * The stars' names for one sky. `update` picks them for the screen as it is; `labels` is the answer.
 *
 * @example
 * ```ts
 * import type { StarNames } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const count = (names: StarNames): number => names.labels.length;
 * console.log(typeof count);
 * ```
 */
export interface StarNames {
  /** The settings in force. */
  readonly settings: Readonly<StarNamesSettings>;
  /** The look in force: complete, with every part in range. */
  readonly style: Readonly<LabelStyle>;
  /** The names to draw now, brightest first. The array and the objects in it are reused by the next `update`. */
  readonly labels: readonly StarNameLabel[];
  /** Change what is named or how it looks; the next `update` uses it. */
  set(settings: StarNamesSettings): void;
  /**
   * Choose the names for the screen as it is now. Call it when the view, the size or the settings changed; at rest there is nothing to call.
   *
   * @param project - Where a star is on the screen.
   * @param view - The part of the screen names may use.
   * @param covered - Optional: whether a spot is behind a body in front of the sky.
   * @returns How many names are shown.
   */
  update(project: SkyProjector, view: SkyView, covered?: CoverMask): number;
}

/**
 * The attributes a page offers for the names, as a settings panel sets them: `star-names` (a count) and `star-names-magnitude` (a limit).
 *
 * @example
 * ```ts
 * import { STAR_NAMES_ATTRIBUTES } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(STAR_NAMES_ATTRIBUTES.count, STAR_NAMES_ATTRIBUTES.magnitude);
 * ```
 */
export const STAR_NAMES_ATTRIBUTES = Object.freeze({ count: "star-names", magnitude: "star-names-magnitude" });

/** The number of names `star-names` with no value asks for. */
const DEFAULT_COUNT = 10;
/** The most stars that carry a name in the 5,080: the 335 names of the IAU Working Group on Star Names (and three traditional ones) that the catalogue holds. A test holds it to the catalogue. */
const MOST = 335;

/**
 * Settings from the two attributes a page offers, `star-names` (a count) and `star-names-magnitude` (a limit), read as text. Off when neither is there: names are never on unless asked. `star-names` with no value (`""`) asks for 10; a count of 0, a negative or text that is not a number asks for none.
 *
 * @param count - The value of `star-names`, or `null` when the attribute is missing.
 * @param magnitude - The value of `star-names-magnitude`, or `null` when it is missing.
 * @returns The settings, or `undefined` when names are off.
 *
 * @example
 * ```ts
 * import { starNamesFromAttributes } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(starNamesFromAttributes("12", null), starNamesFromAttributes(null, "1.5"), starNamesFromAttributes(null, null));
 * ```
 */
export function starNamesFromAttributes(count: string | null | undefined, magnitude: string | null | undefined): StarNamesSettings | undefined {
  const out: StarNamesSettings = {};
  if (count !== null && count !== undefined) {
    const n = count.trim() === "" ? DEFAULT_COUNT : Number(count);
    if (Number.isFinite(n) && n >= 1) out.count = Math.min(MOST, Math.floor(n));
  }
  if (magnitude !== null && magnitude !== undefined && magnitude.trim() !== "") {
    const m = Number(magnitude);
    if (Number.isFinite(m)) out.magnitude = Math.max(-2, Math.min(7, m));
  }
  return out.count === undefined && out.magnitude === undefined ? undefined : out;
}

const SQRT_HALF = Math.SQRT1_2;

function newLabel(): StarNameLabel {
  return { hr: 0, text: "", magnitude: 0, x: 0, y: 0, textX: 0, textY: 0, anchor: "start", designation: "", designationX: 0, designationY: 0, ring: 0, x0: 0, y0: 0, x1: 0, y1: 0, leader: false, leaderX0: 0, leaderY0: 0, leaderX1: 0, leaderY1: 0 };
}

/**
 * The places a name may take, in the order they are tried: right of its star, left, above, below.
 *
 * @example
 * ```ts
 * import { LABEL_SIDES } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(LABEL_SIDES.join(", "));
 * ```
 */
export const LABEL_SIDES = ["right", "left", "above", "below"] as const;

/**
 * A place for a name.
 *
 * @example
 * ```ts
 * import { LABEL_SIDES, type LabelSide } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const first: LabelSide = LABEL_SIDES[0];
 * console.log(first);
 * ```
 */
export type LabelSide = (typeof LABEL_SIDES)[number];

/**
 * Put a name on one side of a star: right, left, above (centred over it) or below (centred under it), with the star's catalogue letter under the name when `designation` is true. Writes into `out` and answers whether the whole block, and its line, are inside the view.
 * `createStarNames` tries the four sides in order and takes the first that covers no other name and no star.
 *
 * @param x - The star's x on the screen.
 * @param y - The star's y on the screen.
 * @param width - The widest line's width in pixels (`labelWidth`, and `designationWidth` for the line under it).
 * @param style - A complete look.
 * @param view - The part of the screen names may use.
 * @param out - Where the answer is written.
 * @param designation - True when a line for the catalogue letter goes under the name.
 * @param side - Which side; `right` by default. A leader line (the look's `leader`) goes with `right` and `left` only.
 * @returns `true` when it fits.
 *
 * @example
 * ```ts
 * import { labelStyle, labelWidth, placeLabel, type StarNameLabel } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const style = labelStyle({ leader: 14 });
 * const out = {} as StarNameLabel;
 * console.log(placeLabel(395, 100, labelWidth("Rigel", style), style, { width: 400, height: 300 }, out), placeLabel(395, 100, labelWidth("Rigel", style), style, { width: 400, height: 300 }, out, false, "left"), out.anchor);
 * ```
 */
export function placeLabel(x: number, y: number, width: number, style: LabelStyle, view: SkyView, out: StarNameLabel, designation = false, side: LabelSide = "right"): boolean {
  const margin = view.margin ?? 4;
  const line = labelHeight(style);
  const second = designation ? Math.ceil(style.designationSize * 1.2) : 0;
  const h = line + second;
  const gap = style.offset + style.ring;
  const across = side === "right" || side === "left";
  const lead = across && style.leader > 0;
  const dir = side === "left" ? -1 : 1;
  let left: number;
  let top: number;
  let edgeX = 0;
  let edgeY = 0;
  if (across) {
    edgeX = lead ? x + dir * (gap + style.leader) * SQRT_HALF : x + dir * gap;
    edgeY = lead ? y - (gap + style.leader) * SQRT_HALF : y;
    const pad = lead ? 2 : 0;
    left = side === "right" ? edgeX + pad : edgeX - pad - width;
    top = edgeY - h / 2;
  } else {
    left = x - width / 2;
    top = side === "above" ? y - gap - h : y + gap;
  }
  const right = left + width;
  const bottom = top + h;
  if (left < margin || right > view.width - margin || top < margin || bottom > view.height - margin) return false;
  out.x0 = left;
  out.x1 = right;
  out.y0 = top;
  out.y1 = bottom;
  out.anchor = across ? (side === "right" ? "start" : "end") : "middle";
  out.textX = across ? (side === "right" ? left : right) : x;
  out.textY = top + line * 0.8;
  out.designationX = out.textX;
  out.designationY = top + line + style.designationSize * 0.9;
  out.leader = lead;
  if (lead) {
    out.leaderX0 = x + dir * gap * SQRT_HALF;
    out.leaderY0 = y - gap * SQRT_HALF;
    out.leaderX1 = edgeX;
    out.leaderY1 = edgeY;
  }
  return true;
}

/** Whether the box reaches into a disc. */
const reaches = (x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, r: number): boolean => {
  const dx = cx < x0 ? x0 - cx : cx > x1 ? cx - x1 : 0;
  const dy = cy < y0 ? y0 - cy : cy > y1 ? cy - y1 : 0;
  return dx * dx + dy * dy < r * r;
};

/**
 * The names of the brightest stars for a sky of your own. It names only stars that have a name (the 335 of the IAU Working Group on Star Names that the catalogue holds), only those inside the view and not behind a body that covers them, never two names on each other, and
 * never a name that runs off the view. `count` and `magnitude` limit it: with both, the stars must be bright enough and no more than `count` are shown. With neither it names nothing.
 *
 * After the first call nothing is allocated by `update`, so a page may call it on every frame it moves. At rest there is nothing to call: the labels stay as they are.
 *
 * @param settings - What to name and how it looks.
 * @returns The names for this sky.
 *
 * @example
 * ```ts
 * import { createStarNames, discCover } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const names = createStarNames({ count: 6 });
 * const project = (ra: number, dec: number, out: { x: number; y: number }): boolean => {
 *   out.x = 640 - ra * 3 + 540;
 *   out.y = 360 - dec * 3;
 *   return true;
 * };
 * names.update(project, { width: 1280, height: 720 }, discCover(640, 900, 300));
 * console.log(names.labels.map((label) => label.text));
 * ```
 */
export function createStarNames(settings: StarNamesSettings = {}): StarNames {
  let named: Star[] | undefined;
  let current: StarNamesSettings = {};
  let style: LabelStyle = labelStyle();
  let texts: string[] = [];
  let designations: string[] = [];
  const pool: StarNameLabel[] = [];
  const labels: StarNameLabel[] = [];
  const spot: ScreenPoint = { x: 0, y: 0 };
  // the dots a name must not cover: every star brighter than `dotMagnitude`, projected afresh by each update into reused arrays
  let dots: Star[] | undefined;
  let dotX = new Float32Array(0);
  let dotY = new Float32Array(0);

  const prepare = (): Star[] => {
    if (named === undefined) named = stars().filter((star) => star.name !== undefined).sort((a, b) => a.magnitude - b.magnitude || a.hr - b.hr);
    return named;
  };
  const set = (next: StarNamesSettings): void => {
    current = Object.freeze({ ...next });
    style = labelStyle(next.style ?? DEFAULT_LABEL_STYLE);
    texts = [];
    designations = [];
    dots = undefined;
  };
  set(settings);

  const names: StarNames = {
    get settings() {
      return current;
    },
    get style() {
      return style;
    },
    labels,
    set,
    update(project, view, covered) {
      labels.length = 0;
      const limit = current.count === undefined || current.count <= 0 ? (current.magnitude === undefined ? 0 : MOST) : Math.min(MOST, Math.floor(current.count));
      if (limit === 0) return 0;
      const faintest = current.magnitude ?? Number.POSITIVE_INFINITY;
      const list = prepare();
      if (texts.length === 0) {
        const ja = current.lang === "ja";
        texts = list.map((star) => labelText((ja ? star.nameJa : undefined) ?? star.name!, style));
        designations = list.map((star) => (style.designation === "none" ? "" : star.designation ?? ""));
      }
      if (dots === undefined) {
        dots = stars().filter((star) => star.magnitude <= (current.dotMagnitude ?? 3));
        dotX = new Float32Array(dots.length);
        dotY = new Float32Array(dots.length);
      }
      const around = dots;
      for (let d = 0; d < around.length; d += 1) {
        const dot = around[d]!;
        if (project(dot.rightAscension, dot.declination, spot)) {
          dotX[d] = spot.x;
          dotY[d] = spot.y;
        } else dotX[d] = Number.NaN;
      }
      const radius = current.dotRadius ?? 3;
      for (let i = 0; i < list.length && labels.length < limit; i += 1) {
        const star = list[i]!;
        if (star.magnitude > faintest) break;
        if (!project(star.rightAscension, star.declination, spot)) continue;
        if (!(spot.x >= 0 && spot.x <= view.width && spot.y >= 0 && spot.y <= view.height)) continue;
        if (covered !== undefined && covered(spot.x, spot.y)) continue;
        const slot = pool[labels.length] ?? (pool[labels.length] = newLabel());
        const text = texts[i]!;
        const letter = designations[i]!;
        const width = Math.max(labelWidth(text, style), designationWidth(letter, style));
        // right of the star, then left, above, below: the first place that covers no other name, no ring and no star's dot
        let found = false;
        for (let k = 0; k < LABEL_SIDES.length && !found; k += 1) {
          if (!placeLabel(spot.x, spot.y, width, style, view, slot, letter !== "", LABEL_SIDES[k]!)) continue;
          if (covered !== undefined && (covered((slot.x0 + slot.x1) / 2, (slot.y0 + slot.y1) / 2) || covered(slot.x0, (slot.y0 + slot.y1) / 2) || covered(slot.x1, (slot.y0 + slot.y1) / 2))) continue;
          let clear = true;
          for (let j = 0; j < labels.length && clear; j += 1) {
            const other = labels[j]!;
            if ((slot.x0 < other.x1 + 2 && slot.x1 > other.x0 - 2 && slot.y0 < other.y1 + 1 && slot.y1 > other.y0 - 1) || (other.ring > 0 && reaches(slot.x0, slot.y0, slot.x1, slot.y1, other.x, other.y, other.ring + 1))) clear = false;
          }
          for (let d = 0; d < around.length && clear; d += 1) {
            const x = dotX[d]!;
            if (x === x && around[d]!.hr !== star.hr && reaches(slot.x0, slot.y0, slot.x1, slot.y1, x, dotY[d]!, radius)) clear = false;
          }
          found = clear;
        }
        if (!found) continue;
        slot.hr = star.hr;
        slot.text = text;
        slot.designation = letter;
        slot.ring = style.ring;
        slot.magnitude = star.magnitude;
        slot.x = spot.x;
        slot.y = spot.y;
        labels.push(slot);
      }
      return labels.length;
    },
  };
  return names;
}
