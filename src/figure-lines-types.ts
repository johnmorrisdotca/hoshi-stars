// The shapes of the figure lines: a box, the settings, a figure on the screen, a figure's name and the lines object itself. Moved out of figure-lines.ts as they were; figure-lines.ts re-exports them.
import type { Culture } from "./culture.ts";
import type { LabelStyle } from "./label-style.ts";
import type { CoverMask, NameLanguage, SkyProjector, SkyView } from "./star-names.ts";

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
  /**
   * The language of the figure's name when it is picked: `en` gives the Latin name (`Canis Major`), `ja` the Japanese (`おおいぬ座`). `en` by default. In a culture's sky a constellation is named the
   * same way, an asterism by its English name (`Subaru`, `Big Dipper`) or in Japanese by its reading in kana (`すばる`), and a figure with no name in the language by its own (`北斗`).
   */
  lang?: NameLanguage;
  /**
   * The sky culture whose figures are drawn (`japanese` or `chinese` from `@johnmorrisdotca/hoshi-stars/cultures/…`, or one made with `defineCulture`): its figures, in its order, each keyed by
   * its id. Left out, the 88 constellations of the IAU. A new culture in `set` lets the picked figure go.
   */
  culture?: Culture | undefined;
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
  /** The constellation's IAU abbreviation (`Ori`); in a culture's sky, the figure's id (`Ori` for a constellation, `subaru`, `bei3-dou3`). */
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
  /** The line ends laid out by the last `update`, four numbers for each line: x and y of one end, x and y of the other. Reused, until `set` takes a new culture; read only up to `4 * count`. */
  readonly segments: Float32Array;
  /** How many lines the last `update` laid out. */
  readonly count: number;
  /** The figures (the 88, in the order of the catalogue, or the culture's, in its order), each with the lines of `segments` that belong to it. */
  readonly figures: readonly FigureOnScreen[];
  /** The figure the pointer is on, or `undefined`. */
  readonly picked: FigureOnScreen | undefined;
  /** The picked figure's name and where to draw it, or `undefined` when none is picked. */
  readonly name: FigureName | undefined;
  /**
   * Change the settings; the next `update` uses them. Every setting is replaced, so `set({ strength })` alone goes back to the 88, in English, in the default look: keep the rest with
   * `lines.set({ ...lines.settings, strength })`. A new `culture` makes the figures again: `segments` and `figures` are new objects after it.
   */
  set(settings: FigureLinesSettings): void;
  /** The opacity to draw a figure's lines at: the picked figure's is 1, every other is the strength. 0 for all when the strength is 0. */
  opacityOf(figure: FigureOnScreen): number;
  /**
   * Lay the lines out for the screen as it is now. Call it when the view, the size or the settings changed. A picked figure that is no longer in view is let go.
   * A line with both ends behind `covered` is left out, and a line that crosses it is cut where it meets the body. A figure cannot be picked through the body, and its name is not placed on it.
   *
   * @param project - Where a star is on the screen.
   * @param view - The part of the screen the lines are drawn in.
   * @param avoid - Optional: boxes the picked figure's name must stay clear of, such as `StarNames.labels` (the array may be the live one; it is read when a name is placed).
   * @param covered - Optional: the same cover a star's name takes. True where a body hides the sky.
   * @returns How many lines are in view.
   */
  update(project: SkyProjector, view: SkyView, avoid?: readonly Box[], covered?: CoverMask): number;
  /**
   * Say where the pointer (or a finger) is, in the page's pixels, or call with nothing when it has left. The figure with a line or a star nearest the point, within `reach` pixels, is picked: on a star of the figure lights the whole figure, as on a line.
   *
   * @param x - The pointer's x.
   * @param y - The pointer's y.
   * @returns `true` when the picked figure changed, which is when the page should draw once more; `false` when nothing changed and nothing needs to be drawn.
   */
  point(x?: number, y?: number): boolean;
  /**
   * Pick the next figure in view, or the one before (for the keyboard): in the catalogue's order, round from the last to the first, skipping figures with no line in view. With none picked, `1` starts at the first and `-1` at the last.
   *
   * @param direction - `1` for the next figure, `-1` for the one before.
   * @returns `true` when the picked figure changed; `false` when no figure is in view or the strength is 0.
   */
  step(direction: 1 | -1): boolean;
}
