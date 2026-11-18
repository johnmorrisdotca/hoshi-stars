// Where a point of the sky falls on the chart, and the path through several: the seam of a whole-sky map, the cut that keeps a round projection's far side out, and the SVG path of a line of points. Moved out of chart.ts as it was; chart.ts imports it.
import { projector, unproject, type Projection, type SkyPoint } from "../projection.ts";
import type { View } from "./types.ts";
import { centreOf, round, scaleOf, WIDE, wrap180 } from "./view-math.ts";

/** Whether a segment between two sky points would run across the seam of a whole-sky projection, and so must not be drawn. */
export function crossesSeam(view: View, a: SkyPoint, b: SkyPoint): boolean {
  if (!WIDE.includes(view.projection)) return false;
  const da = wrap180(a.rightAscension - view.ra);
  const db = wrap180(b.rightAscension - view.ra);
  return Math.sign(da) !== Math.sign(db) && Math.abs(da) + Math.abs(db) > 180;
}

export type Placer = (point: SkyPoint) => [number, number] | undefined;

export function placer(view: View, width: number, height: number): Placer {
  const reach = Math.max(6 * Math.max(width, height), 1e5);
  // the projection is set up once for the frame, not for each of the thousands of points placed in it
  const project = projector(view.projection, { centre: centreOf(view), scale: scaleOf(view, width, height) });
  return (point) => {
    const p = project(point);
    const at: [number, number] | undefined = p === undefined ? undefined : [width / 2 + p.x, height / 2 - p.y];
    return at === undefined || Math.abs(at[0] - width / 2) > reach || Math.abs(at[1] - height / 2) > reach ? undefined : at;
  };
}

export const ROUND_PROJECTIONS: readonly Projection[] = ["stereographic", "gnomonic", "orthographic", "equidistant"];
export const unitVectors = new WeakMap<object, [number, number, number]>();
/**
 * For a projection that spreads the sky out round the middle (distance from the middle on the chart grows with the angle from it): a test that is false for a point too far from the middle to
 * be inside the chart's margin of 24 pixels, and true for every other, with a hair of slack. `undefined` where it cannot tell (the whole-sky maps, or a chart wider than the sky it shows).
 */
export function nearEnough(view: View, width: number, height: number): ((point: SkyPoint) => boolean) | undefined {
  if (!ROUND_PROJECTIONS.includes(view.projection)) return undefined;
  const corner = Math.hypot(width / 2 + 24, height / 2 + 24);
  const far = unproject(view.projection, { x: corner, y: 0 }, { centre: centreOf(view), scale: scaleOf(view, width, height) });
  if (far === undefined) return undefined;
  const d = Math.PI / 180;
  const unit = (p: SkyPoint): [number, number, number] => [Math.cos(p.declination * d) * Math.cos(p.rightAscension * d), Math.cos(p.declination * d) * Math.sin(p.rightAscension * d), Math.sin(p.declination * d)];
  const [cx, cy, cz] = unit(centreOf(view));
  const [fx, fy, fz] = unit(far);
  // the angle from the middle to the point where the corner's distance falls, and a hair more (a millionth of a radian)
  const angle = Math.acos(Math.max(-1, Math.min(1, cx * fx + cy * fy + cz * fz))) + 1e-6;
  if (angle >= Math.PI / 2) return undefined;
  const floor = Math.cos(angle);
  return (point) => {
    let v = unitVectors.get(point);
    if (v === undefined) unitVectors.set(point, (v = unit(point)));
    return cx * v[0] + cy * v[1] + cz * v[2] >= floor;
  };
}

/** A path through sky points, lifted at the far side, at the seam and where a point is out of reach. */
export function pathOf(view: View, place: Placer, points: readonly SkyPoint[]): string {
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
