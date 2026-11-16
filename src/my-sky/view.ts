// Standing outside and looking: the camera of "my sky". It looks along a heading (the compass direction, 0 north, 90 east) and a pitch (degrees above the horizon, 90 straight up), and draws the sky with the stereographic projection,
// which keeps shapes true and can show a view of 130 degrees across without stretching the edges: the horizon is a curve, a line when you look level. The field of view is measured across the smaller side of the picture.
// Pure: no DOM; the page gives the size in pixels and draws what these functions place.
import type { Direction } from "./frame.ts";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/**
 * The lowest pitch you can look: a little below the horizon, so the ground and the compass letters show. The highest, `PITCH_MAX`, is straight up.
 *
 * @example
 * ```ts
 * import { PITCH_MAX, PITCH_MIN } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(PITCH_MIN, PITCH_MAX); // -25 90
 * ```
 */
export const PITCH_MIN = -25;
/**
 * The highest pitch: straight up, the zenith.
 *
 * @example
 * ```ts
 * import { PITCH_MAX } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(PITCH_MAX); // 90
 * ```
 */
export const PITCH_MAX = 90;
/**
 * The narrowest field of view in degrees across the smaller side of the picture: a close look.
 *
 * @example
 * ```ts
 * import { FOV_MIN } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(FOV_MIN); // 20
 * ```
 */
export const FOV_MIN = 20;
/**
 * The widest field of view in degrees across the smaller side of the picture.
 *
 * @example
 * ```ts
 * import { FOV_MAX } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(FOV_MAX); // 130
 * ```
 */
export const FOV_MAX = 130;

/**
 * Where the camera looks and how wide, and the size of the picture in pixels.
 *
 * @example
 * ```ts
 * import type { SkyCamera } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const camera: SkyCamera = { heading: 180, pitch: 35, fov: 90, width: 390, height: 700 };
 * console.log(camera.heading);
 * ```
 */
export interface SkyCamera {
  /** The compass direction the middle of the picture faces: 0 north, 90 east, 180 south, 270 west. */
  heading: number;
  /** Degrees above the horizon the middle of the picture looks; negative looks down at the ground. */
  pitch: number;
  /** The angle in degrees across the smaller side of the picture, 20 to 130. */
  fov: number;
  width: number;
  height: number;
}

/**
 * A point of the picture in pixels, from its top left corner.
 *
 * @example
 * ```ts
 * import type { ScreenSpot } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const middle: ScreenSpot = { x: 200, y: 350 };
 * console.log(middle.x);
 * ```
 */
export interface ScreenSpot {
  x: number;
  y: number;
}

/**
 * Keep a view inside what can be shown: the heading wrapped to 0 up to 360, the pitch held to -25 up to 90 and the field of view to 20 up to 130.
 *
 * @param view - A heading (any number), a pitch and a field of view.
 * @returns The view with each in its range.
 *
 * @example
 * ```ts
 * import { clampView } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(clampView({ heading: -90, pitch: 120, fov: 400 })); // { heading: 270, pitch: 90, fov: 130 }
 * ```
 */
export function clampView(view: { heading: number; pitch: number; fov: number }): { heading: number; pitch: number; fov: number } {
  return {
    heading: (((view.heading % 360) + 360) % 360),
    pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, view.pitch)),
    fov: Math.max(FOV_MIN, Math.min(FOV_MAX, view.fov)),
  };
}

/**
 * The way to face when you step outside and nothing says otherwise: toward the equator, where most of the sky's bright things are (south in the north, north in the south).
 *
 * @param latitude - Degrees north of the equator, negative south.
 * @returns A heading in degrees: 180 for the northern hemisphere, 0 for the southern.
 *
 * @example
 * ```ts
 * import { openingHeading } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(openingHeading(49.28), openingHeading(-33.9)); // 180 0
 * ```
 */
export function openingHeading(latitude: number): number {
  return latitude >= 0 ? 180 : 0;
}

/**
 * The camera's three axes, in east, north and up: the way it faces, the way its right side points and the way its top points.
 *
 * @example
 * ```ts
 * import { cameraAxes, type CameraAxes } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const axes: CameraAxes = cameraAxes(90, 0);
 * console.log(Math.round(axes.forward.east)); // 1
 * ```
 */
export interface CameraAxes {
  forward: Direction;
  right: Direction;
  up: Direction;
}

/**
 * The directions the camera faces, to its right and above it.
 *
 * @param heading - The compass direction in degrees.
 * @param pitch - Degrees above the horizon.
 * @returns The three unit vectors in east, north and up.
 *
 * @example
 * ```ts
 * import { cameraAxes } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // facing south and level: east is on your left, so the right-hand side of the picture is west
 * const axes = cameraAxes(180, 0);
 * console.log(Math.round(axes.right.east), Math.round(axes.forward.north)); // -1 -1
 * ```
 */
export function cameraAxes(heading: number, pitch: number): CameraAxes {
  const h = heading * RAD;
  const p = pitch * RAD;
  return {
    forward: { east: Math.cos(p) * Math.sin(h), north: Math.cos(p) * Math.cos(h), up: Math.sin(p) },
    right: { east: Math.cos(h), north: -Math.sin(h), up: 0 },
    up: { east: -Math.sin(p) * Math.sin(h), north: -Math.sin(p) * Math.cos(h), up: Math.cos(p) },
  };
}

/**
 * How many pixels one unit of the stereographic plane is: the scale that puts half the field of view at the edge of the smaller side.
 *
 * @param camera - The camera.
 * @returns Pixels per unit; at the middle of the picture one degree is this many pixels times pi over 180.
 *
 * @example
 * ```ts
 * import { viewScale } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(viewScale({ heading: 0, pitch: 0, fov: 90, width: 400, height: 800 }).toFixed(1)); // 241.4
 * ```
 */
export function viewScale(camera: SkyCamera): number {
  return Math.min(camera.width, camera.height) / 2 / (2 * Math.tan((camera.fov * RAD) / 4));
}

/** The cosine of the farthest angle from the middle of the picture that is placed: beyond 150 degrees the projection runs off to infinity. */
const FARTHEST = Math.cos(150 * RAD);

/**
 * Where a direction falls on the picture, or `false` when it is too far behind the camera to be placed (more than 150 degrees from the middle).
 *
 * @param camera - The camera.
 * @param axes - `cameraAxes(camera.heading, camera.pitch)`, made once for a draw.
 * @param direction - East, north and up of the thing.
 * @param out - Receives the pixel.
 * @returns Whether it was placed.
 *
 * @example
 * ```ts
 * import { cameraAxes, projectDirection } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // looking due north, level: north is the middle of the picture and east is to the right of it
 * const camera = { heading: 0, pitch: 0, fov: 90, width: 400, height: 400 };
 * const axes = cameraAxes(camera.heading, camera.pitch);
 * const middle = { x: 0, y: 0 };
 * const east = { x: 0, y: 0 };
 * projectDirection(camera, axes, { east: 0, north: 1, up: 0 }, middle);
 * projectDirection(camera, axes, { east: 1, north: 0, up: 0 }, east);
 * console.log(middle, east.x > middle.x); // { x: 200, y: 200 } true
 * ```
 */
export function projectDirection(camera: SkyCamera, axes: CameraAxes, direction: Direction, out: ScreenSpot): boolean {
  const f = axes.forward;
  const depth = direction.east * f.east + direction.north * f.north + direction.up * f.up;
  if (depth < FARTHEST) return false;
  const r = axes.right;
  const u = axes.up;
  const across = direction.east * r.east + direction.north * r.north;
  const high = direction.east * u.east + direction.north * u.north + direction.up * u.up;
  const k = (2 * viewScale(camera)) / (1 + depth);
  out.x = camera.width / 2 + across * k;
  out.y = camera.height / 2 - high * k;
  return true;
}

/**
 * The direction a pixel looks toward: the inverse of `projectDirection`, for shading the sky and the ground by what is under each pixel.
 *
 * @param camera - The camera.
 * @param axes - `cameraAxes(camera.heading, camera.pitch)`.
 * @param x - The pixel's x from the left.
 * @param y - The pixel's y from the top.
 * @param out - Receives the direction.
 * @returns `out`.
 *
 * @example
 * ```ts
 * import { cameraAxes, directionAt } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const camera = { heading: 90, pitch: 0, fov: 90, width: 400, height: 400 };
 * const middle = directionAt(camera, cameraAxes(90, 0), 200, 200, { east: 0, north: 0, up: 0 });
 * console.log(Math.round(middle.east), Math.round(middle.up)); // 1 0
 * ```
 */
export function directionAt(camera: SkyCamera, axes: CameraAxes, x: number, y: number, out: Direction): Direction {
  const scale = viewScale(camera);
  const X = (x - camera.width / 2) / scale;
  const Y = (camera.height / 2 - y) / scale;
  const rho2 = X * X + Y * Y;
  const depth = (4 - rho2) / (4 + rho2);
  const across = (4 * X) / (4 + rho2);
  const high = (4 * Y) / (4 + rho2);
  out.east = depth * axes.forward.east + across * axes.right.east + high * axes.up.east;
  out.north = depth * axes.forward.north + across * axes.right.north + high * axes.up.north;
  out.up = depth * axes.forward.up + across * axes.right.up + high * axes.up.up;
  return out;
}

/**
 * The degrees of sky one pixel spans at the middle of the picture, for turning a drag in pixels into a turn in degrees.
 *
 * @param camera - The camera.
 * @returns Degrees per pixel.
 *
 * @example
 * ```ts
 * import { degreesPerPixel } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(degreesPerPixel({ heading: 0, pitch: 0, fov: 90, width: 400, height: 800 }).toFixed(2)); // 0.24
 * ```
 */
export function degreesPerPixel(camera: SkyCamera): number {
  return DEG / viewScale(camera);
}
