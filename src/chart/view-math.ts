// Where the chart looks and how a point of the sky and a point on the screen map to each other: the projection's scale, the drag, the zoom about a point and the cap that keeps a picture from being drawn too large. Moved out of chart.ts as it was; chart.ts re-exports it.
import { pictureCorners, type DeepSkyPicture } from "../deep-sky-pictures.ts";
import { offsetOnSky } from "../deep-sky-shape.ts";
import { project, unproject, type Projection, type SkyPoint } from "../projection.ts";
import { drawnPictures } from "./picture-quality.ts";
import type { View } from "./types.ts";

export const DEFAULT_VIEW: View = { projection: "stereographic", ra: 84, dec: 0, zoom: 1 };
/**
 * The least zoom: the whole sky, small. The most: 8,000, where the smallest deep-sky object that has a picture, the Ring Nebula (M57, 1 arc-minute across in the package's table), fills about 0.58 of the smaller side of the chart whatever its size
 * (a chart's pixels for an arc-minute are its smaller side times 7.3e-5 times the zoom, so 1 arc-minute is `side * 0.58` pixels at 8,000), about 3 arc-minutes across the chart. Where the picture under the middle runs out of detail first, `pictureZoomCap` stops the zoom sooner.
 */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8000;
export const WIDE: readonly Projection[] = ["equirectangular", "mollweide", "hammer"];
export const SQRT8 = Math.sqrt(8);

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

export const scaleOf = (o: View, width: number, height: number): number => fitScale(o.projection, width, height) * o.zoom;
export const centreOf = (o: View): SkyPoint => ({ rightAscension: o.ra, declination: o.dec });
export const wrap180 = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180;
export const wrap360 = (degrees: number): number => ((degrees % 360) + 360) % 360;
export const round = (n: number): string => n.toFixed(1);
export const escapeXml = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

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

export const cornerCache = new Map<string, Array<[number, number]>>();
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
