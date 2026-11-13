// The sample the demo's "Planets and Moon" control shows: the Moon and the five bright planets as they stood at 00:00 UTC on 12 November 2026, a FIXED list for that one moment (it is not live and moves with nothing).
// The figures are our own: worked out once with the family's own planet-position package (the VSOP87B planet series and the ELP2000-82B Moon, both published theories) and typed in here rounded; the magnitudes come from the
// published low-precision formulas of the Astronomical Almanac (phase angle and distances). Nothing here is read from a table and nothing is fetched. NOTICE.md records the source and the date.
// This file imports no planet package: the chart takes a plain list, and a page that has such a package makes the list itself.
import type { SkyBody } from "../src/chart/bodies.ts";

/** The moment the sample is for: 00:00 UTC on 12 November 2026. */
export const SAMPLE_BODIES_MOMENT = "2026-11-12T00:00:00Z";

/**
 * The sample bodies, in the order of the Sun's distance, with the Moon last: right ascension and declination in degrees (J2000), magnitude, lit fraction, apparent diameter in arc-seconds and, for the Moon, the position angle of the bright limb.
 *
 * @example
 * ```ts
 * import { SAMPLE_BODIES } from "./bodies-sample.ts";
 *
 * console.log(SAMPLE_BODIES.map((body) => body.id).join(" "));
 * // mercury venus mars jupiter saturn moon
 * ```
 */
export const SAMPLE_BODIES: readonly SkyBody[] = [
  { id: "mercury", names: { en: "Mercury", ja: "水星" }, ra: 213.25, dec: -11.49, magnitude: 1, phase: 0.2, size: 9 },
  { id: "venus", names: { en: "Venus", ja: "金星" }, ra: 200.07, dec: -10.76, magnitude: -4.5, phase: 0.11, size: 53 },
  { id: "mars", names: { en: "Mars", ja: "火星" }, ra: 146.53, dec: 15.4, magnitude: 0.8, phase: 0.89, size: 7 },
  { id: "jupiter", names: { en: "Jupiter", ja: "木星" }, ra: 147.66, dec: 13.83, magnitude: -2.1, phase: 0.99, size: 37 },
  { id: "saturn", names: { en: "Saturn", ja: "土星" }, ra: 8.66, dec: 0.84, magnitude: 0.4, phase: 1, size: 19 },
  { id: "moon", names: { en: "Moon", ja: "月" }, ra: 258.14, dec: -27.57, magnitude: -6.9, phase: 0.07, brightLimb: 282.5, size: 1773 },
];

/**
 * Where the sample looks when it is shown: the middle of the chart that holds the Moon and the planets of that morning, wide enough for all six.
 *
 * @example
 * ```ts
 * import { SAMPLE_VIEW } from "./bodies-sample.ts";
 *
 * console.log(SAMPLE_VIEW.projection);
 * // equirectangular
 * ```
 */
export const SAMPLE_VIEW = { projection: "equirectangular", ra: 180, dec: -5, zoom: 1 } as const;
