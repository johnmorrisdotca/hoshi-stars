// The camera of the constellation in 3D, as numbers only (no three.js, no DOM), so it can be tested. It starts at the viewpoint (the Earth) looking at the middle of the figure, so the picture is the sky chart; turning it
// moves the camera round the figure, farther away and with a wider view as it turns, until it looks across the lines of sight and the distances lie side by side.
import type { Point3 } from "../src/constellation-3d.ts";

/** What the camera needs to know about the figure: the way it points, how big it is on the sky, how far its stars are and how wide the scene is across the lines of sight. All distances in light-years. */
export interface Fit {
  /** The direction from the viewpoint to the middle of the figure, and up (celestial north, square to it). */
  centre: Point3;
  up: Point3;
  /** The figure's angular radius in degrees. */
  radius: number;
  /** The distance at which the camera looks when it is at the viewpoint: the distance of the middle of the figure. */
  middle: number;
  /** How far the scene reaches from the viewpoint along `centre`. */
  reach: number;
  /** How far the scene reaches sideways from the line through the middle. */
  lateral: number;
  /** Width over height of the view, and its height in pixels (a pan is in pixels). */
  aspect: number;
  height: number;
}

/** The pose the shared view controls hold: `yaw` and `tilt` and `roll` in degrees, `zoom` (1 is Fit) and the pan in pixels. */
export interface Pose {
  yaw: number;
  tilt: number;
  roll: number;
  zoom: number;
  panX: number;
  panY: number;
}

export interface CameraSpec {
  position: Point3;
  target: Point3;
  up: Point3;
  /** The tangent of half the view's height: the view is `2 * atan(tanHalf)` degrees tall. */
  tanHalf: number;
  /** 0 looking from the viewpoint, 1 looking across the lines of sight. */
  across: number;
}

export const RESTING_POSE: Pose = { yaw: 0, tilt: 0, roll: 0, zoom: 1, panX: 0, panY: 0 };
/** The tangent of half the view's height when the figure is seen from the side. */
export const SIDE_TAN = Math.tan((38 * Math.PI) / 360);

const RADIANS = Math.PI / 180;
const add = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Point3, k: number): Point3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Point3, b: Point3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Point3): Point3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));
const mix = (a: number, b: number, t: number): number => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** The tangent of half the view's height at the viewpoint: wide enough for the figure's radius with a margin, whichever way the view is wider (a gnomonic picture, the sky chart's straight lines). At most 70 degrees from the middle. */
export function frontTan(radius: number, aspect: number): number {
  const tan = Math.tan(Math.min(70, Math.max(2.5, radius * 1.18)) * RADIANS);
  return Math.min(Math.tan(70 * RADIANS), tan * Math.max(1, 1 / Math.max(0.2, aspect)));
}

/** How far from the figure the camera is when it looks across the lines of sight: far enough to hold the Earth at one end and the farthest star at the other, and the sideways reach. */
export function sideDistance(fit: Fit): number {
  const half = Math.max(fit.reach / 2, 1) * 1.14;
  const lateral = Math.max(fit.lateral, 1) * 1.25;
  // the distances run along the view's long side: across a wide view, up a tall one
  return fit.aspect >= 1 ? Math.max(half / (SIDE_TAN * fit.aspect), lateral / SIDE_TAN) : Math.max(half / SIDE_TAN, lateral / (SIDE_TAN * Math.max(0.2, fit.aspect)));
}

/**
 * The camera for a pose. The yaw and tilt carry the camera round the figure the way the hand turns the figure: drag right and the near side moves right. At no turn the camera is at the viewpoint.
 *
 * @example
 * ```ts
 * const spec = cameraFor({ centre: [1, 0, 0], up: [0, 0, 1], radius: 10, middle: 300, reach: 600, lateral: 40, aspect: 1.5, height: 600 }, { ...RESTING_POSE, yaw: -90 });
 * console.log(spec.across); // 1
 * ```
 */
export function cameraFor(fit: Fit, pose: Pose): CameraSpec {
  const f = unit(fit.centre);
  const u0 = unit(add(fit.up, scale(f, -dot(fit.up, f))));
  const r0 = cross(f, u0);
  const yaw = pose.yaw * RADIANS;
  const tilt = pose.tilt * RADIANS;
  // forward after the yaw, then after the tilt
  const fy = add(scale(f, Math.cos(yaw)), scale(r0, Math.sin(yaw)));
  const ry = add(scale(r0, Math.cos(yaw)), scale(f, -Math.sin(yaw)));
  const forward = add(scale(fy, Math.cos(tilt)), scale(u0, Math.sin(tilt)));
  const upRaw = add(scale(u0, Math.cos(tilt)), scale(fy, -Math.sin(tilt)));
  // away from the front, 0 to 1: the angle between the camera's direction and the way it first looked
  const away = Math.acos(Math.min(1, Math.max(-1, dot(forward, f)))) / RADIANS;
  const across = smooth(Math.min(1, Math.max(0, away - 1e-6) / 70));
  const middle = Math.max(fit.middle, 1);
  const pivotAt = middle + (fit.reach / 2 - middle) * across;
  const distance = mix(middle, sideDistance(fit), across);
  const tanHalf = mix(frontTan(fit.radius, fit.aspect), SIDE_TAN, across) / Math.max(0.05, pose.zoom);
  let up = upRaw;
  let right = ry;
  // a tall view (a phone held upright) shows the distances up the screen: the camera rolls a quarter turn as it looks across the lines of sight
  const alongSight = Math.max(-1, Math.min(1, dot(ry, f) * 1.5));
  const tall = fit.aspect < 1 ? across * alongSight * 90 : 0;
  if (pose.roll !== 0 || tall !== 0) {
    const roll = (pose.roll + tall) * RADIANS;
    up = add(scale(upRaw, Math.cos(roll)), scale(ry, Math.sin(roll)));
    right = add(scale(ry, Math.cos(roll)), scale(upRaw, -Math.sin(roll)));
  }
  // A pan is not made here: the page slides the picture by the pixels it is told (a view offset), so what is drawn moves by exactly the pan whatever the depth of the stars.
  const target = scale(f, pivotAt);
  const position = add(target, scale(forward, -distance));
  return { position, target, up, tanHalf, across };
}
