// The five planets you can see without a telescope, for "my sky": where each is among the stars and how bright, from E. M. Standish's approximate Keplerian elements of the planets for 1800 to 2050 ("Keplerian Elements for Approximate
// Positions of the Major Planets", JPL Solar System Dynamics, https://ssd.jpl.nasa.gov/planets/approx_pos.html, Table 1: published numbers), solved with Kepler's equation. Good to a few arc-minutes, far finer than the eye.
// The brightness is the Astronomical Almanac's formula (the planet's magnitude at one au from both the Sun and the Earth, plus 5 log of the two distances and a term in the phase angle; Saturn's rings are not counted).
// Light-time and aberration (under 30 arc-seconds) and the Earth-Moon barycentre's wobble (a few arc-seconds) are left out. Pure: no DOM, no clock reads.
import { J2000_MS, moment, type When } from "../when.ts";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const DAY_MS = 86_400_000;

/**
 * The planets bright enough for the naked eye that move across the sky as wanderers: `mercury`, `venus`, `mars`, `jupiter` and `saturn`.
 *
 * @example
 * ```ts
 * import type { NakedEyePlanet } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const planet: NakedEyePlanet = "jupiter";
 * console.log(planet);
 * ```
 */
export type NakedEyePlanet = "mercury" | "venus" | "mars" | "jupiter" | "saturn";

/** `a` (au), `e`, `I` (degrees), `L` (mean longitude), `peri` (longitude of the perihelion) and `node` (longitude of the ascending node), each at J2000 and then its rate per Julian century. */
type Elements = readonly [number, number, number, number, number, number, number, number, number, number, number, number];

// Standish, Table 1 (1800 AD to 2050 AD): a, e, I, L, long.peri., long.node. and their rates, per century.
const ELEMENTS: Readonly<Record<NakedEyePlanet | "earth", Elements>> = {
  mercury: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255, 0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  mars: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
};

/** Each planet's magnitude at 1 au from the Sun and the Earth, and the phase-angle terms (degrees) of the Almanac's formula. */
const BRIGHTNESS: Readonly<Record<NakedEyePlanet, readonly [number, number, number, number]>> = {
  mercury: [-0.42, 0.038, -0.000273, 0.000002],
  venus: [-4.4, 0.0009, 0.000239, -0.00000065],
  mars: [-1.52, 0.016, 0, 0],
  jupiter: [-9.4, 0.005, 0, 0],
  saturn: [-8.88, 0.044, 0, 0],
};

/**
 * The order planets are listed in: by distance from the Sun.
 *
 * @example
 * ```ts
 * import { NAKED_EYE_PLANETS } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(NAKED_EYE_PLANETS.join(" ")); // mercury venus mars jupiter saturn
 * ```
 */
export const NAKED_EYE_PLANETS: readonly NakedEyePlanet[] = ["mercury", "venus", "mars", "jupiter", "saturn"];

/** Heliocentric ecliptic position (J2000), in au. */
function heliocentric(planet: NakedEyePlanet | "earth", T: number): [number, number, number] {
  const k = ELEMENTS[planet];
  const a = k[0] + k[6] * T;
  const e = k[1] + k[7] * T;
  const I = (k[2] + k[8] * T) * RAD;
  const L = k[3] + k[9] * T;
  const peri = k[4] + k[10] * T;
  const node = (k[5] + k[11] * T) * RAD;
  const omega = peri * RAD - node;
  let M = (((L - peri) % 360) + 360) % 360;
  if (M > 180) M -= 360;
  M *= RAD;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(omega);
  const sw = Math.sin(omega);
  const cn = Math.cos(node);
  const sn = Math.sin(node);
  const ci = Math.cos(I);
  const si = Math.sin(I);
  return [(cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y, (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y, sw * si * x + cw * si * y];
}

/**
 * One planet in the sky.
 *
 * @example
 * ```ts
 * import type { PlanetPlace } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const venus: PlanetPlace = { id: "venus", rightAscension: 200.1, declination: -10.8, magnitude: -4.5, distanceAu: 1.5, phaseAngle: 150, illuminated: 0.07 };
 * console.log(venus.id, venus.magnitude);
 * ```
 */
export interface PlanetPlace {
  id: NakedEyePlanet;
  /** Right ascension in degrees, 0 up to but not including 360, of the J2000 equinox (the stars' own frame: give it to `localFrame(...).fromJ2000`). */
  rightAscension: number;
  /** Declination in degrees, J2000. */
  declination: number;
  /** The apparent magnitude (Venus about -4 at the brightest, Jupiter -2.5, Mars up to -2.9, Saturn 0.5 to 1, Mercury -2 to 3). */
  magnitude: number;
  /** The distance from the Earth in au. */
  distanceAu: number;
  /** The angle Sun-planet-Earth in degrees. */
  phaseAngle: number;
  /** The part of the planet's disc that is lit, 0 to 1. */
  illuminated: number;
}

/**
 * Where the five naked-eye planets are at a moment, with their brightness (Standish's elements: a few arc-minutes).
 *
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns Mercury, Venus, Mars, Jupiter and Saturn, in that order.
 * @throws TypeError or RangeError if `when` is not a valid moment.
 *
 * @example
 * ```ts
 * import { planetPlaces } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // 12 November 2026: Venus low in the dawn glare, Jupiter in Leo
 * const places = planetPlaces(Date.UTC(2026, 10, 12));
 * const jupiter = places.find((p) => p.id === "jupiter")!;
 * console.log(places.length, jupiter.rightAscension.toFixed(0), jupiter.declination.toFixed(0)); // 5 148 14
 * ```
 */
export function planetPlaces(when: When): PlanetPlace[] {
  const T = (moment(when) - J2000_MS) / (DAY_MS * 36525);
  const earth = heliocentric("earth", T);
  const R = Math.hypot(...earth);
  const epsilon = 23.43928 * RAD;
  return NAKED_EYE_PLANETS.map((id) => {
    const p = heliocentric(id, T);
    const r = Math.hypot(...p);
    const gx = p[0] - earth[0];
    const gy = p[1] - earth[1];
    const gz = p[2] - earth[2];
    const delta = Math.hypot(gx, gy, gz);
    // the ecliptic of J2000 turned to the equator of J2000
    const x = gx;
    const y = gy * Math.cos(epsilon) - gz * Math.sin(epsilon);
    const z = gy * Math.sin(epsilon) + gz * Math.cos(epsilon);
    const cosI = Math.max(-1, Math.min(1, (r * r + delta * delta - R * R) / (2 * r * delta)));
    const i = Math.acos(cosI) * DEG;
    const [v, c1, c2, c3] = BRIGHTNESS[id];
    return {
      id,
      rightAscension: ((Math.atan2(y, x) * DEG) % 360 + 360) % 360,
      declination: Math.asin(z / delta) * DEG,
      magnitude: v + 5 * Math.log10(r * delta) + c1 * i + c2 * i * i + c3 * i * i * i,
      distanceAu: delta,
      phaseAngle: i,
      illuminated: (1 + cosI) / 2,
    };
  });
}
