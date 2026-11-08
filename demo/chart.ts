// The sky chart the demo and the embed page draw: stars, constellation lines, boundaries, names, Messier objects and a grid, as one SVG string, in any of the seven projections.
// It only calls the package: the numbers (positions, colours, outlines, figures) are the package's; the pixels are decided here.
import { starColour, stars, type Star } from "../src/index.ts";
import { boundaries, constellationAt } from "../src/boundaries.ts";
import { constellations, type Constellation } from "../src/constellations.ts";
import { messier, type DeepSkyObject } from "../src/deep-sky.ts";
import { figures } from "../src/lines.ts";
import { project, unproject, type Projection, type SkyPoint } from "../src/projection.ts";
import { placeLabels, textSize, type Box } from "./labels.ts";

export const LAYERS = ["lines", "boundaries", "names", "deep", "grid"] as const;
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
  /** The constellation (abbreviation) to show brighter, with its boundary even when boundaries are off. */
  highlight?: string | undefined;
  /** The star (HR number) or Messier object (`M31`) that is picked. */
  picked?: string | undefined;
  /** Rectangles in chart pixels that no name may cover, such as the page's own buttons laid over the chart. */
  keepClear?: readonly Box[] | undefined;
}

/** What a tap can land on, in chart pixels. */
export interface Hit {
  x: number;
  y: number;
  kind: "star" | "deep";
  key: string;
}

export const DEFAULT_VIEW: View = { projection: "stereographic", ra: 84, dec: 0, zoom: 1 };
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 60;
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

/** The view zoomed by `factor` with the sky under (`x`, `y`) kept under it. */
export function zoomedAbout(view: View, width: number, height: number, factor: number, x: number, y: number): View {
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, view.zoom * factor));
  const under = fromScreen(view, width, height, x, y);
  const next = { ...view, zoom };
  if (under === undefined) return next;
  const now = toScreen(next, width, height, under);
  return now === undefined ? next : dragged(next, width, height, x - now[0], y - now[1]);
}

/** How much bigger the stars are drawn as the chart zooms in. */
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
  const reach = 6 * Math.max(width, height);
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

let centroids: Map<string, SkyPoint> | undefined;
/** The middle of each constellation's figure, where its name goes. */
function centroidOf(abbreviation: string): SkyPoint | undefined {
  if (centroids === undefined) {
    centroids = new Map();
    for (const figure of figures()) {
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
      centroids.set(figure.constellation.abbreviation, { rightAscension: wrap360((Math.atan2(y, x) * 180) / Math.PI), declination: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI });
    }
  }
  return centroids.get(abbreviation);
}

/** The middle of a constellation's figure (degrees), for flying to it. */
export const centreOfConstellation = (abbreviation: string): SkyPoint | undefined => centroidOf(abbreviation);

/** How far (degrees) a constellation's figure reaches from its middle: the zoom that shows all of it comes from this. */
export function reachOfConstellation(abbreviation: string): number {
  const middle = centroidOf(abbreviation);
  const figure = figures().find((f) => f.constellation.abbreviation === abbreviation);
  if (middle === undefined || figure === undefined) return 30;
  const rad = Math.PI / 180;
  let far = 5;
  for (const star of figure.stars) {
    const c = Math.sin(middle.declination * rad) * Math.sin(star.declination * rad) + Math.cos(middle.declination * rad) * Math.cos(star.declination * rad) * Math.cos((middle.rightAscension - star.rightAscension) * rad);
    far = Math.max(far, Math.acos(Math.max(-1, Math.min(1, c))) / rad);
  }
  return far;
}

const COLOURS = { ground: "#0b1020", grid: "#25304f", equator: "#3a4a78", lines: "#6f93e0", linesOn: "#ffd86b", boundary: "#46578c", boundaryOn: "#ffd86b", name: "#8da3d8", nameOn: "#ffe49a", star: "#f4f6ff", deep: "#e0a458", pick: "#ff7a59" };

function shapeOf(object: DeepSkyObject, x: number, y: number, pick: boolean): string {
  const stroke = pick ? COLOURS.pick : COLOURS.deep;
  const common = `fill="none" stroke="${stroke}" stroke-width="${pick ? 2 : 1.2}"`;
  switch (object.type) {
    case "galaxy": return `<ellipse cx="${round(x)}" cy="${round(y)}" rx="6" ry="3.2" transform="rotate(-30 ${round(x)} ${round(y)})" ${common}/>`;
    case "globular cluster": return `<circle cx="${round(x)}" cy="${round(y)}" r="4.5" ${common}/><path d="M${round(x - 4.5)} ${round(y)}h9M${round(x)} ${round(y - 4.5)}v9" ${common}/>`;
    case "open cluster": return `<circle cx="${round(x)}" cy="${round(y)}" r="4.5" stroke-dasharray="2 2" ${common}/>`;
    case "planetary nebula": return `<circle cx="${round(x)}" cy="${round(y)}" r="3.2" ${common}/><path d="M${round(x - 6.5)} ${round(y)}h3M${round(x + 3.5)} ${round(y)}h3" ${common}/>`;
    default: return `<rect x="${round(x - 4)}" y="${round(y - 4)}" width="8" height="8" ${common}/>`;
  }
}

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

export interface Chart {
  svg: string;
  hits: Hit[];
}

/** One frame of the chart: an SVG string of the size asked, and what a tap can land on. */
export function chart(o: ChartOptions): Chart {
  const { width, height, layers, lang } = o;
  const place = placer(o, width, height);
  const view: View = o;
  const hits: Hit[] = [];
  let body = `<rect width="${width}" height="${height}" fill="${COLOURS.ground}"/>`;
  const inside = (at: [number, number], margin = 24): boolean => at[0] > -margin && at[0] < width + margin && at[1] > -margin && at[1] < height + margin;

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

  if (layers.has("boundaries") || o.highlight !== undefined) {
    let quiet = "";
    let loud = "";
    for (const boundary of boundaries({ step: 2 })) {
      const on = boundary.constellation.abbreviation === o.highlight;
      if (!on && !layers.has("boundaries")) continue;
      const d = boundary.outlines.map((ring) => pathOf(view, place, ring)).join("");
      if (on) loud += d;
      else quiet += d;
    }
    body += `<path d="${quiet}" fill="none" stroke="${COLOURS.boundary}" stroke-width="1" stroke-dasharray="5 4"/><path d="${loud}" fill="none" stroke="${COLOURS.boundaryOn}" stroke-width="1.6" stroke-dasharray="5 4"/>`;
  }

  if (layers.has("lines") || o.highlight !== undefined) {
    let quiet = "";
    let loud = "";
    for (const figure of figures()) {
      const on = figure.constellation.abbreviation === o.highlight;
      if (!on && !layers.has("lines")) continue;
      for (const [a, b] of figure.segments) {
        const from = place(a);
        const to = place(b);
        if (from === undefined || to === undefined || crossesSeam(view, a, b)) continue;
        if ((from[0] < 0 && to[0] < 0) || (from[0] > width && to[0] > width) || (from[1] < 0 && to[1] < 0) || (from[1] > height && to[1] > height)) continue;
        const piece = `M${round(from[0])} ${round(from[1])}L${round(to[0])} ${round(to[1])}`;
        if (on) loud += piece;
        else quiet += piece;
      }
    }
    body += `<path d="${quiet}" fill="none" stroke="${COLOURS.lines}" stroke-width="1.2" stroke-opacity=".8"/><path d="${loud}" fill="none" stroke="${COLOURS.linesOn}" stroke-width="2.2"/>`;
  }

  const obstacles: Box[] = [{ x0: -1e4, y0: -1e4, x1: 0, y1: 1e4 }, { x0: width, y0: -1e4, x1: 1e4, y1: 1e4 }, { x0: -1e4, y0: -1e4, x1: 1e4, y1: 0 }, { x0: -1e4, y0: height, x1: 1e4, y1: 1e4 }, ...(o.keepClear ?? [])];
  const around = (x: number, y: number, r: number): Box => ({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
  const deepLabels: Label[] = [];
  if (layers.has("deep")) {
    for (const object of messier()) {
      const at = place(object);
      if (at === undefined || !inside(at)) continue;
      const key = object.id;
      body += shapeOf(object, at[0], at[1], key === o.picked);
      obstacles.push(around(at[0], at[1], 7));
      if (o.zoom >= 2.5 || (object.magnitude ?? 9) <= 5 || key === o.picked) deepLabels.push({ rank: key === o.picked ? -1 : 2000 + (object.magnitude ?? 9), ...besideMarker(key, 11, at[0], at[1], 8, key === o.picked ? COLOURS.pick : COLOURS.deep, 1) });
      hits.push({ x: at[0], y: at[1], kind: "deep", key });
    }
  }

  const grow = growOf(o.zoom);
  const namedLimit = Math.min(o.magnitude, 1.6 + Math.log2(o.zoom) * 1.1);
  let dots = "";
  let ring = "";
  const starLabels: Label[] = [];
  for (const star of stars({ magnitude: o.magnitude })) {
    const at = place(star);
    if (at === undefined || !inside(at)) continue;
    const r = Math.max(0.7, (o.magnitude - star.magnitude) * 0.55 + 1.1) * grow;
    dots += `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r)}" fill="${starColour(star)}"/>`;
    hits.push({ x: at[0], y: at[1], kind: "star", key: String(star.hr) });
    if (r >= 2.6) obstacles.push(around(at[0], at[1], r + 1));
    if (String(star.hr) === o.picked) ring = `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r + 6)}" fill="none" stroke="${COLOURS.pick}" stroke-width="2"/>`;
    const text = lang === "ja" ? star.nameJa ?? star.name : star.name;
    if (layers.has("names") && text !== undefined && star.magnitude <= namedLimit) starLabels.push({ rank: String(star.hr) === o.picked ? -1 : 1000 + star.magnitude, ...besideMarker(text, 11, at[0], at[1], r + 3, COLOURS.star, 0.85) });
  }

  const nameLabels: Label[] = [];
  if (layers.has("names")) {
    for (const c of constellations()) {
      const abbreviation = c.abbreviation;
      const middle = centroidOf(abbreviation);
      const at = middle === undefined ? undefined : place(middle);
      if (at === undefined || !inside(at, -8)) continue;
      const on = abbreviation === o.highlight;
      const size = on ? 15 : 13;
      const text = lang === "ja" ? c.japanese : c.name;
      const { w, h } = textSize(text, size);
      const places = [[0, 0], [0, -h], [0, h], [-w * 0.6, 0], [w * 0.6, 0], [0, -2 * h], [0, 2 * h], [-w * 0.6, -h], [w * 0.6, -h], [-w * 0.6, h], [w * 0.6, h], [0, -3 * h], [0, 3 * h]].map(([dx, dy]) => {
        const x = at[0] + dx!;
        const y = at[1] + dy!;
        return { x, y, anchor: "middle" as const, box: { x0: x - w / 2 - 1, y0: y - size * 0.85, x1: x + w / 2 + 1, y1: y + size * 0.3 } };
      });
      nameLabels.push({ rank: on ? -1 : 1001.8 + 1.2 * (1 - Math.min(1, reachOfConstellation(abbreviation) / 50)), places, text, size, weight: on ? 700 : 400, fill: on ? COLOURS.nameOn : COLOURS.name, opacity: on ? 1 : 0.75 });
    }
  }
  body += `<g>${dots}</g>${ring}`;

  const labels = [...starLabels, ...nameLabels, ...deepLabels].sort((a, b) => a.rank - b.rank);
  const chosen = placeLabels(labels.map((l) => l.places.map((p) => p.box)), obstacles);
  let text = "";
  labels.forEach((l, i) => {
    const at = chosen[i];
    if (at === undefined) return;
    const p = l.places[at]!;
    text += `<text x="${round(p.x)}" y="${round(p.y)}" text-anchor="${p.anchor}" font-size="${l.size}" font-weight="${l.weight}" fill="${l.fill}" fill-opacity="${l.opacity}">${escapeXml(l.text)}</text>`;
  });
  body += `<g font-family="system-ui, sans-serif" pointer-events="none" stroke="${COLOURS.ground}" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${text}</g>`;

  return { svg: `<g font-family="system-ui, sans-serif">${body}</g>`, hits };
}

/** The constellation under a pixel of the chart, or `undefined` off the sky. */
export function constellationUnder(view: View, width: number, height: number, x: number, y: number): Constellation | undefined {
  const at = fromScreen(view, width, height, x, y);
  return at === undefined ? undefined : constellationAt(at);
}

export type { DeepSkyObject, Star };
