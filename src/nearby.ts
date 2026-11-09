// The stars near the Sun that the 5,080 bright stars leave out: Proxima Centauri, Barnard's Star, Wolf 359 and the other red dwarfs, with a measured parallax and its error.
// The nearby tier (`@johnmorrisdotca/hoshi-stars/nearby`): about 5,600 more stars from the Yale General Catalogue of Trigonometric Stellar Parallaxes, with a modern position from 2MASS where one could be found. Nothing else imports it,
// so a page that never loads it pays nothing. Pure: no DOM, no clock, no state beyond the parsed table.
import { NEARBY_ROWS } from "./data/nearby.ts";

/**
 * Where a star's position comes from: a 2MASS source found for it (good to a fraction of an arc-second), or the Yale catalogue's own position (taken to J2000 from 1900, good to arc-seconds at best, an arc-minute at worst).
 *
 * @example
 * ```ts
 * import { nearbyStarByName, type NearbyPositionSource } from "@johnmorrisdotca/hoshi-stars/nearby";
 *
 * const source: NearbyPositionSource = nearbyStarByName("Proxima Centauri")!.positionSource;
 * console.log(source);
 * ```
 */
export type NearbyPositionSource = "2MASS" | "GCTP";

/**
 * The kind of a V magnitude in the Yale catalogue: a photoelectric V, a visual or other magnitude of lower accuracy, or a photographic blue one.
 *
 * @example
 * ```ts
 * import { nearbyStarByName, type NearbyMagnitudeKind } from "@johnmorrisdotca/hoshi-stars/nearby";
 *
 * const kind: NearbyMagnitudeKind | undefined = nearbyStarByName("Barnard's Star")!.magnitudeKind;
 * console.log(kind);
 * ```
 */
export type NearbyMagnitudeKind = "photoelectric" | "visual" | "blue";

/**
 * What to be careful about for one star.
 *
 * @example
 * ```ts
 * import { nearbyStarByName, type NearbyFlags } from "@johnmorrisdotca/hoshi-stars/nearby";
 *
 * const flags: NearbyFlags = nearbyStarByName("Proxima Centauri")!.flags;
 * console.log(flags.coarsePosition);
 * ```
 */
export interface NearbyFlags {
  /** The position is the Yale catalogue's, carried from 1900 to 2000, not a 2MASS position: see `positionErrorArcsec`. */
  coarsePosition: boolean;
  /** The parallax is 0 or less, so the star has no distance and a query by space leaves it out. */
  excludedFromSpace: boolean;
  /** The match is not clear: the star may also be one of the bright stars (a bright star lies within 30 arc-seconds), or several 2MASS sources fit it. */
  ambiguousMatch: boolean;
}

/**
 * One nearby star, as the Yale General Catalogue of Trigonometric Stellar Parallaxes gives it, with a 2MASS position where there is one. Positions are J2000 (the ICRS to a fraction of an arc-second).
 *
 * @example
 * ```ts
 * import { nearbyStarByName, type NearbyStar } from "@johnmorrisdotca/hoshi-stars/nearby";
 *
 * const proxima: NearbyStar = nearbyStarByName("Proxima Centauri")!;
 * console.log(proxima.lightYears?.toFixed(2), proxima.lightYearsError?.toFixed(2));
 * ```
 */
export interface NearbyStar {
  /** A key that stays the same: `gctp-` and the catalogue number (`gctp-3278`). */
  id: string;
  /** The common name for the few dozen well-known ones (`Proxima Centauri`), else `undefined`. */
  name: string | undefined;
  /** The Bayer letter or Flamsteed number and constellation (`ι Hor`, `33 Psc`) where the catalogue gives one, else `undefined`. */
  designation: string | undefined;
  /** The catalogue's other names for it: Luyten, Giclas, Ross, variable-star and Durchmusterung names (`G 158-027`, `CD-68 2378`). */
  aliases: readonly string[];
  /** The Yale catalogue number, as a text: `3278` for Proxima, `1810.10` for a component. */
  gctp: string;
  /** The Henry Draper number, or `undefined`. */
  hd: number | undefined;
  /** The Gliese-Jahreiss number as `GJ 551`, for the well-known ones, else `undefined`. */
  gliese: string | undefined;
  /** The 2MASS designation (`2MASS J14294291-6240465`) of the source the position comes from, or `undefined`. */
  twoMass: string | undefined;
  /** Right ascension in degrees at J2000, 0 up to 360. */
  rightAscension: number;
  /** Declination in degrees at J2000, -90 to 90. */
  declination: number;
  /** Where the position comes from. */
  positionSource: NearbyPositionSource;
  /** The error of the position in arc-seconds: 2MASS's own error plus the motion over the gap to 2000, or the catalogue's digits and a 3% error of its motion over a century. */
  positionErrorArcsec: number;
  /** For a 2MASS position, the arc-seconds between it and where the Yale position and motion put the star (the star is where 2MASS says); `undefined` for a Yale position. */
  gctpOffsetArcsec: number | undefined;
  /** The annual parallax in milliarcseconds; it can be 0 or less, because it is a measurement with an error. */
  parallaxMas: number;
  /** The standard error of the parallax in milliarcseconds, or `undefined`. */
  parallaxErrorMas: number | undefined;
  /** The distance in light-years (`3261.56 / parallax`), or `undefined` for a parallax of 0 or less. */
  lightYears: number | undefined;
  /** The error of `lightYears`: the distance times the parallax's relative error (a first-order figure, good while that is small), or `undefined`. */
  lightYearsError: number | undefined;
  /** The distance in parsecs, or `undefined`. */
  parsecs: number | undefined;
  /** The error of `parsecs`, or `undefined`. */
  parsecsError: number | undefined;
  /** The parallax's error divided by the parallax: 0.05 is 5%. `undefined` for a parallax of 0 or less or with no error. Under 0.05 is a good distance, 0.05 to 0.2 a fair one, over 0.2 a rough one. */
  relativeError: number | undefined;
  /** Proper motion in right ascension, in milliarcseconds a year, already multiplied by cos(declination); 0 where the catalogue has none (`properMotionSource` is then `undefined`). J2000 axes. */
  properMotionRaMas: number;
  /** Proper motion in declination, in milliarcseconds a year; 0 where the catalogue has none. */
  properMotionDecMas: number;
  /** Where the proper motion is from: `"GCTP"`, or `undefined` where there is none. */
  properMotionSource: "GCTP" | undefined;
  /** The V magnitude of the Yale catalogue, or `undefined`. */
  magnitude: number | undefined;
  /** What kind of magnitude it is, or `undefined` with no magnitude. */
  magnitudeKind: NearbyMagnitudeKind | undefined;
  /** Where the magnitude is from: `"GCTP"`, or `undefined` with no magnitude. */
  magnitudeSource: "GCTP" | undefined;
  /** The spectral type as the catalogue gives it (`M5.5eV`), or an empty string. */
  spectralType: string;
  /** What to be careful about. */
  flags: NearbyFlags;
}

const stored: NearbyStar[] = [];
const byText = new Map<string, NearbyStar>();

function load(): void {
  if (stored.length > 0) return;
  for (const row of NEARBY_ROWS.split("\n")) {
    const p = row.split("|");
    const gctp = p[0]!;
    const parallaxTenths = Number(p[10]);
    const parallaxMas = parallaxTenths / 10;
    const errorTenths = p[11] === "" ? undefined : Number(p[11]);
    const relativeError = parallaxTenths > 0 && errorTenths !== undefined ? errorTenths / parallaxTenths : undefined;
    const lightYears = parallaxTenths > 0 ? 3261.563777 / parallaxMas : undefined;
    const parsecs = parallaxTenths > 0 ? 1000 / parallaxMas : undefined;
    const motion = p[12] === "" ? undefined : p[12]!.split(",").map(Number);
    const kind = p[14] === "v" ? "photoelectric" : p[14] === "b" ? "blue" : p[14] === "l" ? "visual" : undefined;
    const flags = p[16]!;
    const star: NearbyStar = Object.freeze({
      id: `gctp-${gctp}`,
      name: p[2] === "" ? undefined : p[2],
      designation: p[3] === "" ? undefined : p[3],
      aliases: Object.freeze(p[4] === "" ? [] : p[4]!.split(";")),
      gctp,
      hd: p[1] === "" ? undefined : Number(p[1]),
      gliese: p[5] === "" ? undefined : `GJ ${p[5]}`,
      twoMass: p[6] === "" ? undefined : `2MASS J${p[6]}`,
      rightAscension: Number(p[7]) / 360000,
      declination: Number(p[8]) / 360000,
      positionSource: p[6] === "" ? "GCTP" : "2MASS",
      positionErrorArcsec: Number(p[9]) / 10,
      gctpOffsetArcsec: p[17] === "" ? undefined : Number(p[17]),
      parallaxMas,
      parallaxErrorMas: errorTenths === undefined ? undefined : errorTenths / 10,
      lightYears,
      lightYearsError: lightYears !== undefined && relativeError !== undefined ? lightYears * relativeError : undefined,
      parsecs,
      parsecsError: parsecs !== undefined && relativeError !== undefined ? parsecs * relativeError : undefined,
      relativeError,
      properMotionRaMas: motion?.[0] ?? 0,
      properMotionDecMas: motion?.[1] ?? 0,
      properMotionSource: motion === undefined ? undefined : "GCTP",
      magnitude: p[13] === "" ? undefined : Number(p[13]) / 100,
      magnitudeKind: kind,
      magnitudeSource: kind === undefined ? undefined : "GCTP",
      spectralType: p[15]!,
      flags: Object.freeze({ coarsePosition: flags.includes("c"), excludedFromSpace: flags.includes("x"), ambiguousMatch: flags.includes("a") }),
    });
    stored.push(star);
    const texts = [star.name, star.designation, ...star.aliases, star.gliese, star.hd === undefined ? undefined : `HD ${star.hd}`, `GCTP ${gctp}`, star.twoMass, star.twoMass?.slice(6)];
    for (const text of texts) if (text !== undefined) byText.set(text.toLowerCase(), star);
    if (star.gliese !== undefined) byText.set(`gliese ${star.gliese.slice(3)}`, star);
  }
}

/**
 * The nearby stars, nearest first (the ones with no distance last). They are the stars of the Yale parallax catalogue that the 5,080 bright stars do not hold, so a star is never in both lists.
 *
 * @param options - `magnitude`: the faintest V to include (a star of exactly that magnitude is in; a star with no magnitude is left out). `maxRelativeError`: only stars whose distance is known to this fraction or better (0.05 for under 5%, 0.2 for under 20%). `withDistance`: only stars with a distance.
 * @returns A fresh array of the shared, frozen stars.
 * @throws TypeError if an option is not a number (or a boolean for `withDistance`).
 *
 * @example
 * ```ts
 * import { nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";
 *
 * const close = nearbyStars({ maxRelativeError: 0.05 }).filter((star) => star.lightYears! < 20);
 * console.log(close.length > 50, close[0]?.name);
 * ```
 */
export function nearbyStars(options: { magnitude?: number; maxRelativeError?: number; withDistance?: boolean } = {}): NearbyStar[] {
  load();
  const { magnitude, maxRelativeError, withDistance } = options ?? {};
  for (const [name, value] of [["magnitude", magnitude], ["maxRelativeError", maxRelativeError]] as const) {
    if (value !== undefined && (typeof value !== "number" || Number.isNaN(value))) throw new TypeError(`${name} must be a number, got ${String(value)}`);
  }
  if (withDistance !== undefined && typeof withDistance !== "boolean") throw new TypeError(`withDistance must be true or false, got ${String(withDistance)}`);
  return stored.filter(
    (star) =>
      (magnitude === undefined || (star.magnitude !== undefined && star.magnitude <= magnitude)) &&
      (maxRelativeError === undefined || (star.relativeError !== undefined && star.relativeError <= maxRelativeError)) &&
      (withDistance !== true || star.lightYears !== undefined),
  );
}

/**
 * A nearby star by a name, ignoring case: its common name (`Proxima Centauri`), a name the catalogue gives it (`G 158-027`), its designation (`33 Psc`), `GJ 551` or `Gliese 551`, `HD 95735`, `GCTP 2576` or its 2MASS designation (with or without `2MASS J`).
 *
 * @param text - The name.
 * @returns The star, or `undefined`.
 *
 * @example
 * ```ts
 * import { nearbyStarByName } from "@johnmorrisdotca/hoshi-stars/nearby";
 *
 * console.log(nearbyStarByName("Barnard's Star")?.gliese, nearbyStarByName("HD 95735")?.name);
 * ```
 */
export function nearbyStarByName(text: string): NearbyStar | undefined {
  load();
  return byText.get(String(text).trim().toLowerCase());
}
