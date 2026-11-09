// The stars you can see without a telescope: the 5,080 of the Yale Bright Star Catalogue to visual magnitude 6.0, with their names, positions, proper motion, brightness and colour.
// The bright-star tier (`@johnmorrisdotca/hoshi-stars`): the table is about 100 kB gzipped and nothing else imports it. Pure: no DOM, no three.js, no state beyond the parsed table.
import { J2000_MS } from "./when.ts";
import { STAR_NAMES, STAR_ROWS } from "./data/stars.ts";
import { STAR_NAMES_JA } from "./data/star-names-ja.ts";
import { moment, type When } from "./when.ts";
import { luminosityClass, type LuminosityClass } from "./spectral.ts";

/**
 * One star, as the Yale Bright Star Catalogue gives it. Positions are J2000 (equator and equinox of 2000, the FK5 frame, which is the ICRS to a fraction of an arc-second).
 *
 * @example
 * ```ts
 * import { starByName, type Star } from "@johnmorrisdotca/hoshi-stars";
 *
 * const sirius: Star = starByName("Sirius")!;
 * console.log(sirius.designation, sirius.magnitude);
 * ```
 */
export interface Star {
  /** The Bright Star Catalogue (Harvard Revised) number: stable, and the key for `starByHr`. */
  hr: number;
  /** The common name where the star has one (the IAU Working Group on Star Names' spelling), else `undefined`. */
  name: string | undefined;
  /** The name in katakana (`シリウス`) for every star that has a `name`, else `undefined`. */
  nameJa: string | undefined;
  /** The Bayer letter and constellation (`α CMa`), else the Flamsteed number and constellation (`9 CMa`), else `undefined`. */
  designation: string | undefined;
  /** The IAU three-letter constellation abbreviation (`CMa`) the star lies in, for every star: the catalogue's where the star has a Bayer letter or Flamsteed number, else the one the boundaries give. */
  constellation: string;
  /** Right ascension in degrees at J2000, 0 up to 360. The catalogue gives it to a tenth of a second of time (1.5 arc-seconds at the equator). */
  rightAscension: number;
  /** Declination in degrees at J2000, -90 to 90. The catalogue gives it to an arc-second. */
  declination: number;
  /** Visual magnitude: smaller is brighter, and Sirius is -1.46. */
  magnitude: number;
  /** The colour index B-V in magnitudes, or `undefined` where the catalogue has none. Hot blue stars are about -0.3, the Sun 0.65, cool red stars above 1.5. */
  colourIndex: number | undefined;
  /** The spectral class and subclass (`A1`, `K1`), or an empty string where the catalogue gives none we read. The first two characters of `spectralType`. */
  spectralClass: string;
  /** The spectral type as the catalogue gives it, whole (`M1-2Ia-Iab` for Betelgeuse, `A0Va` for Vega, `K1.5IIIFe-0.5`); never empty for these 5,080. */
  spectralType: string;
  /** The luminosity class in `spectralType` (`Ia` for Betelgeuse, `V` for Sirius and Vega): a supergiant, giant or dwarf. The first class where a range is given; `undefined` where the type states none (`Am`, `K0`). */
  luminosityClass: LuminosityClass | undefined;
  /** Proper motion in right ascension, in milliarcseconds a year, already multiplied by cos(declination) (a true angle on the sky). */
  properMotionRaMas: number;
  /** Proper motion in declination, in milliarcseconds a year. */
  properMotionDecMas: number;
  /** The annual parallax in milliarcseconds, to a tenth where `parallaxSource` is `"GCTP"` and to a whole milliarcsecond otherwise; 0 where there is none (the distance is then unknown). */
  parallaxMas: number;
  /** The standard error of `parallaxMas` in milliarcseconds, or `undefined` where there is none: the Bright Star Catalogue states no error, so it is only given for a parallax from the Yale parallax catalogue. */
  parallaxErrorMas: number | undefined;
  /** Where the parallax is from: `"GCTP"` the Yale General Catalogue of Trigonometric Stellar Parallaxes (a measurement with an error), `"BSC"` the Bright Star Catalogue's trigonometric one, `"dynamical"` the Bright Star Catalogue's dynamical one (from the orbit of a binary); `undefined` where there is none. */
  parallaxSource: "GCTP" | "BSC" | "dynamical" | undefined;
}

/**
 * A star's distance with its uncertainty: what `starDistance` returns.
 *
 * @example
 * ```ts
 * import { starByName, starDistance, type StarDistance } from "@johnmorrisdotca/hoshi-stars";
 *
 * const distance: StarDistance | undefined = starDistance(starByName("Betelgeuse")!);
 * console.log(distance?.lightYearsRange);
 * ```
 */
export interface StarDistance {
  /** The distance in light-years: 3,261.56 divided by the parallax in milliarcseconds. */
  lightYears: number;
  /** The error of `lightYears`: the distance times the parallax's relative error (a first-order figure, good while that is small), or `undefined` where the parallax has no error. */
  lightYearsError: number | undefined;
  /** The nearest and the farthest the distance can be within one standard error of the parallax, or `undefined` where the parallax has no error. The farthest is `Infinity` where the error is as large as the parallax (the distance has no upper limit). */
  lightYearsRange: readonly [number, number] | undefined;
}

const SOURCES: Readonly<Record<string, Star["parallaxSource"]>> = { g: "GCTP", b: "BSC", d: "dynamical" };
const stored: Star[] = [];
const byHr = new Map<number, Star>();
const byText = new Map<string, Star>();

function load(): void {
  if (stored.length > 0) return;
  for (const row of STAR_ROWS.split("\n")) {
    const p = row.split("|");
    const hr = Number(p[0]);
    const letter = p[1]!;
    const flamsteed = p[2]!;
    const constellation = p[3]!;
    const designation = constellation === "" ? undefined : `${letter !== "" ? letter : flamsteed} ${constellation}`;
    const spectralType = p[10]!;
    const error = p[12] === "" ? undefined : Number(p[12]) / 10;
    const star: Star = Object.freeze({
      hr,
      name: STAR_NAMES[hr],
      nameJa: STAR_NAMES_JA[hr],
      designation: letter === "" && flamsteed === "" ? undefined : designation,
      constellation,
      rightAscension: (Number(p[4]) / 2400),
      declination: Number(p[5]) / 3600,
      magnitude: Number(p[8]) / 100,
      colourIndex: p[9] === "" ? undefined : Number(p[9]) / 100,
      spectralClass: /^\s*([OBAFGKMCRNS])\s*([0-9])?/.exec(spectralType)?.slice(1).join("") ?? "",
      spectralType,
      luminosityClass: luminosityClass(spectralType),
      properMotionRaMas: Number(p[6]),
      properMotionDecMas: Number(p[7]),
      parallaxMas: Number(p[11]) / 10,
      parallaxErrorMas: error,
      parallaxSource: SOURCES[p[13]!],
    });
    stored.push(star);
    byHr.set(hr, star);
    for (const text of [star.name, star.nameJa, star.designation]) if (text !== undefined) byText.set(text.toLowerCase(), star);
  }
}

/**
 * The stars to a magnitude, brightest first. The catalogue stops at magnitude 6.0, so the default is all 5,080.
 *
 * @param options - `magnitude`: the faintest to include (a star of exactly that magnitude is in). Brighter limits give shorter lists: 1 is 15 stars, 4 is 518, 5 is 1,630.
 * @returns A fresh array of the shared, frozen stars.
 *
 * @example
 * ```ts
 * import { stars } from "@johnmorrisdotca/hoshi-stars";
 *
 * console.log(stars().length, stars({ magnitude: 2 }).map((s) => s.name ?? s.designation).slice(0, 3));
 * ```
 */
export function stars(options: { magnitude?: number } = {}): Star[] {
  load();
  const limit = options.magnitude ?? Number.POSITIVE_INFINITY;
  if (typeof limit !== "number" || Number.isNaN(limit)) throw new TypeError(`magnitude must be a number, got ${String(limit)}`);
  return stored.filter((star) => star.magnitude <= limit);
}

/**
 * A star by its Bright Star Catalogue number.
 *
 * @param hr - The HR number (Sirius is 2491).
 * @returns The star, or `undefined` if that number is not in this table (the table holds the stars to magnitude 6.0 only).
 *
 * @example
 * ```ts
 * import { starByHr } from "@johnmorrisdotca/hoshi-stars";
 *
 * console.log(starByHr(2491)?.name);
 * ```
 */
export function starByHr(hr: number): Star | undefined {
  load();
  return byHr.get(hr);
}

/**
 * A star by its common name (`Sirius`), its name in katakana (`シリウス`) or its designation (`α CMa`, `9 CMa`), ignoring case.
 *
 * @param text - The name or designation.
 * @returns The star, or `undefined`.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 *
 * console.log(starByName("betelgeuse")?.designation, starByName("α Lyr")?.name, starByName("シリウス")?.hr);
 * ```
 */
export function starByName(text: string): Star | undefined {
  load();
  return byText.get(text.trim().toLowerCase());
}

const JULIAN_YEAR_MS = 365.25 * 86_400_000;

/**
 * Where a star is at a moment: its J2000 position carried forward (or back) by its proper motion in a straight line. The frame stays J2000, so precession to the date is not applied: use
 * the result with J2000 coordinates, or convert it to the date with `/coordinates`. A straight line is good to a fraction of an arc-second for centuries for nearly every star here; it is
 * not good for the few with large motion over millennia.
 *
 * @param star - A star, or anything with a J2000 position and a proper motion in milliarcseconds a year (a nearby star from `/nearby`).
 * @param when - The moment as a `Date` or milliseconds since 1970 (UTC); J2000 when left out.
 * @returns Right ascension and declination in degrees, J2000 frame, at that moment.
 *
 * @example
 * ```ts
 * import { starByName, starPosition } from "@johnmorrisdotca/hoshi-stars";
 *
 * const now = starPosition(starByName("Arcturus")!, Date.UTC(2026, 10, 7));
 * console.log(now.declination.toFixed(3));
 * ```
 */
export function starPosition(star: Pick<Star, "rightAscension" | "declination" | "properMotionRaMas" | "properMotionDecMas">, when?: When): { rightAscension: number; declination: number } {
  const years = (moment(when ?? J2000_MS) - J2000_MS) / JULIAN_YEAR_MS;
  const declination = star.declination + (star.properMotionDecMas * years) / 3_600_000;
  const cosine = Math.cos((star.declination * Math.PI) / 180);
  // The motion is a true angle on the sky: it stretches by 1 / cos(declination) in right ascension. At the poles the division is kept finite.
  const rightAscension = star.rightAscension + (star.properMotionRaMas * years) / 3_600_000 / Math.max(Math.abs(cosine), 1e-6);
  return { rightAscension: ((rightAscension % 360) + 360) % 360, declination: Math.max(-90, Math.min(90, declination)) };
}

/**
 * A star's distance from its parallax, in light-years. `starDistance` gives the uncertainty with it.
 *
 * @param star - A star.
 * @returns Light-years, or `undefined` where the catalogue has no parallax (or a non-positive one).
 *
 * @example
 * ```ts
 * import { starByName, starDistanceLightYears } from "@johnmorrisdotca/hoshi-stars";
 *
 * console.log(starDistanceLightYears(starByName("Sirius")!)?.toFixed(1));
 * ```
 */
export function starDistanceLightYears(star: Star): number | undefined {
  return star.parallaxMas > 0 ? 3261.563777 / star.parallaxMas : undefined;
}

/**
 * A star's distance with its uncertainty, from the parallax and its error. Sirius is 8.5 light-years, to within 0.05; Betelgeuse's parallax is 9.8 milliarcseconds with an error of 4.7, so its distance is anywhere from 225 to 640 light-years.
 *
 * @param star - A star, or anything with a parallax in milliarcseconds and its error (a nearby star from `/nearby`).
 * @returns The distance, its error and its range in light-years, or `undefined` where there is no parallax (or a non-positive one).
 *
 * @example
 * ```ts
 * import { starByName, starDistance } from "@johnmorrisdotca/hoshi-stars";
 *
 * const sirius = starDistance(starByName("Sirius")!)!;
 * console.log(sirius.lightYears.toFixed(2), sirius.lightYearsError?.toFixed(2), sirius.lightYearsRange?.map((ly) => ly.toFixed(2)));
 * ```
 */
export function starDistance(star: Pick<Star, "parallaxMas" | "parallaxErrorMas">): StarDistance | undefined {
  const { parallaxMas: parallax, parallaxErrorMas: error } = star;
  if (!(parallax > 0)) return undefined;
  const lightYears = 3261.563777 / parallax;
  if (error === undefined) return { lightYears, lightYearsError: undefined, lightYearsRange: undefined };
  return { lightYears, lightYearsError: (lightYears * error) / parallax, lightYearsRange: [3261.563777 / (parallax + error), error < parallax ? 3261.563777 / (parallax - error) : Number.POSITIVE_INFINITY] };
}

/**
 * The surface temperature a colour index implies, in kelvin, by Ballesteros's relation between B-V and a black body. It is an estimate to a few hundred kelvin for most stars, and it runs cool for the hottest (about 16,600 K at -0.3).
 *
 * @param colourIndex - B-V in magnitudes.
 * @returns Kelvin.
 *
 * @example
 * ```ts
 * import { starTemperatureK } from "@johnmorrisdotca/hoshi-stars";
 *
 * console.log(Math.round(starTemperatureK(0.65)));
 * ```
 */
export function starTemperatureK(colourIndex: number): number {
  if (!Number.isFinite(colourIndex)) throw new RangeError(`colourIndex must be a finite number, got ${colourIndex}`);
  return 4600 * (1 / (0.92 * colourIndex + 1.7) + 1 / (0.92 * colourIndex + 0.62));
}

/**
 * The colour of a black body at a temperature, as a `#rrggbb` string, for drawing a star. It is the colour a camera would show, not a measurement, and it uses an approximation of the
 * black-body locus (good to a few percent between 1,000 and 40,000 K).
 *
 * @param kelvin - Temperature in kelvin.
 * @returns A colour like `#a4bdff`.
 *
 * @example
 * ```ts
 * import { blackBodyColour } from "@johnmorrisdotca/hoshi-stars";
 *
 * console.log(blackBodyColour(10000), blackBodyColour(3500));
 * ```
 */
export function blackBodyColour(kelvin: number): string {
  if (!Number.isFinite(kelvin) || kelvin <= 0) throw new RangeError(`kelvin must be a positive number, got ${kelvin}`);
  const t = Math.min(40_000, Math.max(1_000, kelvin)) / 100;
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const byte = (v: number): string => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${byte(red)}${byte(green)}${byte(blue)}`;
}

/**
 * The colour to draw a star: from its B-V index, or a plain white where the catalogue has none.
 *
 * @param star - A star.
 * @returns A `#rrggbb` string.
 *
 * @example
 * ```ts
 * import { starByName, starColour } from "@johnmorrisdotca/hoshi-stars";
 *
 * console.log(starColour(starByName("Betelgeuse")!), starColour(starByName("Rigel")!));
 * ```
 */
export function starColour(star: Star): string {
  return star.colourIndex === undefined ? "#ffffff" : blackBodyColour(starTemperatureK(star.colourIndex));
}
