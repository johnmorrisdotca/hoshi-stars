// The sky chart the demo and the embed page draw: stars, constellation lines, boundaries, names, Messier objects and a grid, as one SVG string, in any of the seven projections.
// It only calls the package: the numbers (positions, colours, outlines, figures) are the package's; the pixels are decided here.
import { blackBodyColour, starByHr, starColour, starTemperatureK, stars, type Star } from "../src/index.ts";
import { boundaries, constellationAt } from "../src/boundaries.ts";
import type { Constellation } from "../src/constellations.ts";
import { blackHoles, type BlackHole } from "../src/black-holes.ts";
import { messier, type DeepSkyObject } from "../src/deep-sky.ts";
import { pictureCorners, type DeepSkyPicture } from "../src/deep-sky-pictures.ts";
import { drawnPictures } from "./picture-quality.ts";
import { deepSkyShape, offsetOnSky, type DeepSkyShape } from "../src/deep-sky-shape.ts";
import { DEEP_COLOURS, drawDeep } from "./deep-draw.ts";
import { figures, type CultureFigure } from "../src/lines.ts";
import type { Culture } from "../src/culture.ts";
import { western } from "../src/cultures/western.ts";
import { milkyWayBands } from "../src/milky-way.ts";
import { faintMarks, type FaintDraw } from "./faint-layer.ts";
import { project, unproject, type Projection, type SkyPoint } from "../src/projection.ts";
import type { SeenSky } from "../src/sky-from.ts";
import { placeLabels, textSize, type Box } from "./labels.ts";
import { figureLinesSvg, figureNameSvg, starNamesSvg } from "./sky-labels-svg.ts";
import type { FigureLines, StarNames } from "../src/sky-labels.ts";

export { FAINT_DOT_CAP, faintDepthOf, FAINT_FROM, FAINT_JUMP_ZOOM, FAINT_PAST_GAP, type FaintDraw } from "./faint-layer.ts";
export const LAYERS = ["milky", "lines", "boundaries", "names", "deep", "pictures", "holes", "faint", "grid"] as const;
export type Layer = (typeof LAYERS)[number];
export type Language = "en" | "ja";

/** Where the chart looks: the projection, the point in the middle (degrees) and the zoom, 1 being the projection's own fit. */
export interface View {
  projection: Projection;
  ra: number;
  dec: number;
  zoom: number;
}

export interface ChartOptions extends View {
  width: number;
  height: number;
  magnitude: number;
  layers: ReadonlySet<Layer>;
  lang: Language;
  /** The sky culture whose figures and names are drawn: the Western sky (the 88 constellations and the asterisms) when left out. */
  culture?: Culture | undefined;
  /** The figure (a constellation's abbreviation in the Western and Japanese cultures, else the figure's id) to show brighter, with its boundary when it is a constellation, even when boundaries are off. */
  highlight?: string | undefined;
  /** The star (HR number) or Messier object (`M31`) that is picked. */
  picked?: string | undefined;
  /** The black hole (its id, `cygnus-x-1`) that is picked; it is drawn and named even when the black-hole layer is off. */
  pickedHole?: string | undefined;
  /** What is near the picked thing, drawn ringed: keys `S:<HR number>`, `D:<Messier id>` and `C:<abbreviation>`. */
  near?: readonly string[] | undefined;
  /** The sky seen from another star (`skyFrom`): the stars are drawn where it puts them, with its magnitudes, and the lines join them there. A star it leaves out (no distance) is not drawn, nor a line to it. The boundaries are the Earth's and are not drawn. */
  sky?: SeenSky | undefined;
  /** Rectangles in chart pixels that no name may cover, such as the page's own buttons laid over the chart. */
  keepClear?: readonly Box[] | undefined;
  /** The faint stars of UCAC4 in the field (`faintFor`), drawn when the `faint` layer is on and the zoom reaches them. */
  faint?: FaintDraw | undefined;
  /** The deep-sky objects drawn: the Messier objects when left out; a page that has fetched the NGC and IC objects passes them all, with `shapeOf` from `deep-sky/ngc-ic-shape`. */
  catalogue?: readonly DeepSkyObject[] | undefined;
  /** The size, axis ratio and angle of an object: the Messier objects' when left out. */
  shapeOf?: ((object: DeepSkyObject) => DeepSkyShape) | undefined;
  /** The ids of the pictures that have been fetched and may be drawn (the `pictures` layer), and where the package's `pictures/` folder is served from (`./` when left out). */
  readyPictures?: ReadonlySet<string> | undefined;
  pictureBase?: string | undefined;
  /** The `sky-labels` tier, laid out by the caller for this very view: faint constellation lines with the picked figure at full strength (they replace the `lines` layer), and names on the brightest stars (they replace the chart's own star names). */
  overlay?: { lines?: FigureLines | undefined; names?: StarNames | undefined } | undefined;
}

/** What a tap can land on, in chart pixels. */
export interface Hit {
  x: number;
  y: number;
  kind: "star" | "deep" | "hole";
  key: string;
  /** For a deep-sky object drawn large: how far from its middle a tap still lands on it. */
  reach?: number | undefined;
}

export const DEFAULT_VIEW: View = { projection: "stereographic", ra: 84, dec: 0, zoom: 1 };
/**
 * The least zoom: the whole sky, small. The most: 8,000, where the smallest deep-sky object that has a picture, the Ring Nebula (M57, 1 arc-minute across in the package's table), fills about 0.58 of the smaller side of the chart whatever its size
 * (a chart's pixels for an arc-minute are its smaller side times 7.3e-5 times the zoom, so 1 arc-minute is `side * 0.58` pixels at 8,000), about 3 arc-minutes across the chart. Where the picture under the middle runs out of detail first, `pictureZoomCap` stops the zoom sooner.
 */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8000;
const WIDE: readonly Projection[] = ["equirectangular", "mollweide", "hammer"];
const SQRT8 = Math.sqrt(8);

/** Pixels for one unit of the projection's sphere at zoom 1: the whole sky (or a hemisphere) fits the smaller side. */
export function fitScale(kind: Projection, width: number, height: number): number {
  const side = Math.min(width, height);
  switch (kind) {
    case "stereographic": return side / 4;
    case "orthographic": return side / 2.1;
    case "gnomonic": return side / 2.4;
    case "equidistant": return side / Math.PI;
    case "equirectangular": return Math.min(width / (2 * Math.PI), height / Math.PI);
    default: return Math.min(width / (2 * SQRT8), height / SQRT8);
  }
}

/** The zoom that opens the chart on Orion about 90 degrees wide on a desk and 60 on a phone (a chart under 600 pixels wide), measured across the middle. */
export function defaultZoom(kind: Projection, width: number, height: number): number {
  const half = width < 600 ? 30 : 45;
  const edge = project(kind, { rightAscension: DEFAULT_VIEW.ra + half, declination: DEFAULT_VIEW.dec }, { centre: { rightAscension: DEFAULT_VIEW.ra, declination: DEFAULT_VIEW.dec }, scale: fitScale(kind, width, height) });
  const zoom = edge === undefined || edge.x === 0 ? 1 : width / 2 / Math.abs(edge.x);
  return Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) * 100) / 100;
}

const scaleOf = (o: View, width: number, height: number): number => fitScale(o.projection, width, height) * o.zoom;
const centreOf = (o: View): SkyPoint => ({ rightAscension: o.ra, declination: o.dec });
const wrap180 = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180;
const wrap360 = (degrees: number): number => ((degrees % 360) + 360) % 360;
const round = (n: number): string => n.toFixed(1);
const escapeXml = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Where a point of the sky lands in the chart's pixels, or `undefined` when it is on the far side. */
export function toScreen(view: View, width: number, height: number, point: SkyPoint): [number, number] | undefined {
  const p = project(view.projection, point, { centre: centreOf(view), scale: scaleOf(view, width, height) });
  return p === undefined ? undefined : [width / 2 + p.x, height / 2 - p.y];
}

/** The point of the sky under a pixel of the chart, or `undefined` off the sky. */
export function fromScreen(view: View, width: number, height: number, x: number, y: number): SkyPoint | undefined {
  return unproject(view.projection, { x: x - width / 2, y: height / 2 - y }, { centre: centreOf(view), scale: scaleOf(view, width, height) });
}

/** The view after the sky is dragged by `dx`, `dy` pixels: the middle moves to what was that far the other way. */
export function dragged(view: View, width: number, height: number, dx: number, dy: number): View {
  const at = unproject(view.projection, { x: -dx, y: dy }, { centre: centreOf(view), scale: scaleOf(view, width, height) });
  return at === undefined ? view : { ...view, ra: wrap360(at.rightAscension), dec: Math.max(-90, Math.min(90, at.declination)) };
}

const cornerCache = new Map<string, Array<[number, number]>>();
/** The picture's four corners in the tangent plane about its own middle (east, north; radians), the corners in order. */
function cornersOf(picture: DeepSkyPicture): Array<[number, number]> {
  let found = cornerCache.get(picture.id);
  if (found === undefined) {
    found = pictureCorners(picture).map((corner) => tangent(picture.centre, corner));
    cornerCache.set(picture.id, found);
  }
  return found;
}
function tangent(centre: SkyPoint, point: SkyPoint): [number, number] {
  const d = Math.PI / 180;
  const a = (point.rightAscension - centre.rightAscension) * d;
  const sin0 = Math.sin(centre.declination * d);
  const cos0 = Math.cos(centre.declination * d);
  const sin1 = Math.sin(point.declination * d);
  const cos1 = Math.cos(point.declination * d);
  const k = sin0 * sin1 + cos0 * cos1 * Math.cos(a);
  return [(cos1 * Math.sin(a)) / k, (cos0 * sin1 - sin0 * cos1 * Math.cos(a)) / k];
}
/** Whether a point of the sky is on the picture itself (inside its four corners), not only near it. */
export function onPicture(picture: DeepSkyPicture, point: SkyPoint): boolean {
  const [x, y] = tangent(picture.centre, point);
  const ring = cornersOf(picture);
  let side = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    const cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
    if (cross === 0) continue;
    if (side === 0) side = Math.sign(cross);
    else if (Math.sign(cross) !== side) return false;
  }
  return true;
}

/**
 * The most a view may zoom in about the sky under (`x`, `y`) so that no picture there is drawn bigger than its own pixels: one pixel of the finest picture covering that sky is at most one pixel of the chart.
 * Where no picture covers it the answer is `ZOOM_MAX`. It is a limit on zooming in, never a push out: a view already past it stays where it is.
 */
export function pictureZoomCap(view: View, width: number, height: number, x: number, y: number): number {
  const at = fromScreen(view, width, height, x, y);
  if (at === undefined) return ZOOM_MAX;
  let finest = Infinity;
  for (const picture of drawnPictures()) if (picture.arcsecPerPixel < finest && onPicture(picture, at)) finest = picture.arcsecPerPixel;
  if (finest === Infinity) return ZOOM_MAX;
  const here = toScreen(view, width, height, at);
  const east = toScreen(view, width, height, offsetOnSky(at, 1, 0));
  const north = toScreen(view, width, height, offsetOnSky(at, 0, 1));
  if (here === undefined || east === undefined || north === undefined) return ZOOM_MAX;
  const perArcmin = Math.sqrt(Math.hypot(east[0] - here[0], east[1] - here[1]) * Math.hypot(north[0] - here[0], north[1] - here[1]));
  return perArcmin === 0 ? ZOOM_MAX : Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (view.zoom * (60 / finest)) / perArcmin));
}

/** The view zoomed by `factor` with the sky under (`x`, `y`) kept under it, no further in than `most` (`ZOOM_MAX` where left out): a view already past `most` is not zoomed further in, nor pushed out. */
export function zoomedAbout(view: View, width: number, height: number, factor: number, x: number, y: number, most: number = ZOOM_MAX): View {
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, view.zoom * factor, Math.max(most, view.zoom)));
  const under = fromScreen(view, width, height, x, y);
  const next = { ...view, zoom };
  if (under === undefined) return next;
  const now = toScreen(next, width, height, under);
  return now === undefined ? next : dragged(next, width, height, x - now[0], y - now[1]);
}

/** How much bigger the stars are drawn as the chart zooms in. */
/** The faintest star in the catalogue: zooming in never asks for more than there is. */
const CATALOGUE_FAINTEST = Math.max(...stars().map((star) => star.magnitude));

/**
 * The faintest magnitude drawn: the slider's limit at 1x, and fainter as you zoom in, as a telescope shows more (2.5 magnitudes
 * for each tenfold zoom), up to the faintest star there is.
 */
export const depthOf = (magnitude: number, zoom: number): number =>
  Math.round(Math.min(CATALOGUE_FAINTEST, magnitude + 2.5 * Math.log10(Math.max(1, zoom))) * 100) / 100;

export const growOf = (zoom: number): number => Math.round(Math.min(1.8, 0.8 + zoom * 0.12) * 100) / 100;

/** Whether a segment between two sky points would run across the seam of a whole-sky projection, and so must not be drawn. */
function crossesSeam(view: View, a: SkyPoint, b: SkyPoint): boolean {
  if (!WIDE.includes(view.projection)) return false;
  const da = wrap180(a.rightAscension - view.ra);
  const db = wrap180(b.rightAscension - view.ra);
  return Math.sign(da) !== Math.sign(db) && Math.abs(da) + Math.abs(db) > 180;
}

type Placer = (point: SkyPoint) => [number, number] | undefined;

function placer(view: View, width: number, height: number): Placer {
  const reach = Math.max(6 * Math.max(width, height), 1e5);
  return (point) => {
    const at = toScreen(view, width, height, point);
    return at === undefined || Math.abs(at[0] - width / 2) > reach || Math.abs(at[1] - height / 2) > reach ? undefined : at;
  };
}

/** A path through sky points, lifted at the far side, at the seam and where a point is out of reach. */
function pathOf(view: View, place: Placer, points: readonly SkyPoint[]): string {
  let d = "";
  let last: SkyPoint | undefined;
  for (const point of points) {
    const at = place(point);
    if (at === undefined) {
      last = undefined;
      continue;
    }
    d += last === undefined || crossesSeam(view, last, point) ? `M${round(at[0])} ${round(at[1])}` : `L${round(at[0])} ${round(at[1])}`;
    last = point;
  }
  return d;
}

interface Figures {
  list: CultureFigure[];
  centroids: Map<string, SkyPoint>;
}
const cultureFigures = new Map<string, Figures>();
/** A culture's figures and the middle of each, where its name goes. */
function figuresOfCulture(culture: Culture): Figures {
  let found = cultureFigures.get(culture.id);
  if (found === undefined) {
    const list = figures(culture);
    const centroids = new Map<string, SkyPoint>();
    for (const figure of list) {
      let x = 0;
      let y = 0;
      let z = 0;
      for (const star of figure.stars) {
        const ra = (star.rightAscension * Math.PI) / 180;
        const dec = (star.declination * Math.PI) / 180;
        x += Math.cos(dec) * Math.cos(ra);
        y += Math.cos(dec) * Math.sin(ra);
        z += Math.sin(dec);
      }
      centroids.set(figure.asterism.id, { rightAscension: wrap360((Math.atan2(y, x) * 180) / Math.PI), declination: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI });
    }
    found = { list, centroids };
    cultureFigures.set(culture.id, found);
  }
  return found;
}

/** The figures of a culture (the Western sky when left out), for a page that lists them. */
export const figuresOf = (culture: Culture = western): readonly CultureFigure[] => figuresOfCulture(culture).list;

/** The figure of a culture by its id. */
export const figureById = (id: string, culture: Culture = western): CultureFigure | undefined => figuresOfCulture(culture).list.find((f) => f.asterism.id === id);

/** What a figure is called on the chart: a constellation by its Latin name (its Japanese one in Japanese); a figure of the Japanese or Chinese sky in its own characters; a Western asterism by its English name (its Japanese one, if it has one, in Japanese). */
export function labelOf(figure: CultureFigure, culture: Culture, lang: Language): string {
  const a = figure.asterism;
  if (a.kind === "constellation") return lang === "ja" ? a.names.ja ?? a.name : a.names.la ?? a.name;
  if (culture.id === "western") return lang === "ja" ? a.names.ja ?? a.names.en ?? a.name : a.names.en ?? a.name;
  return a.name;
}

function centroidOf(id: string, culture: Culture): SkyPoint | undefined {
  return figuresOfCulture(culture).centroids.get(id);
}

/** The middle of each figure as the stars of the sky seen from another star put it, from the figure's stars that sky holds (two at least). */
function centroidsSeen(sky: SeenSky, culture: Culture): Map<string, SkyPoint> {
  const seen = new Map(sky.map((star) => [star.id, star]));
  const found = new Map<string, SkyPoint>();
  for (const figure of figuresOfCulture(culture).list) {
    let x = 0;
    let y = 0;
    let z = 0;
    let count = 0;
    for (const star of figure.stars) {
      const at = seen.get(`hr-${star.hr}`);
      if (at === undefined) continue;
      const ra = (at.rightAscension * Math.PI) / 180;
      const dec = (at.declination * Math.PI) / 180;
      x += Math.cos(dec) * Math.cos(ra);
      y += Math.cos(dec) * Math.sin(ra);
      z += Math.sin(dec);
      count++;
    }
    if (count >= 2) found.set(figure.asterism.id, { rightAscension: wrap360((Math.atan2(y, x) * 180) / Math.PI), declination: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI });
  }
  return found;
}

/** The middle of a figure (degrees), for flying to it. */
export const centreOfConstellation = (id: string, culture: Culture = western): SkyPoint | undefined => centroidOf(id, culture);

/** How far (degrees) a figure reaches from its middle: the zoom that shows all of it comes from this. */
export function reachOfConstellation(id: string, culture: Culture = western): number {
  const middle = centroidOf(id, culture);
  const figure = figureById(id, culture);
  if (middle === undefined || figure === undefined) return 30;
  const rad = Math.PI / 180;
  let far = culture.id === "chinese" ? 1.5 : 5;
  for (const star of figure.stars) {
    const c = Math.sin(middle.declination * rad) * Math.sin(star.declination * rad) + Math.cos(middle.declination * rad) * Math.cos(star.declination * rad) * Math.cos((middle.rightAscension - star.rightAscension) * rad);
    far = Math.max(far, Math.acos(Math.max(-1, Math.min(1, c))) / rad);
  }
  return far;
}

/** The Milky Way's bands, faint to bright: the colour, and how much of the night sky each one lightens. The glow is cool, the core warm. */
const MILKY = { levels: [0.04, 0.08, 0.13, 0.2, 0.3, 0.42, 0.58, 0.76], fills: ["#6a80c8", "#7a90d2", "#8da1dc", "#a6b6e6", "#c3cdee", "#e0e4f2", "#f7eedd", "#fff3d8"], opacities: [0.16, 0.14, 0.14, 0.14, 0.15, 0.16, 0.18, 0.2] } as const;

/** Constellation boundaries are dashed on every map of the demo (this one and the whole-sky page): dash and gap in pixels. */
export const BOUNDARY_DASH = [5, 4] as const;

const COLOURS = { ground: "#0b1020", grid: "#25304f", equator: "#3a4a78", lines: "#6f93e0", linesOn: "#ffd86b", asterism: "#c792ea", asterismName: "#c9a8ec", boundary: "#46578c", boundaryOn: "#ffd86b", name: "#8da3d8", nameOn: "#ffe49a", star: "#f4f6ff", deep: "#e0a458", pick: "#ff7a59", near: "#5fe0c4", hole: "#d68cff", holeCore: "#04060d" };


/** The black hole's own symbol, `k` times its full size (smaller when the chart is zoomed out, so a crowded patch stays readable): a dark disc ringed in violet with a jet each way for a stellar-mass one, a dashed ring round a dark centre for a quiet one, a dark disc inside a tilted ring for a supermassive one. A candidate is drawn fainter. */
function holeShape(hole: BlackHole, x: number, y: number, pick: boolean, k: number): string {
  const cx = Math.round(x * 10) / 10;
  const cy = Math.round(y * 10) / 10;
  const n = (v: number): number => Math.round(v * k * 10) / 10;
  const stroke = pick ? COLOURS.pick : COLOURS.hole;
  const width = Math.max(1, (pick ? 2 : 1.4) * Math.sqrt(k));
  const fade = hole.status === "candidate" && !pick ? ' stroke-opacity=".6"' : "";
  const line = `fill="none" stroke="${stroke}" stroke-width="${width}"${fade}`;
  const core = `fill="${COLOURS.holeCore}" stroke="${stroke}" stroke-width="${width}"${fade}`;
  switch (hole.kind) {
    case "stellar": return `<path d="M${cx} ${cy - n(5.5)}v${-n(4)}M${cx} ${cy + n(5.5)}v${n(4)}" ${line}/><circle cx="${cx}" cy="${cy}" r="${n(3.6)}" ${core}/>`;
    case "quiet": return `<circle cx="${cx}" cy="${cy}" r="${n(4.8)}" ${core} stroke-dasharray="${n(2.2)} ${n(2)}"/>`;
    default: return `<ellipse cx="${cx}" cy="${cy}" rx="${n(8)}" ry="${n(3)}" transform="rotate(-22 ${cx} ${cy})" ${line}/><circle cx="${cx}" cy="${cy}" r="${n(3.2)}" ${core}/>`;
  }
}

/** How big the black holes are drawn: full size from a zoom of 2, down to 0.6 of it when the whole sky is on the chart. */
const holeScale = (zoom: number): number => (zoom >= 2 ? 1 : zoom <= 0.5 ? 0.6 : 0.6 + (0.4 * (zoom - 0.5)) / 1.5);

/** The black holes that are named at any zoom, since they are the ones people look for. */
const FAMOUS_HOLES: ReadonlySet<string> = new Set(["sagittarius-a", "m87", "m31", "cygnus-x-1", "gaia-bh1"]);

interface Place {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  box: Box;
}

interface Label {
  rank: number;
  places: Place[];
  text: string;
  size: number;
  weight: number;
  fill: string;
  opacity: number;
}

/** A label for a marker at (`x`, `y`): to its right, else its left, above or below, else at a corner, `gap` pixels clear of it. */
function besideMarker(text: string, size: number, x: number, y: number, gap: number, fill: string, opacity: number): Omit<Label, "rank"> {
  const { w } = textSize(text, size);
  const top = (base: number): number => base - size * 0.85;
  const row = (base: number, left: number, anchor: Place["anchor"]): Place => ({ x: anchor === "middle" ? left + w / 2 : anchor === "end" ? left + w : left, y: base, anchor, box: { x0: left - 1, y0: top(base), x1: left + w + 1, y1: base + size * 0.3 } });
  const places = [row(y + 4, x + gap, "start"), row(y + 4, x - gap - w, "end"), row(y - gap - 2, x - w / 2, "middle"), row(y + gap + size * 0.85, x - w / 2, "middle"), row(y - gap, x + gap * 0.6, "start"), row(y - gap, x - gap * 0.6 - w, "end"), row(y + gap + size * 0.85, x + gap * 0.6, "start"), row(y + gap + size * 0.85, x - gap * 0.6 - w, "end")];
  return { places, text, size, weight: 400, fill, opacity };
}

/** A name that matters (the picked one, a famous one) is offered more places when the ones beside its marker are taken: further out, `rings` times. */
function withFarther(text: string, x: number, y: number, gap: number, fill: string, rings: number): Omit<Label, "rank"> {
  const near = besideMarker(text, 11, x, y, gap, fill, 1);
  const out = Array.from({ length: rings }, (_, i) => besideMarker(text, 11, x, y, gap + 16 * (i + 1), fill, 1).places);
  return { ...near, places: [...near.places, ...out.flat()] };
}

export interface Chart {
  svg: string;
  hits: Hit[];
  /** The faint stars drawn: how many, and the magnitude they are complete to here. `undefined` where none were asked for. */
  faint?: { drawn: number; depth: number };
  /** The deep-sky pictures the view needs and has not been given: the page fetches them and draws again. */
  wanted: string[];
}

/** A polygon of (longitude from the view's centre, declination) cut to the map's width, in pieces: Sutherland-Hodgman against the two edges, on the polygon and on its copies a turn to either side. */
function withinWidth(ring: Array<[number, number]>): Array<Array<[number, number]>> {
  const EDGE = 179.999;
  const pieces: Array<Array<[number, number]>> = [];
  for (const shift of [-360, 0, 360]) {
    let polygon = ring.map(([u, dec]): [number, number] => [u + shift, dec]);
    if (!polygon.some(([u]) => u > -EDGE) || !polygon.some(([u]) => u < EDGE)) continue;
    for (const [bound, keepAbove] of [[-EDGE, true], [EDGE, false]] as const) {
      const out: Array<[number, number]> = [];
      const inside = (u: number): boolean => (keepAbove ? u >= bound : u <= bound);
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i]!;
        const c = polygon[(i + 1) % polygon.length]!;
        if (inside(a[0])) out.push(a);
        if (inside(a[0]) !== inside(c[0])) out.push([bound, a[1] + ((c[1] - a[1]) * (bound - a[0])) / (c[0] - a[0])]);
      }
      polygon = out;
      if (polygon.length < 3) break;
    }
    if (polygon.length >= 3 && polygon.every(([u]) => u >= -EDGE - 1e-6 && u <= EDGE + 1e-6)) pieces.push(polygon);
  }
  return pieces;
}

/** The Milky Way: a few soft bands of light, each a set of ribbons along the galactic equator, drawn under everything else. */
function milkyWay(view: View, place: Placer, width: number, height: number): string {
  const here = toScreen(view, width, height, centreOf(view));
  const aside = toScreen(view, width, height, { rightAscension: view.ra, declination: view.dec > 89 ? view.dec - 1 : view.dec + 1 });
  const perDegree = here === undefined || aside === undefined ? 4 : Math.hypot(here[0] - aside[0], here[1] - aside[1]);
  const blur = Math.max(1.2, Math.min(16, perDegree * 0.9));
  const margin = 60 + blur * 3;
  const wide = WIDE.includes(view.projection);
  const polygons = (strip: { upper: SkyPoint[]; lower: SkyPoint[] }): Array<Array<[number, number]>> => {
    if (wide) {
      const sky = [...strip.upper, ...strip.lower.slice().reverse()];
      const ring: Array<[number, number]> = [];
      let before = 0;
      for (const p of sky) {
        let u = wrap180(p.rightAscension - view.ra);
        if (ring.length > 0) {
          while (u - before > 180) u -= 360;
          while (u - before < -180) u += 360;
        }
        ring.push([u, p.declination]);
        before = u;
      }
      return withinWidth(ring).map((piece) => {
        // a long edge (the cut along the map's side, the end of a strip) is cut into short ones so that it bends with the projection
        const dense: Array<[number, number]> = [];
        piece.forEach((a, i) => {
          const c = piece[(i + 1) % piece.length]!;
          const n = Math.max(1, Math.ceil(Math.max(Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1])) / 2));
          for (let k = 0; k < n; k++) dense.push([a[0] + ((c[0] - a[0]) * k) / n, a[1] + ((c[1] - a[1]) * k) / n]);
        });
        return dense;
      });
    }
    // a map of one side of the sky: the columns whose two edges are both on it, in runs
    const upper = strip.upper.map((p) => place(p));
    const lower = strip.lower.map((p) => place(p));
    const found: Array<Array<[number, number]>> = [];
    let run: number[] = [];
    const flush = (): void => {
      if (run.length >= 2) found.push([...run.map((k) => upper[k]!), ...run.slice().reverse().map((k) => lower[k]!)] as Array<[number, number]>);
      run = [];
    };
    for (let k = 0; k < upper.length; k++) {
      if (upper[k] === undefined || lower[k] === undefined) flush();
      else run.push(k);
    }
    flush();
    return found;
  };
  let svg = "";
  milkyWayBands(MILKY.levels, { step: view.zoom >= 1.8 ? 1 : 2 }).forEach((band, i) => {
    let d = "";
    for (const strip of band.strips) {
      for (const polygon of polygons(strip)) {
        const points = wide ? polygon.map(([u, dec]) => place({ rightAscension: view.ra + u, declination: dec })) : polygon;
        if (points.some((at) => at === undefined)) continue;
        const at = points as Array<[number, number]>;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const [x, y] of at) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        if (x1 < -margin || x0 > width + margin || y1 < -margin || y0 > height + margin) continue;
        d += `M${at.map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}Z`;
      }
    }
    if (d !== "") svg += `<path d="${d}" fill="${MILKY.fills[i]}" fill-opacity="${MILKY.opacities[i]}"/>`;
  });
  const id = "hoshi-milky-blur";
  return `<defs><filter id="${id}" filterUnits="userSpaceOnUse" x="-30" y="-30" width="${width + 60}" height="${height + 60}"><feGaussianBlur stdDeviation="${round(blur)}"/></filter></defs><g data-layer="milky" filter="url(#${id})">${svg}</g>`;
}

/** One frame of the chart: an SVG string of the size asked, and what a tap can land on. */
export function chart(o: ChartOptions): Chart {
  const { width, height, layers, lang } = o;
  const culture = o.culture ?? western;
  const drawn = figuresOfCulture(culture).list;
  const place = placer(o, width, height);
  const view: View = o;
  const hits: Hit[] = [];
  let body = `<rect width="${width}" height="${height}" fill="${COLOURS.ground}"/>`;
  const inside = (at: [number, number], margin = 24): boolean => at[0] > -margin && at[0] < width + margin && at[1] > -margin && at[1] < height + margin;

  if (layers.has("milky")) body += milkyWay(view, place, width, height);

  if (layers.has("grid")) {
    let d = "";
    for (let ra = 0; ra < 360; ra += 30) {
      const meridian: SkyPoint[] = [];
      for (let dec = -90; dec <= 90; dec += 3) meridian.push({ rightAscension: ra, declination: dec });
      d += pathOf(view, place, meridian);
    }
    for (const dec of [-60, -30, 30, 60]) {
      const parallel: SkyPoint[] = [];
      for (let ra = 0; ra <= 360; ra += 3) parallel.push({ rightAscension: ra, declination: dec });
      d += pathOf(view, place, parallel);
    }
    const equator: SkyPoint[] = [];
    for (let ra = 0; ra <= 360; ra += 3) equator.push({ rightAscension: ra, declination: 0 });
    body += `<path d="${d}" fill="none" stroke="${COLOURS.grid}" stroke-width="1"/><path d="${pathOf(view, place, equator)}" fill="none" stroke="${COLOURS.equator}" stroke-width="1"/>`;
  }

  const seen = o.sky === undefined ? undefined : new Map(o.sky.map((star) => [star.id, star]));
  const near = new Set(o.near ?? []);
  const nearConstellations = new Set([...near].filter((key) => key.startsWith("C:")).map((key) => key.slice(2)));
  const deep = drawDeep({ width, height, zoom: o.zoom, place, marks: layers.has("deep"), pictures: layers.has("pictures"), catalogue: o.catalogue ?? messier(), shapeOf: o.shapeOf ?? deepSkyShape, picked: o.picked, near, ready: o.readyPictures ?? new Set(), base: o.pictureBase ?? "./" });
  body += deep.under;
  if (seen === undefined && (layers.has("boundaries") || o.highlight !== undefined || nearConstellations.size > 0)) {
    let quiet = "";
    let loud = "";
    let neighbours = "";
    for (const boundary of boundaries({ step: 2 })) {
      const on = boundary.constellation.abbreviation === o.highlight;
      const next = nearConstellations.has(boundary.constellation.abbreviation);
      if (!on && !next && !layers.has("boundaries")) continue;
      const d = boundary.outlines.map((ring) => pathOf(view, place, ring)).join("");
      if (on) loud += d;
      else if (next) neighbours += d;
      else quiet += d;
    }
    body += `<path d="${quiet}" fill="none" stroke="${COLOURS.boundary}" stroke-width="1" stroke-dasharray="${BOUNDARY_DASH.join(" ")}"/><path d="${neighbours}" fill="none" stroke="${COLOURS.near}" stroke-width="1.6" stroke-dasharray="${BOUNDARY_DASH.join(" ")}"/><path d="${loud}" fill="none" stroke="${COLOURS.boundaryOn}" stroke-width="1.6" stroke-dasharray="${BOUNDARY_DASH.join(" ")}"/>`;
  }

  if (o.overlay?.lines !== undefined) body += figureLinesSvg(o.overlay.lines);

  if ((layers.has("lines") && o.overlay?.lines === undefined) || o.highlight !== undefined) {
    let quiet = "";
    let other = "";
    let loud = "";
    for (const figure of drawn) {
      const on = figure.asterism.id === o.highlight;
      if (!on && (!layers.has("lines") || o.overlay?.lines !== undefined)) continue;
      const side = figure.asterism.kind === "asterism" && culture.id !== "chinese";
      for (const [star, next] of figure.segments) {
        const a = seen === undefined ? star : seen.get(`hr-${star.hr}`);
        const b = seen === undefined ? next : seen.get(`hr-${next.hr}`);
        if (a === undefined || b === undefined) continue;
        const from = place(a);
        const to = place(b);
        if (from === undefined || to === undefined || crossesSeam(view, a, b)) continue;
        if ((from[0] < 0 && to[0] < 0) || (from[0] > width && to[0] > width) || (from[1] < 0 && to[1] < 0) || (from[1] > height && to[1] > height)) continue;
        const piece = `M${round(from[0])} ${round(from[1])}L${round(to[0])} ${round(to[1])}`;
        if (on) loud += piece;
        else if (side) other += piece;
        else quiet += piece;
      }
    }
    body += `<path d="${quiet}" fill="none" stroke="${COLOURS.lines}" stroke-width="1.2" stroke-opacity=".8"/><path d="${other}" fill="none" stroke="${COLOURS.asterism}" stroke-width="1.2" stroke-opacity=".85" stroke-dasharray="4 3"/><path d="${loud}" fill="none" stroke="${COLOURS.linesOn}" stroke-width="2.2"/>`;
  }

  const obstacles: Box[] = [{ x0: -1e4, y0: -1e4, x1: 0, y1: 1e4 }, { x0: width, y0: -1e4, x1: 1e4, y1: 1e4 }, { x0: -1e4, y0: -1e4, x1: 1e4, y1: 0 }, { x0: -1e4, y0: height, x1: 1e4, y1: 1e4 }, ...(o.keepClear ?? [])];
  const around = (x: number, y: number, r: number): Box => ({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
  const deepLabels: Label[] = [];
  obstacles.push(...deep.obstacles);
  body += deep.over;
  for (const l of deep.labels) deepLabels.push({ rank: l.rank, ...besideMarker(l.key, 11, l.x, l.y, l.gap, l.fill, 1) });
  for (const h of deep.hits) hits.push({ x: h.x, y: h.y, kind: "deep", key: h.key, reach: h.reach });

  const holeLabels: Label[] = [];
  if (o.sky === undefined && (layers.has("holes") || o.pickedHole !== undefined)) {
    for (const hole of blackHoles()) {
      const isPicked = hole.id === o.pickedHole;
      if (!layers.has("holes") && !isPicked) continue;
      const at = place(hole);
      if (at === undefined || !inside(at)) continue;
      body += `<g data-hole="${hole.id}" data-kind="${hole.kind}">${holeShape(hole, at[0], at[1], isPicked, holeScale(o.zoom))}</g>`;
      obstacles.push(around(at[0], at[1], 8 * holeScale(o.zoom)));
      const famous = FAMOUS_HOLES.has(hole.id);
      if (isPicked || (famous ? o.zoom >= 1.5 : hole.kind === "supermassive" ? o.zoom >= 8 : o.zoom >= 3)) holeLabels.push({ rank: isPicked ? -1 : famous ? 1500 : 1600 + (hole.kind === "supermassive" ? 100 : 0) + (hole.status === "candidate" ? 50 : 0), ...(isPicked ? withFarther(hole.name, at[0], at[1], 9, COLOURS.pick, 2) : famous ? withFarther(hole.name, at[0], at[1], 9, COLOURS.hole, 1) : besideMarker(hole.name, 11, at[0], at[1], 9, COLOURS.hole, 1)) });
      hits.push({ x: at[0], y: at[1], kind: "hole", key: hole.id });
    }
  }

  const grow = growOf(o.zoom);
  let faintDrawn: Chart["faint"];
  if (o.sky === undefined && layers.has("faint") && o.faint !== undefined) {
    const marks = faintMarks(o.faint, place, inside, grow);
    body += marks.svg;
    faintDrawn = { drawn: marks.drawn, depth: marks.depth };
  }
  const namedLimit = Math.min(o.magnitude, 1.6 + Math.log2(o.zoom) * 1.1);
  let dots = "";
  let ring = "";
  const starLabels: Label[] = [];
  const depth = depthOf(o.magnitude, o.zoom);
  const plot = (key: string, point: SkyPoint, magnitude: number, colour: () => string, text: string | undefined, designation: string): void => {
    const isNear = near.has(`S:${key}`);
    const at = place(point);
    if (at === undefined || !inside(at)) return;
    const r = Math.max(0.7, (o.magnitude - Math.max(magnitude, -2)) * 0.55 + 1.1) * grow;
    dots += `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r)}" fill="${colour()}"/>`;
    hits.push({ x: at[0], y: at[1], kind: "star", key });
    if (r >= 2.6) obstacles.push(around(at[0], at[1], r + 1));
    if (key === o.picked) ring += `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r + 6)}" fill="none" stroke="${COLOURS.pick}" stroke-width="2"/>`;
    else if (isNear) ring += `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r + 5)}" fill="none" stroke="${COLOURS.near}" stroke-width="1.8"/>`;
    if (isNear && key !== o.picked) starLabels.push({ rank: 900, ...besideMarker(text ?? designation, 11, at[0], at[1], r + 6, COLOURS.near, 1) });
    else if (layers.has("names") && o.overlay?.names === undefined && text !== undefined && magnitude <= namedLimit) starLabels.push({ rank: key === o.picked ? -1 : 1000 + magnitude, ...besideMarker(text, 11, at[0], at[1], r + 3, COLOURS.star, 0.85) });
  };
  if (o.sky === undefined) {
    const drawn = stars({ magnitude: depth });
    for (const key of near) {
      const extra = key.startsWith("S:") ? starByHr(Number(key.slice(2))) : undefined;
      if (extra !== undefined && extra.magnitude > depth) drawn.push(extra);
    }
    for (const star of drawn) plot(String(star.hr), star, star.magnitude, () => starColour(star), lang === "ja" ? star.nameJa ?? star.name : star.name, star.designation ?? `HR ${star.hr}`);
  } else {
    for (const star of o.sky) {
      if (star.magnitude > depth && !near.has(`S:${keyOfSeen(star.id)}`)) continue;
      const sun = star.id === "sun";
      plot(keyOfSeen(star.id), star, star.magnitude, () => (star.colourIndex === undefined ? "#ffffff" : blackBodyColour(starTemperatureK(star.colourIndex))), sun ? (lang === "ja" ? "太陽" : "Sun") : lang === "ja" ? (star.star !== undefined && "nameJa" in star.star ? star.star.nameJa : undefined) ?? star.name : star.name, star.designation ?? `HR ${keyOfSeen(star.id)}`);
    }
  }

  const nameLabels: Label[] = [];
  const middles = o.sky === undefined ? undefined : centroidsSeen(o.sky, culture);
  if (layers.has("names") && o.zoom >= 0.25) {
    for (const figure of drawn) {
      const id = figure.asterism.id;
      const middle = middles === undefined ? centroidOf(id, culture) : middles.get(id);
      const at = middle === undefined ? undefined : place(middle);
      if (at === undefined || !inside(at, -8)) continue;
      const on = id === o.highlight;
      const isNear = nearConstellations.has(id);
      const small = figure.asterism.kind === "asterism" && culture.id !== "chinese";
      const size = on ? 15 : small ? 12 : 13;
      const text = labelOf(figure, culture, lang);
      const { w, h } = textSize(text, size);
      const places = [[0, 0], [0, -h], [0, h], [-w * 0.6, 0], [w * 0.6, 0], [0, -2 * h], [0, 2 * h], [-w * 0.6, -h], [w * 0.6, -h], [-w * 0.6, h], [w * 0.6, h], [0, -3 * h], [0, 3 * h]].map(([dx, dy]) => {
        const x = at[0] + dx!;
        const y = at[1] + dy!;
        return { x, y, anchor: "middle" as const, box: { x0: x - w / 2 - 1, y0: y - size * 0.85, x1: x + w / 2 + 1, y1: y + size * 0.3 } };
      });
      const rank = (small ? 1003.5 : 1001.8) + 1.2 * (1 - Math.min(1, reachOfConstellation(id, culture) / 50)) - (figure.asterism.kind === "mansion" ? 0.8 : 0);
      nameLabels.push({ rank: on ? -1 : isNear ? 899 : rank, places, text, size, weight: on || isNear ? 700 : 400, fill: on ? COLOURS.nameOn : isNear ? COLOURS.near : small ? COLOURS.asterismName : COLOURS.name, opacity: on || isNear ? 1 : 0.75 });
    }
  }
  let members = "";
  for (const star of deep.inside) {
    const at = place(star);
    if (at !== undefined && inside(at) && star.magnitude <= depth) members += `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(Math.max(0.7, (o.magnitude - Math.max(star.magnitude, -2)) * 0.55 + 1.1) * grow + 4)}" fill="none" stroke="${DEEP_COLOURS.member}" stroke-width="1" stroke-dasharray="2 2" data-inside="${star.hr}"/>`;
  }
  body += `<g>${dots}</g>${ring}${members}`;

  for (const label of o.overlay?.names?.labels ?? []) obstacles.push({ x0: label.x0 - 2, y0: label.y0 - 1, x1: label.x1 + 2, y1: label.y1 + 1 });
  const labels = [...starLabels, ...nameLabels, ...deepLabels, ...holeLabels].sort((a, b) => a.rank - b.rank);
  const chosen = placeLabels(labels.map((l) => l.places.map((p) => p.box)), obstacles);
  let text = "";
  labels.forEach((l, i) => {
    const at = chosen[i];
    if (at === undefined) return;
    const p = l.places[at]!;
    text += `<text x="${round(p.x)}" y="${round(p.y)}" text-anchor="${p.anchor}" font-size="${l.size}" font-weight="${l.weight}" fill="${l.fill}" fill-opacity="${l.opacity}">${escapeXml(l.text)}</text>`;
  });
  body += `<g font-family="system-ui, sans-serif"${culture.id === "chinese" ? ' lang="zh-Hant"' : ""} pointer-events="none" stroke="${COLOURS.ground}" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${text}</g>`;

  if (o.overlay?.names !== undefined) body += starNamesSvg(o.overlay.names);
  if (o.overlay?.lines !== undefined) body += figureNameSvg(o.overlay.lines);

  return { svg: `<g font-family="system-ui, sans-serif">${body}</g>`, hits, wanted: deep.wanted, ...(faintDrawn === undefined ? {} : { faint: faintDrawn }) };
}

/** The key a seen star has on the chart and in a pick: the HR number as text, or `sun`. */
export const keyOfSeen = (id: string): string => (id.startsWith("hr-") ? id.slice(3) : id);

/** The constellation under a pixel of the chart, or `undefined` off the sky. */
export function constellationUnder(view: View, width: number, height: number, x: number, y: number): Constellation | undefined {
  const at = fromScreen(view, width, height, x, y);
  return at === undefined ? undefined : constellationAt(at);
}

/**
 * The figure of a culture nearest a pixel of the chart, within `reach` pixels of one of its lines or stars. Only the figures a tap should find: the asterisms, and every figure of a culture that has no constellations (the Chinese sky).
 *
 * @param view - The chart's view.
 * @param width - The chart's width in pixels.
 * @param height - The chart's height in pixels.
 * @param x - The pixel.
 * @param y - The pixel.
 * @param culture - The sky culture drawn.
 * @param reach - How near a line or star must be, in pixels.
 * @returns The figure, or `undefined` where none is near.
 *
 * @example
 * ```ts
 * import { chinese } from "../src/cultures/chinese.ts";
 * import { DEFAULT_VIEW, figureUnder } from "./chart.ts";
 *
 * console.log(figureUnder(DEFAULT_VIEW, 480, 360, 240, 180, chinese)?.asterism.name);
 * ```
 */
export function figureUnder(view: View, width: number, height: number, x: number, y: number, culture: Culture, reach = 12): CultureFigure | undefined {
  const place = placer(view, width, height);
  let best: CultureFigure | undefined;
  let nearest = reach * reach;
  for (const figure of figuresOfCulture(culture).list) {
    if (figure.asterism.kind === "constellation") continue;
    const spots = figure.stars.map((star) => place(star));
    const ends = figure.segments.map(([a, b]) => [place(a), place(b)] as const);
    for (const at of spots) {
      if (at === undefined) continue;
      const d = (at[0] - x) ** 2 + (at[1] - y) ** 2;
      if (d < nearest) {
        nearest = d;
        best = figure;
      }
    }
    for (const [from, to] of ends) {
      if (from === undefined || to === undefined) continue;
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const length = dx * dx + dy * dy;
      const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - from[0]) * dx + (y - from[1]) * dy) / length));
      const d = (from[0] + t * dx - x) ** 2 + (from[1] + t * dy - y) ** 2;
      if (d < nearest) {
        nearest = d;
        best = figure;
      }
    }
  }
  return best;
}

export type { BlackHole, DeepSkyObject, Star };
