// The chart as one SVG string: the options a page writes (or the element's attributes) turned into what `chart` draws. The element and `chartSvg` both come through here, so they draw the same.
import { DEFAULT_VIEW, ZOOM_MAX, ZOOM_MIN, chart, defaultZoom, type Box, type Hit, type Language, type Theme } from "./draw.ts";
import { have, layerSet, type Layer, type LayerName } from "./data.ts";
import { PROJECTIONS, type Projection } from "../projection.ts";

/** The layers a chart has when it is not told: the same as the embed page's. */
export const DEFAULT_LAYERS: readonly LayerName[] = ["milky-way", "lines", "names", "grid"];
/** The faintest star a chart draws when it is not told, and the range it may be asked for. */
export const DEFAULT_MAGNITUDE = 5;
export const MAGNITUDE_MIN = 2;
export const MAGNITUDE_MAX = 6;

/**
 * What a sky chart is drawn from. Every part may be left out: the chart then opens on Orion, about 90 degrees across a desk-wide chart, 800 by 600 pixels, with the Milky Way, the constellation lines and names and a grid, in English, as a night sky.
 *
 * @example
 * ```ts
 * import type { ChartSvgOptions } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const options: ChartSvgOptions = { projection: "hammer", ra: 266, dec: -29, zoom: 1, layers: ["lines", "names"], lang: "ja" };
 * console.log(options.projection);
 * ```
 */
export interface ChartSvgOptions {
  /** Pixels across and down. Default 800 by 600. */
  width?: number | undefined;
  height?: number | undefined;
  /** One of the seven: `stereographic` (the default), `orthographic`, `gnomonic`, `equidistant`, `equirectangular`, `mollweide` or `hammer`. */
  projection?: Projection | undefined;
  /** The point in the middle, in degrees: right ascension 0 to 360 (84 by default) and declination -90 to 90 (0). */
  ra?: number | undefined;
  dec?: number | undefined;
  /** How far in, 0.1 to 500; 1 shows the whole sky (or a hemisphere) in the smaller side. Left out, the opening view: Orion about 90 degrees wide on a desk, 60 on a phone. */
  zoom?: number | undefined;
  /** The faintest star drawn, 2 to 6. Default 5. */
  magnitude?: number | undefined;
  /** The layers: `milky-way`, `lines`, `boundaries`, `names`, `deep-sky` (the Messier objects) and `grid`. Default `milky-way`, `lines`, `names` and `grid`. */
  layers?: Iterable<LayerName> | undefined;
  /** A constellation (its abbreviation, `Ori`) drawn brighter, with its boundary. */
  constellation?: string | undefined;
  /** `en` (default) or `ja`: the names of the constellations and stars. */
  lang?: Language | undefined;
  /** `dark` (the night sky, default) or `light` (ink on paper). */
  theme?: Theme | undefined;
  /** A star (`S:2491`, the HR number), a Messier object (`D:M31`) or a constellation (`C:Ori`) to pick: what is near it is ringed. */
  near?: string | undefined;
  /** How nearness is measured for a star: `sky` (degrees apart on the sky, the default) or `space` (light-years). */
  by?: "sky" | "space" | undefined;
  /** Rectangles in chart pixels that no name may cover, such as a button laid over the chart. */
  keepClear?: readonly Box[] | undefined;
}

const number = (value: number | undefined, fallback: number, low: number, high: number): number => (value === undefined || !Number.isFinite(value) ? fallback : Math.max(low, Math.min(high, value)));

/** What an options object comes to once the missing and the out-of-range parts are at their defaults. */
export function resolve(o: ChartSvgOptions): { width: number; height: number; projection: Projection; view: { ra: number; dec: number; zoom: number }; magnitude: number; layers: Set<Layer> } {
  const width = Math.max(1, Math.round(number(o.width, 800, 1, 1e5)));
  const height = Math.max(1, Math.round(number(o.height, 600, 1, 1e5)));
  const projection: Projection = o.projection !== undefined && (PROJECTIONS as readonly string[]).includes(o.projection) ? o.projection : DEFAULT_VIEW.projection;
  return {
    width,
    height,
    projection,
    view: {
      ra: ((number(o.ra, DEFAULT_VIEW.ra, -1e6, 1e6) % 360) + 360) % 360,
      dec: number(o.dec, DEFAULT_VIEW.dec, -90, 90),
      zoom: number(o.zoom, defaultZoom(projection, width, height), ZOOM_MIN, ZOOM_MAX),
    },
    magnitude: number(o.magnitude, DEFAULT_MAGNITUDE, MAGNITUDE_MIN, MAGNITUDE_MAX),
    layers: layerSet(o.layers ?? DEFAULT_LAYERS),
  };
}

/** The chart and what a tap can land on: used by the element, which keeps the hits. */
export function drawSvg(o: ChartSvgOptions, label: string | false): { svg: string; hits: Hit[] } {
  const r = resolve(o);
  const pick = o.near !== undefined && /^[SDC]:[\w.-]+$/.test(o.near) ? o.near : undefined;
  const found = pick === undefined ? undefined : have("nearby").nearbyOf(pick, o.by === "space" ? "space" : "sky");
  const highlight = o.constellation !== undefined && o.constellation !== "" ? o.constellation : pick?.startsWith("C:") ? pick.slice(2) : undefined;
  const drawn = chart({
    projection: r.projection,
    ...r.view,
    width: r.width,
    height: r.height,
    magnitude: r.magnitude,
    layers: r.layers,
    lang: o.lang === "ja" ? "ja" : "en",
    theme: o.theme === "light" ? "light" : "dark",
    highlight,
    near: found === undefined ? [] : found.rows.map((row) => row.key),
    picked: pick !== undefined && !pick.startsWith("C:") ? pick.slice(2) : undefined,
    keepClear: o.keepClear,
  });
  const aria = label === false ? ' aria-hidden="true"' : ` role="img" aria-label="${label.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r.width} ${r.height}" width="${r.width}" height="${r.height}"${aria}>${drawn.svg}</svg>`, hits: drawn.hits };
}

/**
 * A sky chart as an SVG string, for a page that runs no element: a server, a print, an email. Pure: the same options give the same string. The stars, the constellation lines and names and the grid are ready; a chart that asks for `milky-way`,
 * `boundaries`, `deep-sky`, a `constellation` or `near` needs its data read first, once, with `await loadChartData(options)`, and this throws, saying so, when it is not there.
 *
 * @param options - What to draw; every part may be left out.
 * @returns A string that starts `<svg` and ends `</svg>`, sized `width` by `height`.
 *
 * @example
 * ```ts
 * import { chartSvg } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const svg = chartSvg({ width: 400, height: 300, layers: ["lines", "names"], lang: "ja" });
 * console.log(svg.startsWith("<svg"), svg.includes("オリオン座"));
 * ```
 *
 * @example
 * ```ts
 * import { chartSvg, loadChartData } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const options = { projection: "mollweide", zoom: 1, layers: ["milky-way", "deep-sky", "grid"] } as const;
 * await loadChartData(options);
 * console.log(chartSvg(options).includes('data-layer="milky"'));
 * ```
 */
export function chartSvg(options: ChartSvgOptions = {}): string {
  return drawSvg(options, options.lang === "ja" ? "星空の図" : "A chart of the sky").svg;
}
