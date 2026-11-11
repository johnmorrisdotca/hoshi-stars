// The host stars of confirmed exoplanets that matter to a visitor: the nearest ones (within 50 light-years), the ones with an IAU proper name, and TRAPPIST-1. Each has its place on the sky (J2000), its distance with
// the error and where each value comes from, and its planets' names and orbital periods. The exoplanet-hosts tier (`@johnmorrisdotca/hoshi-stars/exoplanet-hosts`): about 9 kB gzipped. The planets are the NASA Exoplanet
// Archive's; the star's position, distance, type and magnitude are the Yale tables' and 2MASS's, never the Archive's (it carries Gaia and Hipparcos values this package does not pass on). Pure: no DOM, no clock.
import { EXOPLANET_HOST_ROWS, type ExoplanetHostRow, type ExoplanetRow } from "./data/exoplanet-hosts.ts";
import { luminosityClass, type LuminosityClass } from "./spectral.ts";

/**
 * Where a value of a host star comes from: `"BSC"` the Yale Bright Star Catalogue, `"GCTP"` the Yale General Catalogue of Trigonometric Stellar Parallaxes, `"2MASS"` the Two Micron All Sky Survey, or `"typed"` a published value
 * typed into the package (TRAPPIST-1's parallax, from its papers).
 *
 * @example
 * ```ts
 * import { exoplanetHostByName, type ExoplanetHostSource } from "@johnmorrisdotca/hoshi-stars/exoplanet-hosts";
 *
 * const source: ExoplanetHostSource = exoplanetHostByName("Proxima Centauri")!.sources.position;
 * console.log(source);
 * ```
 */
export type ExoplanetHostSource = "BSC" | "GCTP" | "2MASS" | "typed";

/**
 * Why a host is in the table: `"near"` (within 50 light-years), `"named"` (a star with an IAU proper name, farther) or `"typed"` (TRAPPIST-1, whose distance is typed from its papers).
 *
 * @example
 * ```ts
 * import { exoplanetHostByName, type ExoplanetHostSelection } from "@johnmorrisdotca/hoshi-stars/exoplanet-hosts";
 *
 * const why: ExoplanetHostSelection = exoplanetHostByName("TRAPPIST-1")!.selection;
 * console.log(why);
 * ```
 */
export type ExoplanetHostSelection = "near" | "named" | "typed";

/**
 * One confirmed planet, as the NASA Exoplanet Archive gives it.
 *
 * @example
 * ```ts
 * import { exoplanetHostByName, type Exoplanet } from "@johnmorrisdotca/hoshi-stars/exoplanet-hosts";
 *
 * const b: Exoplanet = exoplanetHostByName("Proxima Centauri")!.planets[0]!;
 * console.log(b.name, b.periodDays, b.discoveryYear);
 * ```
 */
export interface Exoplanet {
  /** The planet's name (`Proxima Cen b`). */
  name: string;
  /** The letter after the star's name (`b`). */
  letter: string;
  /** The orbital period in days, or `undefined` where none is published (a planet found by direct imaging may have none). */
  periodDays: number | undefined;
  /** The paper the period is from (`Faria et al. 2022`), or `undefined`. */
  periodReference: string | undefined;
  /** The year of discovery, or `undefined`. */
  discoveryYear: number | undefined;
  /** How it was found, in the Archive's words (`Radial Velocity`, `Transit`, `Imaging`). */
  discoveryMethod: string;
}

/**
 * One host star with its planets.
 *
 * @example
 * ```ts
 * import { exoplanetHostByName, type ExoplanetHost } from "@johnmorrisdotca/hoshi-stars/exoplanet-hosts";
 *
 * const host: ExoplanetHost = exoplanetHostByName("TRAPPIST-1")!;
 * console.log(host.name, host.planetCount, host.lightYears.toFixed(1));
 * ```
 */
export interface ExoplanetHost {
  /** A key that stays the same: `proxima-cen`, `trappist-1`. */
  id: string;
  /** The star's name (`Proxima Centauri`, `Helvetios`, `GJ 876`). */
  name: string;
  /** The name in Japanese where known, else `undefined`. */
  nameJa: string | undefined;
  /** The star's designation with Greek letters where it has one (`ε Eri`, `Proxima Cen`), the same form as in `/near-stars`. */
  designation: string;
  /** The name the NASA Exoplanet Archive gives the host (`eps Eri`, `Proxima Cen`). */
  archiveName: string;
  /** Other spellings that find the host (`ヘルヴェティオス` for Helvetios). */
  aliases: readonly string[];
  /** The IAU three-letter constellation abbreviation the star lies in. */
  constellation: string;
  /** Right ascension in degrees at J2000, 0 up to 360. */
  rightAscension: number;
  /** Declination in degrees at J2000, -90 to 90. */
  declination: number;
  /** The error of the position in arc-seconds where the table gives one, else `undefined`. */
  positionErrorArcsec: number | undefined;
  /** The distance in light-years, known to 10% or better. */
  lightYears: number;
  /** The error of `lightYears`. */
  lightYearsError: number;
  /** The spectral type, or `undefined` where the source gives none. */
  spectralType: string | undefined;
  /** The luminosity class in `spectralType`, or `undefined`. */
  luminosityClass: LuminosityClass | undefined;
  /** The V magnitude, or `undefined`. */
  magnitude: number | undefined;
  /** The id of the system in `@johnmorrisdotca/hoshi-stars/near-stars` that holds this star, where it is within 20 light-years, else `undefined`. */
  nearStarId: string | undefined;
  /** Why the star is in the table. */
  selection: ExoplanetHostSelection;
  /** The number of confirmed planets in `planets`. */
  planetCount: number;
  /** The confirmed planets (not flagged controversial), by letter. */
  planets: readonly Exoplanet[];
  /** Papers behind the typed values, empty for the others. */
  references: readonly string[];
  /** Where each value comes from. */
  sources: { position: ExoplanetHostSource; distance: "GCTP" | "BSC" | "dynamical" | "typed"; spectralType: ExoplanetHostSource | undefined; magnitude: ExoplanetHostSource | undefined; planets: "NASA Exoplanet Archive" };
}

/**
 * The distance within which every host star with a known distance is in the table, in light-years. Farther hosts are in only if a star has an IAU proper name, and TRAPPIST-1.
 *
 * @example
 * ```ts
 * import { EXOPLANET_HOST_LIMIT_LY } from "@johnmorrisdotca/hoshi-stars/exoplanet-hosts";
 *
 * console.log(EXOPLANET_HOST_LIMIT_LY);
 * ```
 */
export const EXOPLANET_HOST_LIMIT_LY = 50;

/**
 * The acknowledgement the NASA Exoplanet Archive asks for in anything that uses its data. A page that shows these planets shows it.
 *
 * @example
 * ```ts
 * import { EXOPLANET_ARCHIVE_ACKNOWLEDGEMENT } from "@johnmorrisdotca/hoshi-stars/exoplanet-hosts";
 *
 * console.log(EXOPLANET_ARCHIVE_ACKNOWLEDGEMENT);
 * ```
 */
export const EXOPLANET_ARCHIVE_ACKNOWLEDGEMENT =
  "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.";

const stored: ExoplanetHost[] = [];
const byText = new Map<string, ExoplanetHost>();
const key = (text: string): string => String(text).trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");

function planet(row: ExoplanetRow): Exoplanet {
  return Object.freeze({ name: row.name, letter: row.letter, periodDays: row.periodDays, periodReference: row.periodRef, discoveryYear: row.year, discoveryMethod: row.method });
}

function build(row: ExoplanetHostRow): ExoplanetHost {
  return Object.freeze({
    id: row.id, name: row.name, nameJa: row.nameJa, designation: row.designation, archiveName: row.archiveName, aliases: Object.freeze([...(row.aliases ?? [])]), constellation: row.constellation, rightAscension: row.ra, declination: row.dec, positionErrorArcsec: row.posErr,
    lightYears: row.ly, lightYearsError: row.lyErr ?? 0, spectralType: row.sp, luminosityClass: row.sp === undefined ? undefined : luminosityClass(row.sp), magnitude: row.mag, nearStarId: row.nearStarId, selection: row.why, planetCount: row.planets.length,
    planets: Object.freeze(row.planets.map(planet)), references: Object.freeze([...(row.references ?? [])]),
    sources: Object.freeze({ position: row.posSrc, distance: row.distSrc, spectralType: row.spSrc, magnitude: row.magSrc, planets: "NASA Exoplanet Archive" as const }),
  });
}

function load(): void {
  if (stored.length > 0) return;
  for (const row of EXOPLANET_HOST_ROWS) {
    const host = build(row);
    stored.push(host);
    const texts = [host.id, host.name, host.nameJa, host.designation, host.archiveName, ...host.aliases, ...host.planets.map((p) => p.name)];
    for (const text of texts) if (text !== undefined && !byText.has(key(text))) byText.set(key(text), host);
  }
}

/**
 * The host stars of confirmed exoplanets, nearest first: the stars within 50 light-years whose distance the Yale tables give to 10% or better, the stars with an IAU proper name among those, and TRAPPIST-1.
 *
 * @param options - `maxLightYears`: only hosts nearer than this. `minPlanets`: only hosts with at least this many confirmed planets.
 * @returns A fresh array of the shared, frozen hosts.
 * @throws TypeError if an option is not a number.
 *
 * @example
 * ```ts
 * import { exoplanetHosts } from "@johnmorrisdotca/hoshi-stars/exoplanet-hosts";
 *
 * console.log(exoplanetHosts({ minPlanets: 4 }).map((h) => `${h.name} ${h.planetCount}`));
 * ```
 */
export function exoplanetHosts(options: { maxLightYears?: number; minPlanets?: number } = {}): ExoplanetHost[] {
  load();
  const { maxLightYears, minPlanets } = options ?? {};
  for (const [name, value] of [["maxLightYears", maxLightYears], ["minPlanets", minPlanets]] as const) {
    if (value !== undefined && (typeof value !== "number" || Number.isNaN(value))) throw new TypeError(`${name} must be a number, got ${String(value)}`);
  }
  return stored.filter((h) => (maxLightYears === undefined || h.lightYears <= maxLightYears) && (minPlanets === undefined || h.planetCount >= minPlanets));
}

/**
 * A host by a name, ignoring case and extra spaces: its name, its Japanese name, the Archive's name for it (`Proxima Cen`) or the name of one of its planets (`TRAPPIST-1 e`).
 *
 * @param text - The name.
 * @returns The host, or `undefined`.
 *
 * @example
 * ```ts
 * import { exoplanetHostByName } from "@johnmorrisdotca/hoshi-stars/exoplanet-hosts";
 *
 * console.log(exoplanetHostByName("trappist-1 e")?.name, exoplanetHostByName("Proxima Cen b")?.planetCount);
 * ```
 */
export function exoplanetHostByName(text: string): ExoplanetHost | undefined {
  load();
  return byText.get(key(text));
}
