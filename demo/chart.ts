// The sky chart the demo and the embed page draw: stars, constellation lines, boundaries, names, Messier objects and a grid, as one SVG string, in any of the seven projections.
// It only calls the package: the numbers (positions, colours, outlines, figures) are the package's; the pixels are decided here.
import { starColour, stars, type Star } from "../src/index.ts";
import { boundaries, constellationAt } from "../src/boundaries.ts";
import { constellations, type Constellation } from "../src/constellations.ts";
import { messier, type DeepSkyObject } from "../src/deep-sky.ts";
import { figures } from "../src/lines.ts";
import { project, unproject, type Projection, type SkyPoint } from "../src/projection.ts";

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
}

/** What a tap can land on, in chart pixels. */
export interface Hit {
  x: number;
  y: number;
  kind: "star" | "deep";
  key: string;
}

export const DEFAULT_VIEW: View = { projection: "stereographic", ra: 83.8, dec: 0, zoom: 1 };
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

  if (layers.has("deep")) {
    for (const object of messier()) {
      const at = place(object);
      if (at === undefined || !inside(at)) continue;
      const key = object.id;
      body += shapeOf(object, at[0], at[1], key === o.picked);
      if (o.zoom >= 2.5 || (object.magnitude ?? 9) <= 5 || key === o.picked) body += `<text x="${round(at[0] + 8)}" y="${round(at[1] + 4)}" font-size="11" fill="${key === o.picked ? COLOURS.pick : COLOURS.deep}">${key}</text>`;
      hits.push({ x: at[0], y: at[1], kind: "deep", key });
    }
  }

  const grow = growOf(o.zoom);
  const namedLimit = Math.min(o.magnitude, 1.6 + Math.log2(o.zoom) * 1.1);
  let dots = "";
  let labels = "";
  let ring = "";
  for (const star of stars({ magnitude: o.magnitude })) {
    const at = place(star);
    if (at === undefined || !inside(at)) continue;
    const r = Math.max(0.7, (o.magnitude - star.magnitude) * 0.55 + 1.1) * grow;
    dots += `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r)}" fill="${starColour(star)}"/>`;
    hits.push({ x: at[0], y: at[1], kind: "star", key: String(star.hr) });
    if (String(star.hr) === o.picked) ring = `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r + 6)}" fill="none" stroke="${COLOURS.pick}" stroke-width="2"/>`;
    if (layers.has("names") && star.name !== undefined && star.magnitude <= namedLimit) labels += `<text x="${round(at[0] + r + 3)}" y="${round(at[1] + 4)}" font-size="11" fill="${COLOURS.star}" fill-opacity=".85">${escapeXml(star.name)}</text>`;
  }
  body += `<g>${dots}</g>${ring}<g>${labels}</g>`;

  if (layers.has("names")) {
    let text = "";
    for (const c of constellations()) {
      const abbreviation = c.abbreviation;
      const middle = centroidOf(abbreviation);
      const at = middle === undefined ? undefined : place(middle);
      if (at === undefined || !inside(at, -8)) continue;
      const on = abbreviation === o.highlight;
      text += `<text x="${round(at[0])}" y="${round(at[1])}" text-anchor="middle" font-size="${on ? 15 : 13}" font-weight="${on ? 700 : 400}" fill="${on ? COLOURS.nameOn : COLOURS.name}" fill-opacity="${on ? 1 : 0.75}">${escapeXml(lang === "ja" ? c.japanese : c.name)}</text>`;
    }
    body += `<g font-family="system-ui, sans-serif" pointer-events="none">${text}</g>`;
  }

  return { svg: `<g font-family="system-ui, sans-serif">${body}</g>`, hits };
}

/** The constellation under a pixel of the chart, or `undefined` off the sky. */
export function constellationUnder(view: View, width: number, height: number, x: number, y: number): Constellation | undefined {
  const at = fromScreen(view, width, height, x, y);
  return at === undefined ? undefined : constellationAt(at);
}

export type { DeepSkyObject, Star };
