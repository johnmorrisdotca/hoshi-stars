// The 88 constellation figures as very faint lines on a sky of the page's own, with the figure under the pointer (or a finger) at full strength and its name beside it.
// The page owns the camera and the drawing: it says where a star is on its screen, and draws the segments this module lays out, each figure at the opacity it asks for.
// Pure: no DOM, no clock; after the first call nothing is allocated, so a page may call `update` every frame it moves, and `point` on every pointer move; at rest there is nothing to call.
import { figures, type Figure } from "./lines.ts";
import { DEFAULT_LABEL_STYLE, labelHeight, labelStyle, labelText, labelWidth, type LabelStyle } from "./label-style.ts";
import type { NameLanguage, ScreenPoint, SkyProjector, SkyView } from "./star-names.ts";

/**
 * A rectangle in the page's pixels, for the boxes a figure's name must stay clear of (`StarNames.labels` are such boxes). A box that also has the star's place (`x`, `y`) and the radius of its `ring` keeps the name off the ring too.
 *
 * @example
 * ```ts
 * import type { Box } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const panel: Box = { x0: 0, y0: 0, x1: 200, y1: 40 };
 * console.log(panel.x1 - panel.x0);
 * ```
 */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x?: number;
  y?: number;
  ring?: number;
}

/**
 * The strength the lines have when a page asks for them and says no more: faint, so that most of the sky is seen without lines.
 *
 * @example
 * ```ts
 * import { DEFAULT_LINE_STRENGTH } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(DEFAULT_LINE_STRENGTH);
 * ```
 */
export const DEFAULT_LINE_STRENGTH = 0.16;

/**
 * The attribute a page offers for the lines, as a settings panel sets it: `constellation-lines`, a strength from 0 to 1.
 *
 * @example
 * ```ts
 * import { CONSTELLATION_LINES_ATTRIBUTE } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(CONSTELLATION_LINES_ATTRIBUTE);
 * ```
 */
export const CONSTELLATION_LINES_ATTRIBUTE = "constellation-lines";

/**
 * A strength held to 0 up to 1. A value that is not a number is the default.
 *
 * @param value - Any number, or anything else.
 * @param fallback - What to answer for a value that is not a number; `DEFAULT_LINE_STRENGTH` by default.
 * @returns A number from 0 to 1.
 *
 * @example
 * ```ts
 * import { clampStrength } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(clampStrength(3), clampStrength(-1), clampStrength(0.35), clampStrength("soft"));
 * ```
 */
export function clampStrength(value: unknown, fallback: number = DEFAULT_LINE_STRENGTH): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

/**
 * The strength from the attribute `constellation-lines`, read as text. Off (`undefined`) when the attribute is missing, `0`, `off` or `false`; `constellation-lines` with no value is the default strength (0.16); a number is the strength, held to 0 up to 1.
 *
 * @param value - The value of `constellation-lines`, or `null` when the attribute is missing.
 * @returns The strength, or `undefined` when the lines are off.
 *
 * @example
 * ```ts
 * import { lineStrengthFromAttribute } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * console.log(lineStrengthFromAttribute("0.3"), lineStrengthFromAttribute(""), lineStrengthFromAttribute(null), lineStrengthFromAttribute("0"));
 * ```
 */
export function lineStrengthFromAttribute(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const text = value.trim().toLowerCase();
  if (text === "") return DEFAULT_LINE_STRENGTH;
  if (text === "off" || text === "false") return undefined;
  const n = Number(text);
  if (!Number.isFinite(n)) return undefined;
  const strength = clampStrength(n);
  return strength === 0 ? undefined : strength;
}

/**
 * What the lines are.
 *
 * @example
 * ```ts
 * import type { FigureLinesSettings } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const settings: FigureLinesSettings = { strength: 0.2, lang: "ja", reach: 16 };
 * console.log(settings.strength);
 * ```
 */
export interface FigureLinesSettings {
  /** How strong the lines are when not under the pointer, 0 to 1. 0 draws nothing at all, and `DEFAULT_LINE_STRENGTH` (0.16) is used when left out. */
  strength?: number;
  /** How near a line the pointer must be to pick its figure, in pixels. 14 by default; a finger may want more. */
  reach?: number;
  /** The radius in pixels of a star's dot, which a figure's name must not cover: 3 by default. */
  dotRadius?: number;
  /** A line longer than this many pixels is left out: a page that draws the whole sky flat uses it to drop the lines that cross the seam. Left out, no line is dropped for its length. */
  maxLength?: number;
  /** The language of the figure's name when it is picked: `en` gives the Latin name (`Canis Major`), `ja` the Japanese (`おおいぬ座`). `en` by default. */
  lang?: NameLanguage;
  /** The look of the picked figure's name (`labelStyle`); a quiet plain default. */
  style?: Partial<LabelStyle>;
}

/**
 * One figure on the screen: where its lines are in `FigureLines.segments`, and its name's spot. The objects are reused by the next `update`.
 *
 * @example
 * ```ts
 * import type { FigureOnScreen } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const lines = (figure: FigureOnScreen): number => figure.end - figure.start;
 * console.log(typeof lines);
 * ```
 */
export interface FigureOnScreen {
  /** The constellation's IAU abbreviation (`Ori`). */
  abbreviation: string;
  /** The figure's lines are the segments from `start` up to (not including) `end`; the same number means none are in view. */
  start: number;
  end: number;
  /** The box the figure's lines in view take: its left, top, right and bottom edges. */
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** The middle of that box across: where its name is centred. */
  x: number;
}

/**
 * The name of the picked figure and where to draw it, centred on `x`, with its baseline at `y`: clear above the figure, and never over a star's name.
 *
 * @example
 * ```ts
 * import type { FigureName } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const draw = (name: FigureName): string => `${name.text} at ${Math.round(name.x)},${Math.round(name.y)}`;
 * console.log(typeof draw);
 * ```
 */
export interface FigureName {
  /** The name with the look's case applied. */
  text: string;
  /** The centre of the text and its baseline, in the page's pixels. It sits above the top of the figure; where the figure reaches the top of the view it goes below; and it steps clear of any box passed to `update` as `avoid`. */
  x: number;
  y: number;
  anchor: "middle";
}

/**
 * The figures of one sky. `update` lays the lines out for the screen as it is, `point` picks the figure under the pointer.
 *
 * @example
 * ```ts
 * import type { FigureLines } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const total = (lines: FigureLines): number => lines.figures.reduce((sum, f) => sum + f.end - f.start, 0);
 * console.log(typeof total);
 * ```
 */
export interface FigureLines {
  /** The settings in force, with the strength held to 0 up to 1. */
  readonly settings: Readonly<FigureLinesSettings & { strength: number }>;
  /** The look in force for the picked figure's name. */
  readonly style: Readonly<LabelStyle>;
  /** The line ends laid out by the last `update`, four numbers for each line: x and y of one end, x and y of the other. Reused; read only up to `4 * count`. */
  readonly segments: Float32Array;
  /** How many lines the last `update` laid out. */
  readonly count: number;
  /** The 88 figures, in the order of the catalogue, each with the lines of `segments` that belong to it. */
  readonly figures: readonly FigureOnScreen[];
  /** The figure the pointer is on, or `undefined`. */
  readonly picked: FigureOnScreen | undefined;
  /** The picked figure's name and where to draw it, or `undefined` when none is picked. */
  readonly name: FigureName | undefined;
  /** Change the settings; the next `update` uses them. */
  set(settings: FigureLinesSettings): void;
  /** The opacity to draw a figure's lines at: the picked figure's is 1, every other is the strength. 0 for all when the strength is 0. */
  opacityOf(figure: FigureOnScreen): number;
  /**
   * Lay the lines out for the screen as it is now. Call it when the view, the size or the settings changed. A picked figure that is no longer in view is let go.
   *
   * @param project - Where a star is on the screen.
   * @param view - The part of the screen the lines are drawn in.
   * @param avoid - Optional: boxes the picked figure's name must stay clear of, such as `StarNames.labels` (the array may be the live one; it is read when a name is placed).
   * @returns How many lines are in view.
   */
  update(project: SkyProjector, view: SkyView, avoid?: readonly Box[]): number;
  /**
   * Say where the pointer (or a finger) is, in the page's pixels, or call with nothing when it has left. The figure with a line or a star nearest the point, within `reach` pixels, is picked: on a star of the figure lights the whole figure, as on a line.
   *
   * @param x - The pointer's x.
   * @param y - The pointer's y.
   * @returns `true` when the picked figure changed, which is when the page should draw once more; `false` when nothing changed and nothing needs to be drawn.
   */
  point(x?: number, y?: number): boolean;
}

/**
 * The constellation figures as lines for a sky of your own, faint, with the figure under the pointer at full strength and its name. `strength` 0 draws nothing. The figures are the package's own, from the positions of the stars.
 *
 * After the first call nothing is allocated by `update` or `point`.
 *
 * @param settings - The strength and what a pick needs.
 * @returns The figures for this sky.
 *
 * @example
 * ```ts
 * import { createFigureLines } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 *
 * const lines = createFigureLines({ strength: 0.2 });
 * const project = (ra: number, dec: number, out: { x: number; y: number }): boolean => {
 *   out.x = 640 - (ra - 84) * 8;
 *   out.y = 360 - dec * 8;
 *   return Math.abs(ra - 84) < 60 && Math.abs(dec) < 40;
 * };
 * lines.update(project, { width: 1280, height: 720 });
 * lines.point(640, 360);
 * console.log(lines.count > 0, lines.picked?.abbreviation, lines.opacityOf(lines.picked!));
 * ```
 */
export function createFigureLines(settings: FigureLinesSettings = {}): FigureLines {
  const all: Figure[] = figures();
  let total = 0;
  for (const figure of all) total += figure.segments.length;
  const segments = new Float32Array(total * 4);
  const onScreen: FigureOnScreen[] = all.map((figure) => ({ abbreviation: figure.constellation.abbreviation, start: 0, end: 0, left: 0, top: 0, right: 0, bottom: 0, x: 0 }));
  const name: FigureName = { text: "", x: 0, y: 0, anchor: "middle" };
  const a: ScreenPoint = { x: 0, y: 0 };
  const b: ScreenPoint = { x: 0, y: 0 };
  let current: Readonly<FigureLinesSettings & { strength: number }> = Object.freeze({ strength: DEFAULT_LINE_STRENGTH });
  let style: LabelStyle = labelStyle();
  let count = 0;
  let picked = -1;
  let size: SkyView = { width: 0, height: 0 };
  let avoided: readonly Box[] = [];
  let texts: string[] = [];

  const set = (next: FigureLinesSettings): void => {
    current = Object.freeze({ ...next, strength: clampStrength(next.strength) });
    style = labelStyle(next.style ?? DEFAULT_LABEL_STYLE);
    texts = [];
    if (current.strength === 0) picked = -1;
  };
  set(settings);

  /** Whether a box of text touches a name or ring in `avoided`, or the dot of a star of a figure in view. */
  const clear = (x0: number, y0: number, x1: number, y1: number): boolean => {
    for (let i = 0; i < avoided.length; i += 1) {
      const box = avoided[i]!;
      if (x0 < box.x1 + 2 && x1 > box.x0 - 2 && y0 < box.y1 + 1 && y1 > box.y0 - 1) return false;
      if (box.ring !== undefined && box.ring > 0 && box.x !== undefined && box.y !== undefined) {
        const dx = box.x < x0 ? x0 - box.x : box.x > x1 ? box.x - x1 : 0;
        const dy = box.y < y0 ? y0 - box.y : box.y > y1 ? box.y - y1 : 0;
        if (dx * dx + dy * dy < (box.ring + 1) * (box.ring + 1)) return false;
      }
    }
    const radius = current.dotRadius ?? 3;
    for (let i = 0; i < count * 2; i += 1) {
      const x = segments[(i >> 1) * 4 + (i & 1) * 2]!;
      const y = segments[(i >> 1) * 4 + (i & 1) * 2 + 1]!;
      const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
      const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
      if (dx * dx + dy * dy < radius * radius) return false;
    }
    return true;
  };

  const placeName = (): void => {
    const figure = onScreen[picked]!;
    const margin = size.margin ?? 4;
    if (texts.length === 0) texts = all.map((one) => labelText(current.lang === "ja" ? one.constellation.japanese : one.constellation.name, style));
    name.text = texts[picked]!;
    const width = labelWidth(name.text, style);
    const height = labelHeight(style);
    const gap = Math.ceil(style.size * 0.6);
    const fits = (centre: number, top: number): boolean => top >= margin && top + height <= size.height - margin && clear(centre - width / 2, top, centre + width / 2, top + height);
    const put = (centre: number, top: number): void => {
      name.x = centre;
      name.y = top + height * 0.8;
    };
    const inside = (centre: number): number => Math.max(margin + width / 2, Math.min(size.width - margin - width / 2, centre));
    // above the figure, stepping up past anything in the way; failing that below it, stepping down; then a step to either side and again
    for (const shift of [0, -0.5, 0.5, -1, 1, -1.5, 1.5]) {
      const centre = inside(figure.x + shift * width);
      for (let top = figure.top - gap - height; top >= margin; top -= height) if (fits(centre, top)) return put(centre, top);
      for (let top = figure.bottom + gap; top + height <= size.height - margin; top += height) if (fits(centre, top)) return put(centre, top);
    }
    // anywhere in the view that is free, the nearest to the figure's middle first
    const middle = (figure.top + figure.bottom) / 2;
    let best: { centre: number; top: number; away: number } | undefined;
    for (let top = margin; top + height <= size.height - margin; top += Math.max(2, height / 2)) {
      for (let centre = inside(figure.x - 2 * width); centre <= inside(figure.x + 2 * width); centre += Math.max(4, width / 4)) {
        const away = Math.abs(top - middle) + Math.abs(centre - figure.x) * 0.5;
        if ((best === undefined || away < best.away) && fits(centre, top)) best = { centre, top, away };
      }
    }
    // nothing is free: above the figure as far as the view allows, whatever is there
    if (best !== undefined) return put(best.centre, best.top);
    put(inside(figure.x), Math.max(margin, Math.min(size.height - margin - height, figure.top - gap - height)));
  };

  const lines: FigureLines = {
    get settings() {
      return current;
    },
    get style() {
      return style;
    },
    segments,
    get count() {
      return count;
    },
    figures: onScreen,
    get picked() {
      return picked < 0 ? undefined : onScreen[picked];
    },
    get name() {
      return picked < 0 ? undefined : name;
    },
    set,
    opacityOf(figure) {
      return current.strength === 0 ? 0 : onScreen[picked] === figure ? 1 : current.strength;
    },
    update(project, view, avoid) {
      size = view;
      avoided = avoid ?? [];
      count = 0;
      const longest = current.maxLength ?? Number.POSITIVE_INFINITY;
      for (let i = 0; i < all.length; i += 1) {
        const out = onScreen[i]!;
        out.start = count;
        let left = Number.POSITIVE_INFINITY;
        let top = Number.POSITIVE_INFINITY;
        let right = Number.NEGATIVE_INFINITY;
        let bottom = Number.NEGATIVE_INFINITY;
        if (current.strength > 0) {
          const pairs = all[i]!.segments;
          for (let k = 0; k < pairs.length; k += 1) {
            const from = pairs[k]![0];
            const to = pairs[k]![1];
            if (!project(from.rightAscension, from.declination, a) || !project(to.rightAscension, to.declination, b)) continue;
            if ((a.x < 0 && b.x < 0) || (a.x > view.width && b.x > view.width) || (a.y < 0 && b.y < 0) || (a.y > view.height && b.y > view.height)) continue;
            if (longest !== Number.POSITIVE_INFINITY && (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) > longest * longest) continue;
            const at = count * 4;
            segments[at] = a.x;
            segments[at + 1] = a.y;
            segments[at + 2] = b.x;
            segments[at + 3] = b.y;
            count += 1;
            left = Math.min(left, a.x, b.x);
            right = Math.max(right, a.x, b.x);
            top = Math.min(top, a.y, b.y);
            bottom = Math.max(bottom, a.y, b.y);
          }
        }
        out.end = count;
        if (out.end > out.start) {
          out.left = left;
          out.right = right;
          out.top = top;
          out.bottom = bottom;
          out.x = Math.max(0, Math.min(view.width, (left + right) / 2));
        }
      }
      if (picked >= 0) {
        if (onScreen[picked]!.end === onScreen[picked]!.start) picked = -1;
        else placeName();
      }
      return count;
    },
    point(x, y) {
      let best = -1;
      if (x !== undefined && y !== undefined && current.strength > 0) {
        const reach = current.reach ?? 14;
        let nearest = reach * reach;
        for (let i = 0; i < onScreen.length; i += 1) {
          const figure = onScreen[i]!;
          for (let s = figure.start; s < figure.end; s += 1) {
            const at = s * 4;
            const x0 = segments[at]!;
            const y0 = segments[at + 1]!;
            const dx = segments[at + 2]! - x0;
            const dy = segments[at + 3]! - y0;
            const length = dx * dx + dy * dy;
            const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / length));
            const d = (x0 + t * dx - x) ** 2 + (y0 + t * dy - y) ** 2;
            if (d < nearest) {
              nearest = d;
              best = i;
            }
          }
        }
      }
      if (best === picked) return false;
      picked = best;
      if (picked >= 0) placeName();
      return true;
    },
  };
  return lines;
}
