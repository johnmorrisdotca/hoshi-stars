// The stars within 20 light-years, as systems: Proxima Centauri, Barnard's Star, Sirius and the rest, each with its name in English and Japanese where known, its place on the sky (J2000), its distance
// with the error and where each value comes from, and its companions. The near-stars tier (`@johnmorrisdotca/hoshi-stars/near-stars`): about 6 kB gzipped, from the two Yale tables and 2MASS, never from
// Gaia, Hipparcos or Tycho. Pure: no DOM, no clock, no state beyond the parsed table.
import { NEAR_STAR_ROWS, type NearStarMemberRow, type NearStarRow } from "./data/near-stars.ts";
import { luminosityClass, type LuminosityClass } from "./spectral.ts";

/**
 * Where a value comes from: `"BSC"` the Yale Bright Star Catalogue, `"GCTP"` the Yale General Catalogue of Trigonometric Stellar Parallaxes, `"2MASS"` the Two Micron All Sky Survey, or `"typed"` a published value
 * typed into the package (the companions that neither Yale table holds).
 *
 * @example
 * ```ts
 * import { nearStarByName, type NearStarSource } from "@johnmorrisdotca/hoshi-stars/near-stars";
 *
 * const source: NearStarSource = nearStarByName("Proxima Centauri")!.sources.position;
 * console.log(source);
 * ```
 */
export type NearStarSource = "BSC" | "GCTP" | "2MASS" | "typed";

/**
 * Where the distance comes from: `"GCTP"` a measured parallax with an error, `"BSC"` the Bright Star Catalogue's own trigonometric parallax, or `"dynamical"` its parallax from the orbit of a binary.
 *
 * @example
 * ```ts
 * import { nearStarByName, type NearStarDistanceSource } from "@johnmorrisdotca/hoshi-stars/near-stars";
 *
 * const source: NearStarDistanceSource = nearStarByName("Sirius")!.sources.distance;
 * console.log(source);
 * ```
 */
export type NearStarDistanceSource = "GCTP" | "BSC" | "dynamical";

/**
 * Where each value of a system comes from.
 *
 * @example
 * ```ts
 * import { nearStarByName, type NearStarSources } from "@johnmorrisdotca/hoshi-stars/near-stars";
 *
 * const sources: NearStarSources = nearStarByName("Barnard's Star")!.sources;
 * console.log(sources.position, sources.distance, sources.magnitude);
 * ```
 */
export interface NearStarSources {
  /** The right ascension and declination: `"BSC"`, `"2MASS"` (a modern position) or `"GCTP"` (the Yale catalogue's own, carried to J2000). */
  position: NearStarSource;
  /** The parallax and the distance. */
  distance: NearStarDistanceSource;
  /** The spectral type, or `undefined` where there is none. */
  spectralType: NearStarSource | undefined;
  /** The V magnitude, or `undefined` where there is none. */
  magnitude: NearStarSource | undefined;
  /** The proper motion, or `undefined` where there is none. */
  properMotion: NearStarSource | undefined;
}

/**
 * What to be careful about for one system.
 *
 * @example
 * ```ts
 * import { nearStarByName, type NearStarFlags } from "@johnmorrisdotca/hoshi-stars/near-stars";
 *
 * const flags: NearStarFlags = nearStarByName("Lalande 21185")!.flags;
 * console.log(flags.coarsePosition);
 * ```
 */
export interface NearStarFlags {
  /** The position is the Yale catalogue's, carried from 1900 to 2000, not a 2MASS position: see `positionErrorArcsec`. */
  coarsePosition: boolean;
  /** The match to the source is not clear: the star may also be one of the bright stars, or several 2MASS sources fit it. */
  ambiguousMatch: boolean;
}

/**
 * One star of a system.
 *
 * @example
 * ```ts
 * import { nearStarByName, type NearStarMember } from "@johnmorrisdotca/hoshi-stars/near-stars";
 *
 * const sirius: readonly NearStarMember[] = nearStarByName("Sirius")!.members;
 * console.log(sirius.map((m) => `${m.name} ${m.spectralType}`));
 * ```
 */
export interface NearStarMember {
  /** The star's name (`Sirius B`, `Proxima Centauri`). */
  name: string;
  /** The name in Japanese where it has one, else `undefined`. */
  nameJa: string | undefined;
  /** `"primary"` for the star the system's values are the values of (the brightest, or the one the table names), else `"companion"`. */
  role: "primary" | "companion";
  /** Right ascension in degrees at J2000, or `undefined` for a companion the Yale tables do not hold (it is close beside the primary). */
  rightAscension: number | undefined;
  /** Declination in degrees at J2000, or `undefined` as above. */
  declination: number | undefined;
  /** The star's own distance in light-years, or `undefined` as above. */
  lightYears: number | undefined;
  /** The spectral type, or `undefined` where the source gives none. */
  spectralType: string | undefined;
  /** The luminosity class in `spectralType`, or `undefined` where it states none (a white dwarf is `D` only where the type starts with `D`). */
  luminosityClass: LuminosityClass | undefined;
  /** The V magnitude, or `undefined` where there is none. */
  magnitude: number | undefined;
  /** Where the star's values come from: `"typed"` for a published value typed into the package. */
  source: NearStarSource;
  /** A word about the star (`a white dwarf`, `a brown dwarf`), or `undefined`. */
  note: string | undefined;
}

/**
 * One star system within 20 light-years: a single star or a group, at a place on the sky, with its distance and where each value comes from. Positions are J2000.
 *
 * @example
 * ```ts
 * import { nearStarByName, type NearStar } from "@johnmorrisdotca/hoshi-stars/near-stars";
 *
 * const proxima: NearStar = nearStarByName("Proxima Centauri")!;
 * console.log(proxima.name, proxima.nameJa, proxima.lightYears.toFixed(2), proxima.sources.distance);
 * ```
 */
export interface NearStar {
  /** A key that stays the same: `alpha-centauri`, `barnards-star`. */
  id: string;
  /** The system's name (`Alpha Centauri`, `Barnard's Star`, `Wolf 359`). */
  name: string;
  /** The name in Japanese where known, else `undefined`. */
  nameJa: string | undefined;
  /** The Bayer letter and constellation, the catalogue's name or its number (`α Cen`, `L 726-8A`). */
  designation: string;
  /** Other names the sources give it, for `nearStarByName`. */
  aliases: readonly string[];
  /** The IAU three-letter constellation abbreviation the system lies in (`Cen`). */
  constellation: string;
  /** The number of stars in the system as published for the well-known multiples, at least: 3 for Alpha Centauri, 1 for a star with no known companion. */
  starsAtLeast: number;
  /** Right ascension of the primary star in degrees at J2000, 0 up to 360. */
  rightAscension: number;
  /** Declination of the primary star in degrees at J2000, -90 to 90. */
  declination: number;
  /** The error of the position in arc-seconds where the table gives one (2MASS and Yale positions), else `undefined`. */
  positionErrorArcsec: number | undefined;
  /** The annual parallax of the primary in milliarcseconds. */
  parallaxMas: number;
  /** The standard error of `parallaxMas`, or `undefined`. */
  parallaxErrorMas: number | undefined;
  /** The distance in light-years: 3,261.56 divided by the parallax in milliarcseconds. */
  lightYears: number;
  /** The error of `lightYears`, or `undefined`: the distance times the parallax's relative error. */
  lightYearsError: number | undefined;
  /** The spectral type of the primary, or `undefined` where the source gives none (LPP 731-58). */
  spectralType: string | undefined;
  /** The luminosity class in `spectralType`, or `undefined`. */
  luminosityClass: LuminosityClass | undefined;
  /** The V magnitude of the primary, or `undefined`. */
  magnitude: number | undefined;
  /** Proper motion in right ascension in milliarcseconds a year, already multiplied by cos(declination); 0 where there is none (`sources.properMotion` is then `undefined`). */
  properMotionRaMas: number;
  /** Proper motion in declination in milliarcseconds a year; 0 where there is none. */
  properMotionDecMas: number;
  /** The stars of the system, the primary first, then the companions the sources give; a companion typed in has no position of its own. */
  members: readonly NearStarMember[];
  /** What to be careful about. */
  flags: NearStarFlags;
  /** Where each value comes from. */
  sources: NearStarSources;
}

/**
 * The distance this table goes to, in light-years: a system whose primary is nearer than this, with its distance known to 10% or better, is in.
 *
 * @example
 * ```ts
 * import { NEAR_STAR_LIMIT_LY, nearStars } from "@johnmorrisdotca/hoshi-stars/near-stars";
 *
 * console.log(NEAR_STAR_LIMIT_LY, nearStars().every((s) => s.lightYears <= NEAR_STAR_LIMIT_LY));
 * ```
 */
export const NEAR_STAR_LIMIT_LY = 20;

const stored: NearStar[] = [];
const byText = new Map<string, NearStar>();
const key = (text: string): string => String(text).trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");

function member(row: NearStarMemberRow): NearStarMember {
  return Object.freeze({
    name: row.name, nameJa: row.nameJa, role: row.role, rightAscension: row.ra, declination: row.dec, lightYears: row.ly, spectralType: row.sp, luminosityClass: (row.sp === undefined ? undefined : luminosityClass(row.sp)), magnitude: row.mag, source: row.src, note: row.note,
  });
}

function build(row: NearStarRow): NearStar {
  return Object.freeze({
    id: row.id, name: row.name, nameJa: row.nameJa, designation: row.designation, aliases: Object.freeze([...row.aliases]), constellation: row.constellation, starsAtLeast: row.starsAtLeast,
    rightAscension: row.ra, declination: row.dec, positionErrorArcsec: row.posErr, parallaxMas: row.plx, parallaxErrorMas: row.plxErr, lightYears: row.ly, lightYearsError: row.lyErr,
    spectralType: row.sp, luminosityClass: (row.sp === undefined ? undefined : luminosityClass(row.sp)), magnitude: row.mag, properMotionRaMas: row.pm?.[0] ?? 0, properMotionDecMas: row.pm?.[1] ?? 0,
    members: Object.freeze(row.members.map(member)), flags: Object.freeze({ coarsePosition: row.flags.includes("coarse-position"), ambiguousMatch: row.flags.includes("ambiguous-match") }),
    sources: Object.freeze({ position: row.posSrc, distance: row.distSrc, spectralType: row.spSrc, magnitude: row.magSrc, properMotion: row.pmSrc }),
  });
}

function load(): void {
  if (stored.length > 0) return;
  for (const row of NEAR_STAR_ROWS) {
    const star = build(row);
    stored.push(star);
    const texts = [star.id, star.name, star.nameJa, star.designation, ...star.aliases, ...star.members.flatMap((m) => [m.name, m.nameJa])];
    for (const text of texts) if (text !== undefined && !byText.has(key(text))) byText.set(key(text), star);
  }
}

/**
 * The star systems within 20 light-years, nearest first: 73 of them, from Alpha Centauri at 4.3 to a faint red dwarf at 19.8. The primary star's distance is known to 10% or better.
 *
 * @param options - `maxLightYears`: only systems nearer than this (a system at exactly that distance is in).
 * @returns A fresh array of the shared, frozen systems.
 * @throws TypeError if `maxLightYears` is not a number.
 *
 * @example
 * ```ts
 * import { nearStars } from "@johnmorrisdotca/hoshi-stars/near-stars";
 *
 * console.log(nearStars().length, nearStars({ maxLightYears: 10 }).map((s) => s.name));
 * ```
 */
export function nearStars(options: { maxLightYears?: number } = {}): NearStar[] {
  load();
  const { maxLightYears } = options ?? {};
  if (maxLightYears !== undefined && (typeof maxLightYears !== "number" || Number.isNaN(maxLightYears))) throw new TypeError(`maxLightYears must be a number, got ${String(maxLightYears)}`);
  return stored.filter((s) => maxLightYears === undefined || s.lightYears <= maxLightYears);
}

/**
 * A system by a name, ignoring case and extra spaces: its name (`Proxima Centauri`, `Alpha Centauri`), its Japanese name, its designation or any name of its stars or the sources (`Rigil Kentaurus`, `Sirius B`, `GJ 876`).
 *
 * @param text - The name.
 * @returns The system, or `undefined`.
 *
 * @example
 * ```ts
 * import { nearStarByName } from "@johnmorrisdotca/hoshi-stars/near-stars";
 *
 * console.log(nearStarByName("Sirius B")?.name, nearStarByName("barnard's star")?.lightYears.toFixed(1));
 * ```
 */
export function nearStarByName(text: string): NearStar | undefined {
  load();
  return byText.get(key(text));
}
