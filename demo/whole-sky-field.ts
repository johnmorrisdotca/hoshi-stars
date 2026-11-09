// The patch of sky the whole-sky page shows, as the round patch the faint tiles are asked for (`faintTilesFor`), and the zoom the faint layer's depth rule reads. Pure: no DOM, no fetching.
// The page's map is a Mollweide, Hammer or plate carree oval in the galactic or the equatorial frame, so a rectangle of the screen is not a rectangle of sky: the patch is found by looking at where the
// screen's edges, a grid over the screen and the oval's own rim land on the sky, and taking the circle that holds them all.
import { allSkyOutline, allSkyUnproject, type AllSkyOptions } from "../src/all-sky.ts";
import type { FaintField } from "../src/faint-core.ts";
import type { SkyPoint } from "../src/projection.ts";

/** The map's unit box: 1000 by 500, as `whole-sky-draw.ts` has it. */
const UNIT_W = 1000;
const UNIT_H = 500;
const RADIANS = Math.PI / 180;

/** The most the zoom bar zooms the whole-sky map in (`zoom-max` on the bar in whole-sky.html). */
export const WHOLE_SKY_ZOOM_MAX = 24;
/** The faintest star the page draws on its own (the Bright Star Catalogue's limit): the faint layer's telescope rule starts from here, as the sky chart's does from its Faintest star slider. */
export const WHOLE_SKY_MAGNITUDE = 6;

/**
 * The zoom of the sky chart that shows the same pixels to the degree as this map does at `zoom`, for a chart as wide as the map and half as tall. The sky chart's zoom 1 is a stereographic fit of `side / 4` pixels to the radian (the side is the smaller one, here the height,
 * half the width), the whole-sky map's zoom 1 is `width / 2 pi` pixels to the radian along its middle, so the map at zoom 1 is `8 / 2 pi` (1.27) times the chart at zoom 1. The faint layer's depth rule (`faintDepthOf`) reads this, so a field of the same width in degrees is
 * as deep on either page.
 */
export const chartZoomOf = (zoom: number): number => (zoom * 8) / (2 * Math.PI);

/** The part of the unit box on the screen, in the unit box's own numbers, for a map `width` pixels wide (half as tall) at `zoom`, moved by `panX`, `panY` pixels. */
export function visibleBox(width: number, zoom: number, panX: number, panY: number): { u0: number; u1: number; v0: number; v1: number } {
  const k = (width / UNIT_W) * zoom;
  const height = width / 2;
  return {
    u0: Math.max(0, (0 - width / 2 - panX) / k + UNIT_W / 2),
    u1: Math.min(UNIT_W, (width - width / 2 - panX) / k + UNIT_W / 2),
    v0: Math.max(0, (0 - height / 2 - panY) / k + UNIT_H / 2),
    v1: Math.min(UNIT_H, (height - height / 2 - panY) / k + UNIT_H / 2),
  };
}

type Vector = [number, number, number];
const vectorOf = (p: SkyPoint): Vector => {
  const ra = p.rightAscension * RADIANS;
  const dec = p.declination * RADIANS;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
};
const dot = (a: Vector, b: Vector): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Vector): Vector => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

/**
 * The round patch of sky that holds everything the visible part of the map shows, with a margin for the grid it was found from and so that a small pan finds its tiles already here; `undefined` where nothing of the sky is on the screen.
 * The picture is sampled over a 17 by 9 grid, along the screen's edges and along the oval's rim where that is on the screen; the circle's middle starts at the mean direction and is pulled toward the farthest sample, which keeps a patch cut off by the rim small.
 *
 * @param options - The map: its frame and projection (the width is the unit box's 1000).
 * @param seen - The part of the unit box on the screen (`visibleBox`).
 * @returns The patch in right ascension and declination, in degrees.
 */
export function skyFieldOf(options: AllSkyOptions, seen: { u0: number; u1: number; v0: number; v1: number }): FaintField | undefined {
  const { u0, u1, v0, v1 } = seen;
  if (!(u1 > u0) || !(v1 > v0)) return undefined;
  const points: Vector[] = [];
  const add = (u: number, v: number): void => {
    const at = allSkyUnproject({ x: u, y: v }, options);
    if (at !== undefined) points.push(vectorOf(at));
  };
  const columns = 16;
  const rows = 8;
  for (let i = 0; i <= columns; i++) for (let j = 0; j <= rows; j++) add(u0 + ((u1 - u0) * i) / columns, v0 + ((v1 - v0) * j) / rows);
  // the edges more finely: a patch is widest at its edge
  for (let i = 0; i <= 4 * columns; i++) {
    const u = u0 + ((u1 - u0) * i) / (4 * columns);
    add(u, v0);
    add(u, v1);
  }
  for (let j = 0; j <= 4 * rows; j++) {
    const v = v0 + ((v1 - v0) * j) / (4 * rows);
    add(u0, v);
    add(u1, v);
  }
  // the rim, drawn a hair inside so that it unprojects, where it is on the screen
  for (const rim of allSkyOutline(options, 180)) {
    if (rim.x < u0 || rim.x > u1 || rim.y < v0 || rim.y > v1) continue;
    add(UNIT_W / 2 + (rim.x - UNIT_W / 2) * 0.9995, UNIT_H / 2 + (rim.y - UNIT_H / 2) * 0.9995);
  }
  if (points.length === 0) return undefined;
  let centre = unit(points.reduce<Vector>((sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]], [0, 0, 0]));
  if (Math.hypot(centre[0], centre[1], centre[2]) === 0 || !Number.isFinite(centre[0])) return { rightAscension: 0, declination: 0, radius: 180 };
  // a few steps of pulling the middle toward the farthest sample: the circle that holds them all gets smaller
  for (let step = 1; step <= 12; step++) {
    let far = points[0]!;
    for (const p of points) if (dot(p, centre) < dot(far, centre)) far = p;
    centre = unit([centre[0] + (far[0] - centre[0]) / (step + 1), centre[1] + (far[1] - centre[1]) / (step + 1), centre[2] + (far[2] - centre[2]) / (step + 1)]);
  }
  let reach = 1;
  for (const p of points) reach = Math.min(reach, dot(p, centre));
  const radius = Math.acos(Math.max(-1, Math.min(1, reach))) / RADIANS;
  return { rightAscension: ((Math.atan2(centre[1], centre[0]) / RADIANS) + 360) % 360, declination: Math.atan2(centre[2], Math.hypot(centre[0], centre[1])) / RADIANS, radius: Math.min(180, radius * 1.08 + 0.05) };
}
