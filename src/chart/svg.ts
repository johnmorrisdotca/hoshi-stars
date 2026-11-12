// The sky chart as one SVG string, for a page that runs no script element, a server, a build or a print: the same drawing as the demo's chart and <hoshi-chart>, with its own night background.
// Pure: no clock, nothing fetched. Text is measured with a canvas where the page has one and with a built-in width table elsewhere, so the names sit the same way the demo sets them.
import type { Culture } from "../culture.ts";
import type { Projection } from "../projection.ts";
import { chart, defaultZoom, type Hit, type Language, type Layer } from "./chart.ts";
import type { MarkerRange, SkyMarker } from "./markers.ts";

/**
 * The layers a published chart draws: the Milky Way, the figures' lines, the constellation boundaries, the names, the deep-sky objects, the black holes and the grid.
 *
 * @example
 * ```js
 * import { CHART_LAYERS } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * console.log(CHART_LAYERS.join(" "));
 * // milky lines boundaries names deep holes grid
 * ```
 */
export const CHART_LAYERS = ["milky", "lines", "boundaries", "names", "deep", "holes", "grid"] as const satisfies readonly Layer[];
/**
 * One of `CHART_LAYERS`.
 *
 * @example
 * ```ts
 * import type { ChartLayer } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const layers: ChartLayer[] = ["lines", "boundaries"];
 * console.log(layers.length);
 * // 2
 * ```
 */
export type ChartLayer = (typeof CHART_LAYERS)[number];
/** The layers drawn when none are named: the Milky Way, the lines, the names and the grid, as the demo opens. */
export const DEFAULT_CHART_LAYERS: readonly ChartLayer[] = ["milky", "lines", "names", "grid"];
/** The faintest star drawn at the opening zoom when none is named: magnitude 5, about as many stars as a dark country sky shows. */
export const DEFAULT_CHART_MAGNITUDE = 5;
/** The night colour behind the chart. */
export const CHART_BACKGROUND = "#0b1020";

/**
 * What to draw. Only `width` and `height` are needed; everything else starts where the demo starts.
 *
 * @example
 * ```ts
 * import { chartSvg, type ChartSvgOptions } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const options: ChartSvgOptions = { width: 480, height: 320, projection: "orthographic", ra: 10.7, dec: 41.3, zoom: 6, lang: "ja" };
 * console.log(chartSvg(options).includes('aria-label="星図"'));
 * // true
 * ```
 */
export interface ChartSvgOptions {
  /** The size in CSS pixels; the SVG's `viewBox` is this size and it scales with its box. */
  width: number;
  height: number;
  /** The projection: `stereographic` (the default), `orthographic`, `gnomonic`, `equidistant`, `equirectangular`, `mollweide` or `hammer`. */
  projection?: Projection | undefined;
  /** The point in the middle, in degrees: right ascension 0 to 360 and declination -90 to 90 (Orion's, 84 and 0, by default). */
  ra?: number | undefined;
  dec?: number | undefined;
  /** How far in: 1 is the projection's own fit; left out, the zoom the projection opens at for this size. */
  zoom?: number | undefined;
  /** The faintest star at that zoom (5); zooming in shows fainter ones, as a telescope does. */
  magnitude?: number | undefined;
  /** What to draw over the stars (`DEFAULT_CHART_LAYERS` when left out); an empty list draws the stars alone. */
  layers?: readonly ChartLayer[] | undefined;
  /** The language of the names: `en` (the default) or `ja`. */
  lang?: Language | undefined;
  /** The sky culture whose figures and names are drawn: the Western sky when left out. Pass `japanese` or `chinese` from `@johnmorrisdotca/hoshi-stars/cultures/…`. */
  culture?: Culture | undefined;
  /** A figure to show brighter, with its boundary when it is a constellation: a constellation's abbreviation (`Ori`), or a figure's id in the Japanese and Chinese skies. */
  constellation?: string | undefined;
  /** The star (its HR number, `2491` for Sirius) or Messier object (`M42`) to mark as picked. */
  picked?: string | undefined;
  /** Your own points, each with a place and, if you like, a date, a name, a colour, a size and a group (`SkyMarker`). They are drawn over the stars and their names are placed clear of the stars and of each other. */
  markers?: readonly SkyMarker[] | undefined;
  /** Show only the markers dated inside it (`{ from, to, fade? }`, ISO texts, milliseconds or `Date`s); a marker with no date is always shown. Every marker when left out. */
  timeRange?: MarkerRange | undefined;
  /** Join a group of markers with a line in date order: `true` for every group, or the groups' names (`["Comet"]`). No lines when left out. */
  tracks?: boolean | readonly string[] | undefined;
  /** The SVG's accessible name: "Star chart" (星図 in Japanese) when left out. */
  label?: string | undefined;
  /**
   * The width of a text in pixels for a CSS `font` (`"400 11px system-ui, sans-serif"`), which the names are laid out by. Left out: a canvas where there is a document, else a built-in table, so a
   * browser and a server can place a name a little differently. Pass your own (a font's metrics, or a fixed width a character) for the same SVG everywhere.
   */
  measure?: ((text: string, font: string) => number) | undefined;
}

/** The view and the drawing options `chart` takes, from `ChartSvgOptions`. */
export function chartInput(o: ChartSvgOptions): Parameters<typeof chart>[0] {
  const projection = o.projection ?? "stereographic";
  const layers = new Set<Layer>((o.layers ?? DEFAULT_CHART_LAYERS).filter((layer) => (CHART_LAYERS as readonly string[]).includes(layer)));
  return {
    projection,
    ra: o.ra ?? 84,
    dec: o.dec ?? 0,
    zoom: o.zoom ?? defaultZoom(projection, o.width, o.height),
    width: o.width,
    height: o.height,
    magnitude: o.magnitude ?? DEFAULT_CHART_MAGNITUDE,
    layers,
    lang: o.lang ?? "en",
    culture: o.culture,
    highlight: o.constellation,
    picked: o.picked,
    markers: o.markers,
    timeRange: o.timeRange,
    tracks: o.tracks,
    measure: o.measure,
  };
}

const escapeAttribute = (text: string): string => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * The sky chart as a complete SVG element, as a string: the stars, and the layers asked for, laid out for `width` by `height`, on the night background. Pure: it reads no clock and fetches nothing.
 *
 * @param options - The size, and where and how to look (see `ChartSvgOptions`).
 * @returns An `<svg>` with a `viewBox` of the size, `role="img"` and an accessible name; put it in a page as it is.
 *
 * @example
 * ```js
 * import { chartSvg } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const svg = chartSvg({ width: 640, height: 400, constellation: "Ori" });
 * console.log(svg.startsWith("<svg"), svg.includes('viewBox="0 0 640 400"'));
 * // true true
 * ```
 */
export function chartSvg(options: ChartSvgOptions): string {
  const out = chart(chartInput(options));
  const label = options.label ?? (options.lang === "ja" ? "星図" : "Star chart");
  const { width, height } = options;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeAttribute(label)}"><rect width="${width}" height="${height}" fill="${CHART_BACKGROUND}"/>${out.svg}</svg>`;
}

export type { Hit, Language };
