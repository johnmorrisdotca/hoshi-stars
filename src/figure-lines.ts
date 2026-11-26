// The figures of a sky (the 88 constellations, or a sky culture's own) as very faint lines on a sky of the page's own, with the figure under the pointer (or a finger) at full strength and its name beside it.
// The page owns the camera and the drawing: it says where a star is on its screen, and draws the segments this module lays out, each figure at the opacity it asks for.
// Pure: no DOM, no clock; after the first call nothing is allocated, so a page may call `update` every frame it moves, and `point` on every pointer move; at rest there is nothing to call.
import type { Asterism, Culture } from "./culture.ts";
import { figures } from "./lines.ts";
import type { Star } from "./stars.ts";
import { DEFAULT_LABEL_STYLE, labelHeight, labelStyle, labelText, labelWidth, type LabelStyle } from "./label-style.ts";
import type { CoverMask, NameLanguage, ScreenPoint, SkyView } from "./star-names.ts";
import type { Box, FigureLines, FigureLinesSettings, FigureName, FigureOnScreen } from "./figure-lines-types.ts";

export type { Box, FigureLines, FigureLinesSettings, FigureName, FigureOnScreen };

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

/** The steps to either side, in name widths, that a picked figure's name tries in turn. */
const NAME_SHIFTS: readonly number[] = [0, -0.5, 0.5, -1, 1, -1.5, 1.5];

/** A figure as the lines need it: its key, its lines and its name in each language. */
interface Drawn {
  key: string;
  segments: ReadonlyArray<readonly [Star, Star]>;
  name(lang: NameLanguage | undefined): string;
}

/** A culture's figure's name: a constellation's as the 88 are named, an asterism's in English or, in Japanese, its reading in kana; the figure's own where it has none in the language. */
function cultureName(asterism: Asterism, lang: NameLanguage | undefined): string {
  if (lang === "ja") return (asterism.kind === "asterism" ? asterism.readings.ja : undefined) ?? asterism.names.ja ?? asterism.name;
  return (asterism.kind === "constellation" ? asterism.names.la : undefined) ?? asterism.names.en ?? asterism.name;
}

/** The figures of a sky: the 88 of the IAU, or a culture's. */
function figuresOf(culture: Culture | undefined): Drawn[] {
  if (culture === undefined) return figures().map((one) => ({ key: one.constellation.abbreviation, segments: one.segments, name: (lang) => (lang === "ja" ? one.constellation.japanese : one.constellation.name) }));
  return figures(culture).map((one) => ({ key: one.asterism.id, segments: one.segments, name: (lang) => cultureName(one.asterism, lang) }));
}

/** The parts of one line that are not behind a body. A line that stays behind it is left out; a line that crosses it is cut at the edge. Nothing is allocated. */
function layUncovered(x0: number, y0: number, x1: number, y1: number, covered: CoverMask | undefined, push: (ax: number, ay: number, bx: number, by: number) => void): void {
  if (covered === undefined) {
    push(x0, y0, x1, y1);
    return;
  }
  const steps = 12;
  const at = (t: number): [number, number] => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  const free = (t: number): boolean => {
    const [x, y] = at(t);
    return !covered(x, y);
  };
  const edge = (hidden: number, shown: number): number => {
    let lo = hidden;
    let hi = shown;
    for (let n = 0; n < 10; n += 1) {
      const mid = (lo + hi) / 2;
      if (free(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  };
  let run = -1;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const open = free(t);
    if (open && run < 0) run = t;
    if (run < 0 || (open && i < steps)) continue;
    let t0 = run;
    let t1 = open ? t : (i - 1) / steps;
    if (t0 > 0) t0 = edge(t0 - 1 / steps, t0);
    if (!open) t1 = edge(t1 + 1 / steps, t1);
    const [ax, ay] = at(t0);
    const [bx, by] = at(t1);
    if ((ax - bx) * (ax - bx) + (ay - by) * (ay - by) >= 0.25) push(ax, ay, bx, by);
    run = -1;
  }
}

/**
 * The constellation figures as lines for a sky of your own, faint, with the figure under the pointer at full strength and its name. `strength` 0 draws nothing. The figures are the package's own, from the positions of the stars:
 * the 88 of the IAU, or with `culture` a sky culture's (the Japanese sky's 昴, the Chinese sky's mansions and asterisms).
 *
 * After the first call nothing is allocated by `update` or `point` (a new culture in `set` makes its figures once).
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
 *
 * @example
 * ```ts
 * import { createFigureLines } from "@johnmorrisdotca/hoshi-stars/sky-labels";
 * import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";
 *
 * // the Japanese sky, its names in Japanese: the Pleiades are 昴, named by their reading
 * const lines = createFigureLines({ culture: japanese, lang: "ja" });
 * const project = (ra: number, dec: number, out: { x: number; y: number }): boolean => {
 *   out.x = 640 - (ra - 56.9) * 40;
 *   out.y = 360 - (dec - 24.1) * 40;
 *   return Math.abs(ra - 56.9) < 15 && Math.abs(dec - 24.1) < 9;
 * };
 * lines.update(project, { width: 1280, height: 720 });
 * const subaru = lines.figures.find((figure) => figure.abbreviation === "subaru")!;
 * lines.point(lines.segments[subaru.start * 4]!, lines.segments[subaru.start * 4 + 1]!);
 * console.log(lines.picked?.abbreviation, lines.name?.text);
 * ```
 */
export function createFigureLines(settings: FigureLinesSettings = {}): FigureLines {
  let sky: Culture | undefined | null = null;
  let all: Drawn[] = [];
  let segments = new Float32Array(0);
  let onScreen: FigureOnScreen[] = [];
  /** The figures, their lines' room and their places on the screen, made again only when the culture changes. */
  const useSky = (culture: Culture | undefined): void => {
    if (culture === sky) return;
    sky = culture;
    all = figuresOf(culture);
    let total = 0;
    for (const figure of all) total += figure.segments.length;
    // a line that crosses a body is cut in two, so each figure line has room for a few pieces
    segments = new Float32Array(total * 16);
    onScreen = all.map((figure) => ({ abbreviation: figure.key, start: 0, end: 0, left: 0, top: 0, right: 0, bottom: 0, x: 0 }));
    count = 0;
    picked = -1;
  };
  const name: FigureName = { text: "", x: 0, y: 0, anchor: "middle" };
  const a: ScreenPoint = { x: 0, y: 0 };
  const b: ScreenPoint = { x: 0, y: 0 };
  let current: Readonly<FigureLinesSettings & { strength: number }> = Object.freeze({ strength: DEFAULT_LINE_STRENGTH });
  let style: LabelStyle = labelStyle();
  let count = 0;
  let picked = -1;
  let size: SkyView = { width: 0, height: 0 };
  let avoided: readonly Box[] = [];
  let mask: CoverMask | undefined;
  let texts: string[] = [];

  const set = (next: FigureLinesSettings): void => {
    current = Object.freeze({ ...next, strength: clampStrength(next.strength) });
    style = labelStyle(next.style ?? DEFAULT_LABEL_STYLE);
    texts = [];
    useSky(next.culture);
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

  // the name's size and place while it is being placed: kept here so that placing it allocates nothing
  let nameWidth = 0;
  let nameHeight = 0;
  let nameMargin = 0;
  const fits = (centre: number, top: number): boolean => top >= nameMargin && top + nameHeight <= size.height - nameMargin && (mask === undefined || !mask(centre, top + nameHeight / 2)) && clear(centre - nameWidth / 2, top, centre + nameWidth / 2, top + nameHeight);
  const put = (centre: number, top: number): void => {
    name.x = centre;
    name.y = top + nameHeight * 0.8;
  };
  const inside = (centre: number): number => Math.max(nameMargin + nameWidth / 2, Math.min(size.width - nameMargin - nameWidth / 2, centre));

  const placeName = (): void => {
    const figure = onScreen[picked]!;
    nameMargin = size.margin ?? 4;
    if (texts.length === 0) texts = all.map((one) => labelText(one.name(current.lang), style));
    name.text = texts[picked]!;
    nameWidth = labelWidth(name.text, style);
    nameHeight = labelHeight(style);
    const width = nameWidth;
    const height = nameHeight;
    const margin = nameMargin;
    const gap = Math.ceil(style.size * 0.6);
    // above the figure, stepping up past anything in the way; failing that below it, stepping down; then a step to either side and again
    for (let s = 0; s < NAME_SHIFTS.length; s += 1) {
      const centre = inside(figure.x + NAME_SHIFTS[s]! * width);
      for (let top = figure.top - gap - height; top >= margin; top -= height) if (fits(centre, top)) return put(centre, top);
      for (let top = figure.bottom + gap; top + height <= size.height - margin; top += height) if (fits(centre, top)) return put(centre, top);
    }
    // anywhere in the view that is free, the nearest to the figure's middle first
    const middle = (figure.top + figure.bottom) / 2;
    let bestCentre = 0;
    let bestTop = 0;
    let bestAway = Number.POSITIVE_INFINITY;
    for (let top = margin; top + height <= size.height - margin; top += Math.max(2, height / 2)) {
      for (let centre = inside(figure.x - 2 * width); centre <= inside(figure.x + 2 * width); centre += Math.max(4, width / 4)) {
        const away = Math.abs(top - middle) + Math.abs(centre - figure.x) * 0.5;
        if (away < bestAway && fits(centre, top)) {
          bestAway = away;
          bestCentre = centre;
          bestTop = top;
        }
      }
    }
    // nothing is free: above the figure as far as the view allows, whatever is there
    if (bestAway !== Number.POSITIVE_INFINITY) return put(bestCentre, bestTop);
    const left = inside(figure.x);
    const below = Math.max(margin, Math.min(size.height - margin - height, figure.top - gap - height));
    if (mask === undefined || !mask(left, below + height / 2)) put(left, below);
  };

  const lines: FigureLines = {
    get settings() {
      return current;
    },
    get style() {
      return style;
    },
    get segments() {
      return segments;
    },
    get count() {
      return count;
    },
    get figures() {
      return onScreen;
    },
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
    update(project, view, avoid, covered) {
      size = view;
      avoided = avoid ?? [];
      mask = covered;
      count = 0;
      const longest = current.maxLength ?? Number.POSITIVE_INFINITY;
      const box = { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY };
      const push = (x0: number, y0: number, x1: number, y1: number): void => {
        if (count * 4 + 4 > segments.length) return;
        const at = count * 4;
        segments[at] = x0;
        segments[at + 1] = y0;
        segments[at + 2] = x1;
        segments[at + 3] = y1;
        count += 1;
        box.left = Math.min(box.left, x0, x1);
        box.right = Math.max(box.right, x0, x1);
        box.top = Math.min(box.top, y0, y1);
        box.bottom = Math.max(box.bottom, y0, y1);
      };
      for (let i = 0; i < all.length; i += 1) {
        const out = onScreen[i]!;
        out.start = count;
        box.left = Number.POSITIVE_INFINITY;
        box.top = Number.POSITIVE_INFINITY;
        box.right = Number.NEGATIVE_INFINITY;
        box.bottom = Number.NEGATIVE_INFINITY;
        if (current.strength > 0) {
          const pairs = all[i]!.segments;
          for (let k = 0; k < pairs.length; k += 1) {
            const from = pairs[k]![0];
            const to = pairs[k]![1];
            if (!project(from.rightAscension, from.declination, a) || !project(to.rightAscension, to.declination, b)) continue;
            if ((a.x < 0 && b.x < 0) || (a.x > view.width && b.x > view.width) || (a.y < 0 && b.y < 0) || (a.y > view.height && b.y > view.height)) continue;
            if (longest !== Number.POSITIVE_INFINITY && (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) > longest * longest) continue;
            layUncovered(a.x, a.y, b.x, b.y, covered, push);
          }
        }
        out.end = count;
        if (out.end > out.start) {
          out.left = box.left;
          out.right = box.right;
          out.top = box.top;
          out.bottom = box.bottom;
          out.x = Math.max(0, Math.min(view.width, (box.left + box.right) / 2));
        }
      }
      if (picked >= 0) {
        if (onScreen[picked]!.end === onScreen[picked]!.start) picked = -1;
        else placeName();
      }
      return count;
    },
    point(x, y) {
      if (x !== undefined && y !== undefined && mask !== undefined && mask(x, y)) {
        const changed = picked >= 0;
        picked = -1;
        return changed;
      }
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
    step(direction) {
      if (current.strength === 0) return false;
      const n = onScreen.length;
      const from = picked >= 0 ? picked : direction === 1 ? n - 1 : 0;
      for (let k = 1; k <= n; k += 1) {
        const i = (((from + direction * k) % n) + n) % n;
        if (onScreen[i]!.end === onScreen[i]!.start) continue;
        if (i === picked) return false;
        picked = i;
        placeName();
        return true;
      }
      return false;
    },
  };
  return lines;
}
