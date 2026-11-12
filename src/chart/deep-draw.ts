// The deep-sky part of the chart: every object at its true size, axis ratio and angle, growing with the zoom, the pictures laid on the sky where they are, and the bright stars inside a cluster.
// It only calls the package: the sizes, angles, outlines and picture corners are the package's; the strokes, the fades and the pixels are decided here.
import type { DeepSkyObject } from "../deep-sky-core.ts";
import { starsInside } from "../deep-sky-members.ts";
import { pictureCorners, pictureUrl, type DeepSkyPicture } from "../deep-sky-pictures.ts";
import { drawnPictures } from "./picture-quality.ts";
import { pictureBlobs } from "./picture-cache.ts";
import { deepSkyOutline, measuredParts, offsetOnSky, type DeepSkyShape } from "../deep-sky-shape.ts";
import type { SkyPoint } from "../projection.ts";
import type { Star } from "../stars.ts";
import type { Box } from "./labels.ts";

type Spot = [number, number];
type Place = (point: SkyPoint) => Spot | undefined;

export const DEEP_COLOURS = { deep: "#e0a458", pick: "#ff7a59", near: "#5fe0c4", member: "#f2c887" };

/** The most pictures asked for, and drawn, at once: the budget that keeps a page's picture bytes down (each file is at most 90 kB, so a view asks for at most 450 kB, within 500 kB). */
export const MAX_PICTURES = 5;
/** A picture chosen on the last frame keeps its place unless a newcomer shows this many times more of itself on the screen: without it, two pictures of about the same size swap in and out as the view moves. */
export const KEEP_MARGIN = 1.25;
/** A picture is asked for once its field is this wide on the screen, in pixels; it starts to show at `SHOW_FROM` and is fully there at `SHOW_FULL`. */
export const LOAD_FROM = 90;
export const SHOW_FROM = 130;
export const SHOW_FULL = 360;
/** The zoom and the flights stop where a picture's pixels run out, but an address may ask for more: the picture is then drawn softened, never left out. It is fully there while one of its pixels is at most `STRETCH_FULL` chart pixels, dims to `STRETCH_SOFT` of its strength by `STRETCH_FAR`, and is not drawn at all past `STRETCH_GONE` (a picture more than a hundred times blown up is no longer the object). */
export const STRETCH_FULL = 1.1;
export const STRETCH_FAR = 4;
export const STRETCH_SOFT = 0.6;
/** Blown up more than `STRETCH_FAR` times a picture dims further, by `STRETCH_MORE` more at `STRETCH_FARTHER` times: its pixels show as blocks, and the sky should win over them. */
export const STRETCH_MORE = 0.25;
export const STRETCH_FARTHER = 16;
export const STRETCH_GONE = 120;

const smooth = (low: number, high: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
const round = (n: number): string => n.toFixed(1);

/** The brightest an object's mark is drawn: by its magnitude, 1 at magnitude 3 down to 0.38 at 11; an object with no magnitude is drawn at 0.55. */
export const markOpacity = (magnitude: number | undefined): number => (magnitude === undefined ? 0.55 : Math.max(0.38, Math.min(1, 1.1 - (magnitude - 3) / 9)));

/** The faintest magnitude of an NGC or IC object drawn at a zoom (the Messier objects are always drawn): about 8 at the opening view, 14 at the closest. */
export const deepLimit = (zoom: number): number => 6.5 + 3 * Math.log10(Math.max(1, zoom));

export interface DeepContext {
  width: number;
  height: number;
  zoom: number;
  place: Place;
  /** Whether the deep-sky marks are drawn (the layer), and whether the pictures are. */
  marks: boolean;
  pictures: boolean;
  catalogue: readonly DeepSkyObject[];
  shapeOf: (object: DeepSkyObject) => DeepSkyShape;
  picked: string | undefined;
  near: ReadonlySet<string>;
  /** The pictures that have arrived (by object id), and where the picture files are served from. */
  ready: ReadonlySet<string>;
  base: string;
  /** The pictures chosen on the last frame (its `wanted`), which keep their places against a newcomer of about their size. */
  previous: ReadonlySet<string>;
}

export interface DeepLabel {
  key: string;
  x: number;
  y: number;
  gap: number;
  rank: number;
  fill: string;
}

export interface DeepHit {
  x: number;
  y: number;
  key: string;
  /** How far from the point a tap still lands on it, in pixels. */
  reach: number;
}

export interface DeepDrawn {
  /** The pictures, to go under the lines and the stars. */
  under: string;
  /** The marks and outlines, to go over them. */
  over: string;
  labels: DeepLabel[];
  hits: DeepHit[];
  obstacles: Box[];
  /** The ids of the pictures (`DeepSkyPicture.id`) to fetch, the one showing most of itself on the screen first, at most `MAX_PICTURES`. */
  wanted: string[];
  /** The ids of the pictures drawn with some of them on the screen, the most seen first: each one's credit must show while it does. */
  pictures: string[];
  /** The catalogue stars inside the clusters that are shown large: ringed as inside the outline. */
  inside: Star[];
}

const cornerCache = new Map<string, SkyPoint[]>();
const corners = (picture: DeepSkyPicture): SkyPoint[] => {
  let found = cornerCache.get(picture.id);
  if (found === undefined) cornerCache.set(picture.id, (found = pictureCorners(picture)));
  return found;
};

/** How many screen pixels an arc-minute is at an object, and the screen directions of east and north there (pixels an arc-minute), or `undefined` where the neighbourhood is off the map. */
function localScale(place: Place, at: Spot, point: SkyPoint): { east: Spot; north: Spot; k: number } | undefined {
  const e = place(offsetOnSky(point, 1, 0));
  const n = place(offsetOnSky(point, 0, 1));
  if (e === undefined || n === undefined) return undefined;
  const east: Spot = [e[0] - at[0], e[1] - at[1]];
  const north: Spot = [n[0] - at[0], n[1] - at[1]];
  return { east, north, k: Math.sqrt(Math.hypot(east[0], east[1]) * Math.hypot(north[0], north[1])) };
}

/** The area of a four-cornered shape inside the box from (0, 0) to (`width`, `height`), in square pixels: the shape is cut to each side of the box in turn. */
export function visibleArea(quad: readonly Spot[], width: number, height: number): number {
  let shape = quad.slice();
  const sides: Array<(p: Spot) => number> = [(p) => p[0], (p) => width - p[0], (p) => p[1], (p) => height - p[1]];
  for (const inside of sides) {
    const cut: Spot[] = [];
    shape.forEach((a, i) => {
      const b = shape[(i + 1) % shape.length]!;
      const fa = inside(a);
      const fb = inside(b);
      if (fa >= 0) cut.push(a);
      if ((fa >= 0) !== (fb >= 0)) {
        const t = fa / (fa - fb);
        cut.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    });
    shape = cut;
    if (shape.length < 3) return 0;
  }
  let twice = 0;
  shape.forEach((a, i) => {
    const b = shape[(i + 1) % shape.length]!;
    twice += a[0] * b[1] - b[0] * a[1];
  });
  return Math.abs(twice) / 2;
}

/** The pictures to ask for and draw: at most `MAX_PICTURES`, chosen by how much of each is on the screen (`area`), where one chosen on the last frame counts `KEEP_MARGIN` times its area; returned the most seen first. */
export function choosePictures<T extends { id: string; area: number }>(candidates: readonly T[], previous: ReadonlySet<string>): T[] {
  const score = (one: T): number => one.area * (previous.has(one.id) ? KEEP_MARGIN : 1);
  return [...candidates].sort((a, b) => score(b) - score(a)).slice(0, MAX_PICTURES).sort((a, b) => b.area - a.area);
}

/** The pictures: which are in view and big enough, the ones to fetch, and the `<image>` of each that has arrived. */
function picturesOf(c: DeepContext): { under: string; wanted: string[]; drawn: string[]; shown: Map<string, number> } {
  const shown = new Map<string, number>();
  const candidates: Array<{ id: string; picture: DeepSkyPicture; widthPx: number; area: number; matrix: number[] }> = [];
  for (const picture of drawnPictures()) {
    const [tl, tr, br, bl] = corners(picture).map((p) => c.place(p)) as [Spot?, Spot?, Spot?, Spot?];
    if (tl === undefined || tr === undefined || br === undefined || bl === undefined) continue;
    const widthPx = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
    if (widthPx < LOAD_FROM || widthPx / picture.width >= STRETCH_GONE) continue;
    const mid: Spot = [(tr[0] + bl[0]) / 2, (tr[1] + bl[1]) / 2];
    if (Math.abs(mid[0] - c.width / 2) > c.width / 2 + widthPx * 0.7 || Math.abs(mid[1] - c.height / 2) > c.height / 2 + widthPx * 0.7) continue;
    // a whole-sky map that stretches a picture across its seam would smear it: keep to what the corners say a picture of its angular size should be
    const high = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
    if (widthPx > 6 * high * (picture.width / picture.height) || high > 6 * widthPx * (picture.height / picture.width)) continue;
    candidates.push({ id: picture.id, picture, widthPx, area: visibleArea([tl, tr, br, bl], c.width, c.height), matrix: [(tr[0] - tl[0]) / picture.width, (tr[1] - tl[1]) / picture.width, (bl[0] - tl[0]) / picture.height, (bl[1] - tl[1]) / picture.height, tl[0], tl[1]] });
  }
  const chosen = choosePictures(candidates, c.previous);
  const wanted = chosen.map((x) => x.id);
  const drawn: string[] = [];
  // the coarse survey picture first and each finer one over it
  chosen.sort((a, b) => b.picture.arcsecPerPixel - a.picture.arcsecPerPixel);
  let under = "";
  for (const { picture, widthPx, area, matrix } of chosen) {
    if (!c.ready.has(picture.id)) continue;
    const opacity = smooth(SHOW_FROM, SHOW_FULL, widthPx) * (1 - (1 - STRETCH_SOFT) * smooth(STRETCH_FULL, STRETCH_FAR, widthPx / picture.width) - STRETCH_MORE * smooth(STRETCH_FAR, STRETCH_FARTHER, widthPx / picture.width));
    if (opacity <= 0.01) continue;
    shown.set(picture.object, Math.max(shown.get(picture.object) ?? 0, opacity));
    if (area > 0) drawn.push(picture.id);
    under += `<image data-pic="${picture.id}" href="${pictureBlobs.get(picture.id) ?? pictureUrl(picture, c.base)}" width="${picture.width}" height="${picture.height}" transform="matrix(${matrix.map((n) => n.toFixed(6)).join(" ")})" opacity="${opacity.toFixed(3)}" preserveAspectRatio="none"/>`;
  }
  return { under, wanted, drawn: wanted.filter((id) => drawn.includes(id)), shown };
}

/** A ring of sky points as a closed path in pixels, lifted where a point is off the map. */
function ringPath(place: Place, ring: readonly SkyPoint[]): string {
  let d = "";
  let lifted = true;
  for (const point of ring) {
    const at = place(point);
    if (at === undefined) {
      lifted = true;
      continue;
    }
    d += `${lifted ? "M" : "L"}${round(at[0])} ${round(at[1])}`;
    lifted = false;
  }
  return d === "" ? "" : `${d}Z`;
}

/** The mark of one object: its true outline once that is bigger than the smallest mark, else the smallest mark in the object's own symbol. */
function markOf(c: DeepContext, object: DeepSkyObject, shape: DeepSkyShape, at: Spot, scale: { east: Spot; north: Spot; k: number }, stroke: string, opacity: number, width: number): { svg: string; radius: number } {
  const parts = measuredParts(shape);
  const majorPx = parts.size ? shape.majorArcmin! * scale.k : 0;
  const unknown = parts.size ? "" : ` stroke-dasharray="1.5 2.5"`;
  const common = `fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity.toFixed(2)}"`;
  const [x, y] = at;
  const floor = object.type === "galaxy" ? 6.5 : 4.5;
  if (parts.size && majorPx / 2 > floor + 1) {
    const ring = deepSkyOutline(object, shape, majorPx > 90 ? 64 : 32)!;
    const path = ringPath(c.place, ring);
    const wash = `fill="${stroke}" fill-opacity="${(0.07 * opacity).toFixed(3)}"`;
    const r = majorPx / 2;
    let svg: string;
    switch (object.type) {
      case "galaxy":
        svg = `<path d="${path}" ${parts.oval ? "" : 'stroke-dasharray="1.5 3" '}${common.replace('fill="none"', wash)}/>`;
        break;
      case "globular cluster":
        // a ring with a short tick inward at north, east, south and west
        svg = `<path d="${path}" ${common}/><path d="M${round(x - r)} ${round(y)}h${round(Math.min(14, r * 0.25))}M${round(x + r)} ${round(y)}h${round(-Math.min(14, r * 0.25))}M${round(x)} ${round(y - r)}v${round(Math.min(14, r * 0.25))}M${round(x)} ${round(y + r)}v${round(-Math.min(14, r * 0.25))}" ${common}/>`;
        break;
      case "open cluster":
        svg = `<path d="${path}" stroke-dasharray="3 3" ${common}/>`;
        break;
      case "planetary nebula":
        svg = `<path d="${path}" ${common.replace('fill="none"', wash)}/><path d="M${round(x - r - 7)} ${round(y)}h5M${round(x + r + 2)} ${round(y)}h5" ${common}/>`;
        break;
      case "supernova remnant":
        svg = `<path d="${path}" stroke-dasharray="7 3" ${common.replace('fill="none"', wash)}/><circle cx="${round(x)}" cy="${round(y)}" r="${round(r * 0.8)}" ${common} stroke-opacity="${(opacity * 0.5).toFixed(2)}"/>`;
        break;
      case "nebula":
        svg = `<path d="${path}" stroke-dasharray="9 4" ${common.replace('fill="none"', wash)}/>`;
        break;
      default:
        svg = `<path d="${path}" stroke-dasharray="1.5 3" ${common}/>`;
    }
    return { svg, radius: r };
  }
  // the smallest mark: the object's symbol at a fixed size, turned to the measured angle and as long as the measured ratio says, dotted where no size is measured
  switch (object.type) {
    case "galaxy": {
      const ratio = parts.ratio ? Math.max(0.3, shape.minorArcmin! / shape.majorArcmin!) : 0.5;
      const rx = Math.max(floor, majorPx / 2);
      const theta = ((parts.angle ? shape.positionAngle! : 0) * Math.PI) / 180;
      const dir: Spot = [Math.sin(theta) * scale.east[0] + Math.cos(theta) * scale.north[0], Math.sin(theta) * scale.east[1] + Math.cos(theta) * scale.north[1]];
      const turn = parts.angle ? (Math.atan2(dir[1], dir[0]) * 180) / Math.PI : 0;
      return { svg: `<ellipse cx="${round(x)}" cy="${round(y)}" rx="${round(rx)}" ry="${round(Math.max(2, rx * ratio))}" transform="rotate(${round(turn)} ${round(x)} ${round(y)})" ${common}${unknown}/>`, radius: rx };
    }
    case "globular cluster":
      return { svg: `<circle cx="${round(x)}" cy="${round(y)}" r="${floor}" ${common}${unknown}/><path d="M${round(x - floor)} ${round(y)}h${2 * floor}M${round(x)} ${round(y - floor)}v${2 * floor}" ${common}/>`, radius: floor };
    case "open cluster":
      return { svg: `<circle cx="${round(x)}" cy="${round(y)}" r="${floor}" stroke-dasharray="2 2" ${common}/>`, radius: floor };
    case "planetary nebula":
      return { svg: `<circle cx="${round(x)}" cy="${round(y)}" r="3.2" ${common}${unknown}/><path d="M${round(x - 6.5)} ${round(y)}h3M${round(x + 3.5)} ${round(y)}h3" ${common}/>`, radius: 6.5 };
    default:
      return { svg: `<rect x="${round(x - 4)}" y="${round(y - 4)}" width="8" height="8" ${common}${unknown}/>`, radius: 4 };
  }
}

/** The deep-sky layer for one frame. */
export function drawDeep(c: DeepContext): DeepDrawn {
  const pics = c.pictures ? picturesOf(c) : { under: "", wanted: [], drawn: [], shown: new Map<string, number>() };
  const out: DeepDrawn = { under: pics.under, over: "", labels: [], hits: [], obstacles: [], wanted: pics.wanted, pictures: pics.drawn, inside: [] };
  if (!c.marks && c.near.size === 0 && c.picked === undefined) return out;
  const limit = deepLimit(c.zoom);
  const drawn: Array<{ object: DeepSkyObject; at: Spot; majorPx: number; shape: DeepSkyShape }> = [];
  for (const object of c.catalogue) {
    const isNear = c.near.has(`D:${object.id}`);
    const key = object.id;
    if (!c.marks && !isNear && key !== c.picked) continue;
    const messier = object.messier !== undefined;
    const special = key === c.picked || isNear;
    const at = c.place(object);
    if (at === undefined || at[0] < -80 || at[0] > c.width + 80 || at[1] < -80 || at[1] > c.height + 80) continue;
    const shape = c.shapeOf(object);
    const listed = messier || special || (object.magnitude !== undefined && object.magnitude <= limit);
    if (!listed && shape.majorArcmin === undefined) continue;
    const scale = localScale(c.place, at, object);
    if (scale === undefined) continue;
    const majorPx = shape.majorArcmin === undefined ? 0 : shape.majorArcmin * scale.k;
    if (!listed && majorPx < 10) continue;
    if (at[0] < -24 - majorPx / 2 || at[0] > c.width + 24 + majorPx / 2 || at[1] < -24 - majorPx / 2 || at[1] > c.height + 24 + majorPx / 2) continue;
    drawn.push({ object, at, majorPx, shape });
  }
  // the brightest first, and no more than a few hundred of the faint ones: a view never holds more than a page of marks can show
  drawn.sort((a, b) => (a.object.messier === undefined ? 1 : 0) - (b.object.messier === undefined ? 1 : 0) || (a.object.magnitude ?? 99) - (b.object.magnitude ?? 99));
  let faint = 0;
  const clusters: Array<{ object: DeepSkyObject; shape: DeepSkyShape; majorPx: number }> = [];
  for (const { object, at, majorPx, shape } of drawn) {
    const key = object.id;
    const special = key === c.picked || c.near.has(`D:${key}`);
    if (object.messier === undefined && !special && ++faint > 400) continue;
    const scale = localScale(c.place, at, object)!;
    const picture = pics.shown.get(key) ?? 0;
    const pick = key === c.picked;
    const isNear = c.near.has(`D:${key}`);
    const stroke = pick ? DEEP_COLOURS.pick : isNear ? DEEP_COLOURS.near : DEEP_COLOURS.deep;
    const base = pick || isNear ? 1 : markOpacity(object.magnitude);
    const opacity = base * (1 - 0.45 * picture);
    const mark = markOf(c, object, shape, at, scale, stroke, opacity, pick ? (picture > 0.5 ? 1.5 : 2) : isNear ? 1.8 : 1.2);
    out.over += `<g data-deep="${key}">${mark.svg}</g>`;
    const keep = Math.min(mark.radius, 8) + 2;
    out.obstacles.push({ x0: at[0] - keep, y0: at[1] - keep, x1: at[0] + keep, y1: at[1] + keep });
    const named = object.messier !== undefined ? c.zoom >= 2.5 || (object.magnitude ?? 9) <= 5 : c.zoom >= 25 || mark.radius > 14;
    if (named || special) out.labels.push({ key, x: at[0], y: at[1], gap: Math.min(mark.radius, 60) + 4, rank: pick ? -1 : isNear ? 900 : 2000 + (object.magnitude ?? 12), fill: stroke });
    out.hits.push({ x: at[0], y: at[1], key, reach: Math.max(22, Math.min(mark.radius * 0.35, 120)) });
    if (object.type === "open cluster" && (pick || majorPx >= 120)) clusters.push({ object, shape, majorPx });
  }
  const seen = new Set<number>();
  for (const { object, shape } of clusters) {
    for (const star of starsInside(object, shape)) {
      if (seen.has(star.hr)) continue;
      seen.add(star.hr);
      out.inside.push(star);
    }
  }
  return out;
}
