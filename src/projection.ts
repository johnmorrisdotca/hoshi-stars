// Map projections of the celestial sphere for drawing star charts: stereographic, orthographic, gnomonic, azimuthal equidistant, equirectangular, Mollweide and Hammer-Aitoff.
// Pure maths, no DOM and no dependencies. The formulas are written from J. P. Snyder, "Map Projections: A Working Manual", U.S. Geological Survey Professional Paper 1395 (1987, public domain):
// the azimuthal family in chapters 20 to 22 and 25, the cylindrical one in chapter 12, Mollweide in chapter 31 and Hammer in chapter 24 (on the unit sphere, with the centre as the origin).
// The sky is a sphere seen from inside, so the default puts east on the LEFT (right ascension grows toward the left); `mirror: true` gives the map convention with east on the right.

/** The projections: the five that show a hemisphere or less, then the two that show the whole sky. */
export const PROJECTIONS = ["stereographic", "orthographic", "gnomonic", "equidistant", "equirectangular", "mollweide", "hammer"] as const;

/**
 * The kinds of projection.
 *
 * - `stereographic`: keeps shapes (conformal); the whole sphere but the antipode, stretching to the edge. Radius 2 at 90 degrees from the centre.
 * - `orthographic`: the sky as a ball seen from far away; the near hemisphere only. Radius 1 at 90 degrees.
 * - `gnomonic`: great circles are straight lines; less than 90 degrees from the centre.
 * - `equidistant`: the azimuthal equidistant; distance from the centre is true, the whole sphere is a disc of radius pi.
 * - `equirectangular`: the plain right ascension and declination plot; the centre's declination moves the chart up or down.
 * - `mollweide`: an equal-area oval of the whole sky, turned so the centre is its middle.
 * - `hammer`: Hammer's equal-area oval of the whole sky (often called Hammer-Aitoff), turned so the centre is its middle.
 *
 * @example
 * ```ts
 * import { PROJECTIONS, type Projection } from "@johnmorrisdotca/hoshi-stars/projection";
 *
 * const kind: Projection = PROJECTIONS[0];
 * console.log(kind, PROJECTIONS.length);
 * ```
 */
export type Projection = (typeof PROJECTIONS)[number];

/**
 * A point on the celestial sphere, in degrees. Right ascension may be any number (it wraps at 360); declination is -90 to 90.
 *
 * @example
 * ```ts
 * import type { SkyPoint } from "@johnmorrisdotca/hoshi-stars/projection";
 *
 * const polaris: SkyPoint = { rightAscension: 37.95, declination: 89.26 };
 * console.log(polaris.declination);
 * ```
 */
export interface SkyPoint {
  /** Right ascension in degrees. */
  rightAscension: number;
  /** Declination in degrees, -90 to 90. */
  declination: number;
}

/**
 * A point on the chart. `x` runs to the right and `y` UP (north above the centre), in the units of `scale`; flip `y` when you draw on a screen.
 *
 * @example
 * ```ts
 * import type { MapPoint } from "@johnmorrisdotca/hoshi-stars/projection";
 *
 * const middle: MapPoint = { x: 0, y: 0 };
 * console.log(middle.x + middle.y);
 * ```
 */
export interface MapPoint {
  /** Across the chart, to the right. East is to the left unless `mirror` is set. */
  x: number;
  /** Up the chart. */
  y: number;
}

/**
 * How to place and size the chart.
 *
 * @example
 * ```ts
 * import type { ProjectionOptions } from "@johnmorrisdotca/hoshi-stars/projection";
 *
 * const options: ProjectionOptions = { centre: { rightAscension: 83.8, declination: -5.4 }, scale: 300 };
 * console.log(options.scale);
 * ```
 */
export interface ProjectionOptions {
  /** The point of the sky that lands at (0, 0). With north up, it is the middle of the chart. */
  centre: SkyPoint;
  /** The radius of the celestial sphere in drawing units; default 1. `stereographic` puts 90 degrees from the centre at 2 times this, `orthographic` at exactly this. For `equirectangular` to give degrees, pass 180 / Math.PI. */
  scale?: number;
  /** Turns the finished chart anticlockwise by this many degrees (as drawn with y up); default 0. */
  rotation?: number;
  /** True for the map convention, east to the right. Default false: the sky seen looking up, east to the left. */
  mirror?: boolean;
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const TWO_PI = 2 * Math.PI;
const SQRT2 = Math.SQRT2;
// A hair of slack so a point exactly on the edge (90 degrees, the oval's rim) is not lost to rounding.
const EDGE = 1e-12;

function finite(name: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError(`${name} must be a finite number, got ${String(value)}`);
  return value;
}

function sky(name: string, point: unknown): SkyPoint {
  if (typeof point !== "object" || point === null) throw new TypeError(`${name} must be an object with rightAscension and declination, got ${String(point)}`);
  const p = point as SkyPoint;
  finite(`${name}.rightAscension`, p.rightAscension);
  const declination = finite(`${name}.declination`, p.declination);
  if (declination < -90 || declination > 90) throw new RangeError(`${name}.declination must be between -90 and 90 degrees, got ${declination}`);
  return p;
}

interface Setup {
  ra0: number;
  sinD0: number;
  cosD0: number;
  dec0: number;
  scale: number;
  sinR: number;
  cosR: number;
  rotated: boolean;
  mirror: boolean;
}

function setup(kind: Projection, options: ProjectionOptions): Setup {
  if (!PROJECTIONS.includes(kind)) throw new RangeError(`kind must be one of ${PROJECTIONS.map((k) => `"${k}"`).join(", ")}, got "${String(kind)}"`);
  if (typeof options !== "object" || options === null) throw new TypeError(`options must be an object with a centre, got ${String(options)}`);
  const centre = sky("options.centre", options.centre);
  const scale = options.scale === undefined ? 1 : finite("options.scale", options.scale);
  if (scale <= 0) throw new RangeError(`options.scale must be greater than 0, got ${scale}`);
  const rotation = options.rotation === undefined ? 0 : finite("options.rotation", options.rotation) * RAD;
  const dec0 = centre.declination * RAD;
  return {
    ra0: centre.rightAscension * RAD,
    sinD0: Math.sin(dec0),
    cosD0: Math.cos(dec0),
    dec0,
    scale,
    sinR: Math.sin(rotation),
    cosR: Math.cos(rotation),
    rotated: rotation !== 0,
    mirror: options.mirror === true,
  };
}

/** An angle in radians brought to -pi up to pi. */
function wrapPi(angle: number): number {
  return angle - TWO_PI * Math.round(angle / TWO_PI);
}

/** Mollweide's auxiliary angle: with t = 2 theta, t + sin t = pi sin(latitude), by Newton's method (Snyder 31). */
function mollweideAngle(latitude: number): number {
  const target = Math.PI * Math.sin(latitude);
  const sign = target < 0 ? -1 : 1;
  const wanted = Math.abs(target);
  if (wanted >= Math.PI - 1e-15) return sign * Math.PI;
  // Near a pole the root is a triple one, so start from its cube-root form there; elsewhere the latitude doubled is close.
  let t = wanted > 2.9 ? Math.PI - Math.cbrt(6 * (Math.PI - wanted)) : 2 * Math.abs(latitude);
  for (let i = 0; i < 60; i += 1) {
    const step = (t + Math.sin(t) - wanted) / (1 + Math.cos(t));
    t -= step;
    if (Math.abs(step) < 1e-15) break;
  }
  return sign * t;
}

/**
 * Where a point of the sky lands on the chart.
 *
 * With the default `mirror: false` the chart is the sky seen looking up: north is up and east is to the LEFT, so `x` grows toward decreasing right ascension. Set `mirror: true` for the map convention (east right).
 * `y` grows toward the north (up the chart).
 *
 * @param kind - The projection.
 * @param point - The sky position in degrees (`rightAscension` wraps at 360; `declination` is -90 to 90).
 * @param options - The `centre` that lands at (0, 0), and optionally `scale`, `rotation` and `mirror`.
 * @returns The point on the chart, or `undefined` when the sky position is not on the visible side: the far hemisphere of `orthographic` and `gnomonic` (90 degrees or more from the centre for `gnomonic`), and the antipode of the centre for `stereographic`.
 * @throws RangeError if `kind` is unknown, or a number is not finite, or a declination is outside -90 to 90, or `scale` is not above 0.
 *
 * @example
 * ```ts
 * import { project } from "@johnmorrisdotca/hoshi-stars/projection";
 *
 * const orion = { centre: { rightAscension: 83.8, declination: -5.4 }, scale: 300 };
 * const betelgeuse = project("stereographic", { rightAscension: 88.79, declination: 7.41 }, orion);
 * console.log(betelgeuse); // left of the middle (it is east of the centre) and above it
 * ```
 */
export function project(kind: Projection, point: SkyPoint, options: ProjectionOptions): MapPoint | undefined {
  const o = setup(kind, options);
  sky("point", point);
  const dec = point.declination * RAD;
  const dl = wrapPi(point.rightAscension * RAD - o.ra0);
  // X is east-positive on the unit sphere, Y is north-positive.
  let X: number;
  let Y: number;
  if (kind === "equirectangular") {
    X = dl;
    Y = dec - o.dec0;
  } else {
    const sinD = Math.sin(dec);
    const cosD = Math.cos(dec);
    const cosDl = Math.cos(dl);
    // The point in the frame of the centre: u toward the centre, e toward the east, n toward the north.
    const u = o.sinD0 * sinD + o.cosD0 * cosD * cosDl;
    const e = cosD * Math.sin(dl);
    const n = o.cosD0 * sinD - o.sinD0 * cosD * cosDl;
    let k: number;
    switch (kind) {
      case "orthographic":
        if (u < -EDGE) return undefined;
        k = 1;
        break;
      case "stereographic":
        if (1 + u < EDGE) return undefined;
        k = 2 / (1 + u);
        break;
      case "gnomonic":
        if (u <= EDGE) return undefined;
        k = 1 / u;
        break;
      case "equidistant": {
        const s = Math.hypot(e, n);
        if (s < 1e-300) {
          if (u < 0) return finish(o, Math.PI, 0);
          k = 1;
        } else {
          k = Math.atan2(s, u) / s;
        }
        break;
      }
      case "mollweide": {
        const lambda = Math.atan2(e, u);
        const t = mollweideAngle(Math.atan2(n, Math.hypot(e, u)));
        return finish(o, ((2 * SQRT2) / Math.PI) * lambda * Math.cos(t / 2), SQRT2 * Math.sin(t / 2));
      }
      default: {
        const lambda = Math.atan2(e, u);
        const cosPhi = Math.hypot(e, u);
        const d = Math.sqrt(1 + cosPhi * Math.cos(lambda / 2));
        return finish(o, (2 * SQRT2 * cosPhi * Math.sin(lambda / 2)) / d, (SQRT2 * n) / d);
      }
    }
    X = k * e;
    Y = k * n;
  }
  return finish(o, X, Y);
}

/** Scales, applies east-left or `mirror`, and turns the chart: from east-positive unit-sphere coordinates to the answer. */
function finish(o: Setup, X: number, Y: number): MapPoint {
  const x = (o.mirror ? X : -X) * o.scale;
  const y = Y * o.scale;
  // Adding zero turns -0 into 0, so the centre is exactly (0, 0).
  if (!o.rotated) return { x: x + 0, y: y + 0 };
  return { x: x * o.cosR - y * o.sinR + 0, y: x * o.sinR + y * o.cosR + 0 };
}

/**
 * The sky position under a point of the chart: the inverse of `project`, with the same `options`.
 *
 * @param kind - The projection.
 * @param point - A point of the chart, in the same units and convention as `project` gives.
 * @param options - The same options that drew the chart.
 * @returns Right ascension (0 up to 360) and declination in degrees, or `undefined` when the point is outside the map: beyond the edge of the orthographic disc, the equidistant disc (radius pi times `scale`), the Mollweide and Hammer ovals, or the equirectangular rectangle.
 * @throws RangeError if `kind` is unknown or a number is not finite.
 *
 * @example
 * ```ts
 * import { project, unproject } from "@johnmorrisdotca/hoshi-stars/projection";
 *
 * const options = { centre: { rightAscension: 279.2, declination: 38.8 }, scale: 200 };
 * const spot = project("orthographic", { rightAscension: 290, declination: 45 }, options)!;
 * console.log(unproject("orthographic", spot, options)); // { rightAscension: 290, declination: 45 }, to rounding
 * ```
 */
export function unproject(kind: Projection, point: MapPoint, options: ProjectionOptions): SkyPoint | undefined {
  const o = setup(kind, options);
  if (typeof point !== "object" || point === null) throw new TypeError(`point must be an object with x and y, got ${String(point)}`);
  finite("point.x", point.x);
  finite("point.y", point.y);
  // Undo the turn, then the mirror, then the scale, to east-positive unit-sphere coordinates.
  const px = o.rotated ? point.x * o.cosR + point.y * o.sinR : point.x;
  const py = o.rotated ? point.y * o.cosR - point.x * o.sinR : point.y;
  const X = (o.mirror ? px : -px) / o.scale;
  const Y = py / o.scale;
  let u: number;
  let e: number;
  let n: number;
  switch (kind) {
    case "equirectangular": {
      const declination = Y + o.dec0;
      if (Math.abs(X) > Math.PI + EDGE || Math.abs(declination) > Math.PI / 2 + EDGE) return undefined;
      return answer(o.ra0 + X, Math.max(-Math.PI / 2, Math.min(Math.PI / 2, declination)));
    }
    case "mollweide": {
      if ((X * X) / 8 + (Y * Y) / 2 > 1 + EDGE) return undefined;
      const s = Math.max(-1, Math.min(1, Y / SQRT2));
      const cosT = Math.sqrt(1 - s * s);
      // sin(latitude) = (2 theta + sin 2 theta) / pi, with 2 theta = 2 atan2(sin theta, cos theta)
      const sinPhi = Math.max(-1, Math.min(1, (2 * Math.atan2(s, cosT) + 2 * s * cosT) / Math.PI));
      const lambda = cosT < 1e-300 ? 0 : (Math.PI * X) / (2 * SQRT2 * cosT);
      const cosPhi = Math.sqrt(1 - sinPhi * sinPhi);
      u = cosPhi * Math.cos(lambda);
      e = cosPhi * Math.sin(lambda);
      n = sinPhi;
      break;
    }
    case "hammer": {
      if ((X * X) / 8 + (Y * Y) / 2 > 1 + EDGE) return undefined;
      const z2 = Math.max(0.5, 1 - (X * X) / 16 - (Y * Y) / 4);
      const z = Math.sqrt(z2);
      const lambda = 2 * Math.atan2(z * X, 2 * (2 * z2 - 1));
      const sinPhi = Math.max(-1, Math.min(1, z * Y));
      const cosPhi = Math.sqrt(1 - sinPhi * sinPhi);
      u = cosPhi * Math.cos(lambda);
      e = cosPhi * Math.sin(lambda);
      n = sinPhi;
      break;
    }
    default: {
      const rho = Math.hypot(X, Y);
      if (rho < 1e-300) return answer(o.ra0, o.dec0);
      let sinC: number;
      let cosC: number;
      if (kind === "orthographic") {
        if (rho > 1 + EDGE) return undefined;
        sinC = Math.min(rho, 1);
        cosC = Math.sqrt(1 - sinC * sinC);
      } else if (kind === "stereographic") {
        sinC = (4 * rho) / (4 + rho * rho);
        cosC = (4 - rho * rho) / (4 + rho * rho);
      } else if (kind === "gnomonic") {
        sinC = rho / Math.sqrt(1 + rho * rho);
        cosC = 1 / Math.sqrt(1 + rho * rho);
      } else {
        if (rho > Math.PI + EDGE) return undefined;
        sinC = Math.sin(rho);
        cosC = Math.cos(rho);
      }
      const f = sinC / rho;
      u = cosC;
      e = X * f;
      n = Y * f;
    }
  }
  const w = o.cosD0 * u - o.sinD0 * n;
  return answer(o.ra0 + Math.atan2(e, w), Math.atan2(o.sinD0 * u + o.cosD0 * n, Math.hypot(e, w)));
}

/** Radians to degrees, with right ascension in 0 up to 360. */
function answer(ra: number, dec: number): SkyPoint {
  let rightAscension = (((ra * DEG) % 360) + 360) % 360;
  if (rightAscension >= 360) rightAscension = 0;
  return { rightAscension, declination: dec * DEG };
}
