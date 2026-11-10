// How big the whole-sky page draws the Bright Star Catalogue's stars, by magnitude and zoom. Pure: no DOM. `whole-sky-draw.ts` draws with it and lays the names clear of the dots it makes.
// At the whole sky (zoom 1) the sizes are the page's own three: bright, middle and faint. From there they grow into the sky chart's rule at the same pixels to the degree (`growOf`, the radius by magnitude), so that a
// magnitude-2 star is as plain a mark here at 10x as it is on the sky map at the same field, and a brighter star is never smaller than a fainter one.
import { growOf } from "./chart.ts";
import { chartZoomOf, WHOLE_SKY_MAGNITUDE } from "./whole-sky-field.ts";

/** The stars come in bins of magnitude, each one path: a bin is as big as its `rep` magnitude says. `cls` is the page's size class (the faintest class is hidden when the map is zoomed out). */
export interface StarBin {
  cls: "bright" | "mid" | "faint";
  /** The faintest magnitude in the bin (a star of exactly this is in). */
  upTo: number;
  /** The magnitude the bin is drawn as. */
  rep: number;
}

/** From the brightest to the faintest. The classes are the page's three (to 2.5, to 4.5, the rest); the bins inside them are what lets the size follow the magnitude once zoomed in. */
export const STAR_BINS: readonly StarBin[] = [
  { cls: "bright", upTo: 0.5, rep: -0.25 },
  { cls: "bright", upTo: 1.5, rep: 1 },
  { cls: "bright", upTo: 2.5, rep: 2 },
  { cls: "mid", upTo: 3, rep: 2.75 },
  { cls: "mid", upTo: 3.5, rep: 3.25 },
  { cls: "mid", upTo: 4, rep: 3.75 },
  { cls: "mid", upTo: 4.5, rep: 4.25 },
  { cls: "faint", upTo: 5, rep: 4.75 },
  { cls: "faint", upTo: 5.5, rep: 5.25 },
  { cls: "faint", upTo: Infinity, rep: 5.85 },
];

/** The size of a dot at the whole sky, by class, for the night map and for paper (pixels across). */
export const STAR_BASE = {
  night: { bright: 3.6, mid: 2.2, faint: 1.2 },
  paper: { bright: 3.2, mid: 1.9, faint: 1.1 },
} as const;

/** The zoom where the growth is complete: between 1 and here the size slides from the page's own to the sky chart's. */
export const STAR_GROWN_AT = 3;
/** The thin ring of the sky's colour round a bright star, in pixels, once grown: where a line meets a star, the line stops short of the dot. */
export const STAR_RING = 1.2;
/** Only the bins up to this many (the stars to magnitude 3) get a ring. */
export const RING_BINS = 4;

/** The index of the bin a magnitude falls in. */
export function binOf(magnitude: number): number {
  const i = STAR_BINS.findIndex((bin) => magnitude <= bin.upTo);
  return i < 0 ? STAR_BINS.length - 1 : i;
}

/** How far the growth has gone at a zoom: 0 at the whole sky (nothing changes), 1 from `STAR_GROWN_AT` on. */
export const growthAt = (zoom: number): number => Math.min(1, Math.max(0, (zoom - 1) / (STAR_GROWN_AT - 1)));

/**
 * The width of a dot of magnitude `rep` at a zoom, in pixels. At zoom 1 it is `base`; zoomed in it slides to the sky chart's size for that magnitude at the same pixels to the degree
 * (`2 x (limit - magnitude) x 0.55 + 1.1`, times `growOf`), never less than `base`.
 */
export function starWidth(rep: number, zoom: number, base: number): number {
  const t = growthAt(zoom);
  if (t === 0) return base;
  const chart = 2 * Math.max(0.7, (WHOLE_SKY_MAGNITUDE - Math.max(rep, -2)) * 0.55 + 1.1) * growOf(chartZoomOf(zoom));
  return Math.round((base + (Math.max(base, chart) - base) * t) * 100) / 100;
}

/** The width of a bin's dots at a zoom, for the night map or for paper. */
export const binWidth = (bin: number, zoom: number, look: "night" | "paper"): number => starWidth(STAR_BINS[bin]!.rep, zoom, STAR_BASE[look][STAR_BINS[bin]!.cls]);

/** The width of the ring round a bin's dots at a zoom (0 at the whole sky and for the bins that have none). */
export const ringWidth = (bin: number, zoom: number): number => (bin < RING_BINS ? Math.round(2 * STAR_RING * growthAt(zoom) * 100) / 100 : 0);
