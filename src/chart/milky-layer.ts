// The Milky Way layer of the chart: the bands' colours, a band cut to a map's width, and the band paths drawn from the package's own bands. Moved out of chart.ts as it was; chart.ts imports it.
import { milkyWayBands } from "../milky-way.ts";
import type { SkyPoint } from "../projection.ts";
import type { Placer } from "./place.ts";
import { centreOf, round, toScreen, WIDE, wrap180 } from "./view-math.ts";
import type { View } from "./types.ts";

/** The Milky Way's bands, faint to bright: the colour, and how much of the night sky each one lightens. The glow is cool, the core warm. */
const MILKY = { levels: [0.04, 0.08, 0.13, 0.2, 0.3, 0.42, 0.58, 0.76], fills: ["#6a80c8", "#7a90d2", "#8da1dc", "#a6b6e6", "#c3cdee", "#e0e4f2", "#f7eedd", "#fff3d8"], opacities: [0.16, 0.14, 0.14, 0.14, 0.15, 0.16, 0.18, 0.2] } as const;

/** A polygon of (longitude from the view's centre, declination) cut to the map's width, in pieces: Sutherland-Hodgman against the two edges, on the polygon and on its copies a turn to either side. */
export function withinWidth(ring: Array<[number, number]>): Array<Array<[number, number]>> {
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

export const bandCache = new Map<number, ReturnType<typeof milkyWayBands>>();
/** The Milky Way's ribbons at a step: worked out once, not on every frame of a pan (they depend on no view, and nothing here changes them). */
export function bandsAt(step: number): ReturnType<typeof milkyWayBands> {
  let found = bandCache.get(step);
  if (found === undefined) bandCache.set(step, (found = milkyWayBands(MILKY.levels, { step })));
  return found;
}

/** The Milky Way: a few soft bands of light, each a set of ribbons along the galactic equator, drawn under everything else. */
export function milkyWay(view: View, place: Placer, width: number, height: number): string {
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
  bandsAt(view.zoom >= 1.8 ? 1 : 2).forEach((band, i) => {
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
