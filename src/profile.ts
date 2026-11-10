// A star's physical profile: temperature, luminosity, size, angular size and limb darkening, worked out from what the catalogue holds (V magnitude, B-V, spectral type, parallax) with
// the uncertainty each step adds. The `/profile` entry point: it pulls in a few kilobytes of published tables and not the star table, so a page that draws one star pays for one star.
// Pure: no DOM, no clock, no randomness, no state beyond the parsed tables. Sources, their terms and the day each was read: NOTICE.md, "Stellar profiles".
import { blackBodyColour, starTemperatureK } from "./colour.ts";
import type { LuminosityClass } from "./spectral.ts";
import { COOL_BC_ROWS, DWARF_ROWS, LIMB_ROWS, SUPERGIANT_ROWS } from "./data/profile-tables.ts";
import { ROTATION_ROWS } from "./data/rotation.ts";
import type { Star } from "./stars.ts";

/**
 * A number with its uncertainty: the value, one standard error of it, and the range that error spans.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starProfile, type Estimate } from "@johnmorrisdotca/hoshi-stars/profile";
 *
 * const radius: Estimate | undefined = starProfile(starByName("Vega")!).radius;
 * console.log(radius?.value, radius?.error, radius?.range);
 * ```
 */
export interface Estimate {
  /** The best figure. */
  value: number;
  /** One standard error, in the unit of `value`. First-order: it is the value times the combined relative error. */
  error: number;
  /** The nearest and the farthest one standard error allows. The upper end is `Infinity` where the parallax's own error is as large as the parallax (the star could be any distance beyond a point). */
  range: readonly [number, number];
}

/**
 * How the temperature was found: `"spectral type"` from a published temperature scale for the star's type and luminosity class, or `"colour"` from its B-V colour index (a rougher guide, and the only one for a star
 * whose type is odd or whose class is not stated).
 *
 * @example
 * ```ts
 * import type { TemperatureBasis } from "@johnmorrisdotca/hoshi-stars/profile";
 *
 * const basis: TemperatureBasis = "spectral type";
 * console.log(basis);
 * ```
 */
export type TemperatureBasis = "spectral type" | "colour" | "spectral type and colour";

/**
 * Where the radius comes from: `"parallax"` is worked out for this star from its distance, brightness and temperature; `"type"` is the typical radius of stars of its spectral type, used when the star's own
 * distance is missing or too uncertain to beat it.
 *
 * @example
 * ```ts
 * import type { RadiusBasis } from "@johnmorrisdotca/hoshi-stars/profile";
 *
 * const basis: RadiusBasis = "parallax";
 * console.log(basis);
 * ```
 */
export type RadiusBasis = "parallax" | "type";

/**
 * Why a figure in a profile could not be worked out, so a page can say it plainly: `"no-colour-or-type"` the catalogue gives no colour and no usable type, `"no-parallax"` no parallax, `"poor-parallax"` a parallax whose error is
 * half of it or more, `"implausible-parallax"` a parallax that gives a size no star of that kind has, `"no-typical-radius"` no typical size is published for the type, `"no-class"` no luminosity class, `"odd-type"` a type
 * the scales do not cover (carbon, S, Wolf-Rayet, white dwarf).
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starProfile, type Unknown } from "@johnmorrisdotca/hoshi-stars/profile";
 *
 * const why: Unknown | undefined = starProfile(starByName("Deneb")!).unknown.radius;
 * console.log(why);
 * ```
 */
export type Unknown = "no-colour-or-type" | "no-parallax" | "poor-parallax" | "implausible-parallax" | "no-typical-radius" | "no-class" | "odd-type";

/**
 * The shape of a star that was measured and is not a ball: Altair and Regulus are flattened by their spin, and Vega is seen from over its pole. Every number is a published measurement, named in `source`.
 *
 * @example
 * ```ts
 * import { starShape, type StarShape } from "@johnmorrisdotca/hoshi-stars/profile";
 *
 * const altair: StarShape | undefined = starShape(7557);
 * console.log(altair?.equatorialRadius, altair?.polarRadius, altair?.source);
 * ```
 */
export interface StarShape {
  /** `"oblate"`: flattened by its spin and seen well off the pole; `"pole-on"`: spinning fast and seen almost along its axis, so it looks round. */
  kind: "oblate" | "pole-on";
  /** The equatorial radius in solar radii. */
  equatorialRadius: number;
  /** The polar radius in solar radii. */
  polarRadius: number;
  /** The temperature at the poles in kelvin (the poles are hotter: gravity darkening). */
  polarTemperatureK: number;
  /** The temperature at the equator in kelvin. */
  equatorialTemperatureK: number;
  /** The angle between the spin axis and the line of sight, in degrees: 0 is pole-on, 90 edge-on. */
  inclinationDegrees: number;
  /** The direction of the spin axis on the sky, in degrees from north through east. */
  positionAngleDegrees: number;
  /** The spin period in days where the source gives one. */
  rotationPeriodDays: number | undefined;
  /** The published measurement the numbers are from. */
  source: string;
}

/**
 * How fast a star spins, as the Bright Star Catalogue gives it: the projected speed of its equator, v sin i. The true speed is that or more (the tilt of the axis is not known from it).
 *
 * @example
 * ```ts
 * import { starRotation, type StarRotation } from "@johnmorrisdotca/hoshi-stars/profile";
 *
 * const phecda: StarRotation | undefined = starRotation(4554);
 * console.log(phecda?.vSinIKmS, phecda?.upperLimit);
 * ```
 */
export interface StarRotation {
  /** v sin i in kilometres a second. */
  vSinIKmS: number;
  /** The catalogue gives it as an upper limit (`<`): the star spins at most this fast across the line of sight. */
  upperLimit: boolean;
  /** The catalogue marks it uncertain (`:`). */
  uncertain: boolean;
}

/**
 * What the catalogue and the published tables say about one star's body.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starProfile, type StarProfile } from "@johnmorrisdotca/hoshi-stars/profile";
 *
 * const profile: StarProfile = starProfile(starByName("Vega")!);
 * console.log(profile.temperature?.value, profile.limbDarkening);
 * ```
 */
export interface StarProfile {
  /** The Bright Star Catalogue number the profile was made for, or `undefined` for something else (the Sun). */
  hr: number | undefined;
  /** The surface (effective) temperature in kelvin, or `undefined` where the colour and type give none. */
  temperature: (Estimate & { basis: TemperatureBasis }) | undefined;
  /** The colour of a black body at that temperature, `#rrggbb`: for drawing the star. `undefined` where the temperature is. */
  colour: string | undefined;
  /** The luminosity in solar luminosities, from the magnitude, the distance and a bolometric correction. `undefined` where there is no distance. */
  luminosity: Estimate | undefined;
  /** The radius in solar radii (`R = sqrt(L) / T²` in solar units), or `undefined` where neither the distance nor the type gives one. */
  radius: (Estimate & { basis: RadiusBasis }) | undefined;
  /**
   * The apparent width of the disc in milliarcseconds (limb-darkened), from the magnitude and temperature alone: it needs no distance, so it is known for every star with a temperature, and it is what
   * an interferometer measures.
   */
  angularDiameterMas: Estimate | undefined;
  /** The linear limb-darkening coefficient in the V band, 0 (a flat disc) to 1 (the edge is dark): `I(μ) = 1 − u(1 − μ)`. From model atmospheres for the temperature and the class's surface gravity. */
  limbDarkening: number | undefined;
  /** Published shape measurements, for the few stars that have them. */
  shape: StarShape | undefined;
  /** The catalogue's projected rotation speed, for the stars it gives one (about 2,800 of the 5,080). */
  rotation: StarRotation | undefined;
  /** The luminosity class the figures assumed, which may differ from the catalogue's where it states none. */
  luminosityClass: LuminosityClass | undefined;
  /** The spectral type was a pair (`K0III+A0V`): the brightness is of both and the figures are the primary's, rough. */
  composite: boolean;
  /** What could not be worked out, and why. Empty for a star with everything. */
  unknown: Partial<Record<"temperature" | "luminosity" | "radius", Unknown>>;
}

/**
 * What `starProfile` reads of a star: a `Star` has all of it, and so does anything built by hand (the Sun).
 *
 * @example
 * ```ts
 * import { starProfile, type ProfileInput } from "@johnmorrisdotca/hoshi-stars/profile";
 *
 * const sun: ProfileInput = { magnitude: -26.74, colourIndex: 0.65, spectralType: "G2V", luminosityClass: "V", parallaxMas: 206_264_806.2, parallaxErrorMas: 1, parallaxSource: "GCTP" };
 * console.log(starProfile(sun).radius?.value.toFixed(2));
 * ```
 */
export type ProfileInput = Pick<Star, "magnitude" | "colourIndex" | "spectralType" | "luminosityClass" | "parallaxMas" | "parallaxErrorMas" | "parallaxSource"> & { hr?: number | undefined };

// ----- the nominal solar values (IAU 2015 resolutions B2 and B3) and the unit conversions -----
const SUN_TEMPERATURE_K = 5772;
const SUN_APPARENT_BOLOMETRIC = -26.832;
const AU_IN_SOLAR_RADII = 215.032;
const AU_PER_PARSEC_MAS = 206_264_806.247;
const LN10 = Math.LN10;

// ----- the tables -----
interface DwarfRow { index: number; teff: number; bc: number; radius: number; colour: number | undefined }
interface Rows { dwarf: DwarfRow[]; supergiant: { index: number; teff: number; bc: number }[]; coolBc: [number, number][]; limb: { teff: number; u: number[] }[] }
let tables: Rows | undefined;
function load(): Rows {
  if (tables !== undefined) return tables;
  const split = (text: string): number[][] => text.split("\n").map((line) => line.split("|").map(Number));
  tables = {
    dwarf: DWARF_ROWS.split("\n").map((line) => { const [index, teff, bc, radius, colour] = line.split("|"); return { index: Number(index), teff: Number(teff), bc: Number(bc), radius: Number(radius), colour: colour === "" || colour === undefined ? undefined : Number(colour) }; }),
    supergiant: split(SUPERGIANT_ROWS).map(([index, teff, bc]) => ({ index: index!, teff: teff!, bc: bc! })),
    coolBc: split(COOL_BC_ROWS).map(([teff, bc]) => [teff!, bc!] as [number, number]),
    limb: split(LIMB_ROWS).map(([teff, ...u]) => ({ teff: teff!, u })),
  };
  return tables;
}

/** Linear interpolation through points sorted by x, held flat beyond the ends. */
function through(points: readonly (readonly [number, number])[], x: number): number {
  if (x <= points[0]![0]) return points[0]![1];
  const last = points[points.length - 1]!;
  if (x >= last[0]) return last[1];
  let i = 1;
  while (points[i]![0] < x) i++;
  const [x0, y0] = points[i - 1]!;
  const [x1, y1] = points[i]!;
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

// ----- the spectral type -----
const LETTERS = "OBAFGKM";
interface Parsed { letter: string; sub: number | undefined; composite: boolean }

/** The letter and subtype of the first star in a spectral type: `M1-2Ia-Iab` is M and 1.5, `gK2` is K and 2, `K0III+A0V` is K and 0 of a pair. */
function parse(spectralType: string): Parsed {
  const composite = /\+\s*(?:sd|g|d|c)?[OBAFGKMWCNRS]/.test(spectralType);
  const first = spectralType.split("+")[0]!.trim();
  const body = first.replace(/^(sd|sg|g|d|c)(?=[A-Z])/, "");
  const m = /^([A-Z])(?:(\d+(?:\.\d+)?)(?:[-/](\d+(?:\.\d+)?))?)?/.exec(body);
  if (m === null) return { letter: "", sub: undefined, composite };
  const a = m[2] === undefined ? undefined : Number(m[2]);
  const b = m[3] === undefined ? undefined : Number(m[3]);
  return { letter: m[1]!, sub: a === undefined ? undefined : b === undefined || b <= a ? a : (a + b) / 2, composite };
}

/** A position on one scale for the dwarf tables: O is 0, B 10, A 20, F 30, G 40, K 50, M 60, plus the subtype (K5 is 55, M0 is 60). */
const scaleIndex = (letter: string, sub: number): number => LETTERS.indexOf(letter) * 10 + sub;

/** A position on the scale of van Belle et al. (2021) for giants: G0 is 50, K0 60, K5 65, M0 66 (so the K types run K0 to K5, then M0). */
function giantIndex(letter: string, sub: number): number {
  if (letter === "G") return 50 + sub;
  if (letter === "K") return sub <= 5 ? 60 + sub : 65 + (sub - 5) / 5;
  return 66 + sub;
}

// ----- the temperature scales -----
/** A temperature with its absolute standard error and where it came from. */
interface Scale { teff: number; sigma: number; basis: TemperatureBasis }
type Family = "dwarf" | "evolved";
interface Chosen extends Scale { family: Family }

/** The dwarf sequence of Mamajek (Pecaut and Mamajek 2013): temperature at a position on the O0..M9 scale, and its change per subtype. */
function dwarfTemperature(index: number): { teff: number; slope: number } {
  const points = load().dwarf.map((r) => [r.index, r.teff] as const);
  return { teff: through(points, index), slope: Math.abs(through(points, index + 0.5) - through(points, index - 0.5)) };
}

/** The same sequence read the other way: the temperature of a dwarf of a B-V colour, and its change per magnitude of colour. */
function dwarfTemperatureOfColour(colour: number): { teff: number; slope: number } {
  const points = load().dwarf.filter((r) => r.colour !== undefined).map((r) => [r.colour!, r.teff] as const);
  return { teff: through(points, colour), slope: Math.abs(through(points, colour + 0.05) - through(points, colour - 0.05)) / 0.1 };
}

/** Giants G0 to M8 from the fits of van Belle et al. (2021, Table 8): temperature and change per subtype at a position on their scale. */
function giantTemperature(s: number): { teff: number; slope: number } {
  const t = (x: number): number => (x < 61 ? 7856 - 52.74 * x : x < 64 ? 16751 - 199.41 * x : x <= 71.5 ? 9491 - 85.98 * x : x < 72 ? 3343 + ((3134 - 3343) * (x - 71.5)) / 0.5 : 3134);
  return { teff: t(s), slope: Math.abs(t(s + 0.5) - t(s - 0.5)) };
}

/** Red supergiants K1.5 to M5 from Levesque et al. (2005, Table 5). */
function supergiantTemperature(index: number): { teff: number; slope: number } {
  const points = load().supergiant.map((r) => [r.index, r.teff] as const);
  return { teff: through(points, index), slope: Math.abs(through(points, index + 0.5) - through(points, index - 0.5)) };
}

/** The temperature and its error: from a published scale for the type where one fits the class (the colour joins it for a dwarf), else from the colour alone, else nothing. */
function chooseTemperature(input: ProfileInput, parsed: Parsed, cls: LuminosityClass | undefined): Chosen | undefined {
  const { letter } = parsed;
  const standard = letter !== "" && LETTERS.includes(letter);
  const colourIndex = input.colourIndex;
  const subtype = parsed.sub ?? 5;
  // A type is good to about a subtype; to two and a half where the catalogue gives only the letter.
  const subError = parsed.sub === undefined ? 2.5 : 0.7;
  const typed = (scale: { teff: number; slope: number }, floor: number, family: Family): Chosen => ({ teff: scale.teff, sigma: Math.hypot(scale.slope * subError, floor * scale.teff), basis: "spectral type", family });
  const coloured = (floor: number, family: Family): Chosen | undefined => {
    if (colourIndex === undefined) return undefined;
    const teff = starTemperatureK(colourIndex);
    return { teff, sigma: floor * teff, basis: "colour", family };
  };
  if (!standard) return coloured(0.15, "evolved");
  const dwarfScale = dwarfTemperature(scaleIndex(letter, subtype));
  if (cls === "V" || cls === "VI" || cls === "IV" || cls === undefined) {
    // A dwarf: its type and its colour each say the temperature; the two together say it better. Where no class is stated the colour leads, since a type of "K0" could be a dwarf or a giant.
    const family: Family = "dwarf";
    const type = typed(dwarfScale, cls === "IV" ? 0.05 : 0.035, family);
    if (cls === undefined && colourIndex === undefined) return { ...typed(dwarfScale, 0.06, family) };
    if (colourIndex === undefined) return type;
    const colour = dwarfTemperatureOfColour(colourIndex);
    const colourSigma = Math.hypot(colour.slope * 0.03, 0.02 * colour.teff);
    if (cls === undefined) {
      const rough = coloured(0.05, family)!;
      return rough;
    }
    const wType = 1 / type.sigma ** 2;
    const wColour = 1 / colourSigma ** 2;
    return { teff: (type.teff * wType + colour.teff * wColour) / (wType + wColour), sigma: Math.max(1 / Math.sqrt(wType + wColour), type.sigma), basis: "spectral type and colour", family };
  }
  if (cls === "III" || cls === "II") {
    if ("GKM".includes(letter)) return typed(giantTemperature(giantIndex(letter, subtype)), cls === "II" ? 0.05 : 0.02, "evolved");
    return typed(dwarfScale, 0.05, "evolved");
  }
  // A supergiant (Ia, Iab, Ib, I).
  if (letter === "M" || (letter === "K" && subtype >= 1)) return typed(supergiantTemperature(scaleIndex(letter, subtype)), 0.05, "evolved");
  if (letter === "O" || letter === "B" || colourIndex === undefined) return typed(dwarfScale, 0.1, "evolved");
  return coloured(0.07, "evolved");
}

// ----- the bolometric correction -----
/** Flower's (1996) polynomial in log Teff, with the coefficients Torres (2010, Table 1) re-printed correctly: BC_V of the temperature, for the stars that are not dwarfs. */
function flowerBc(teff: number): number {
  const x = Math.log10(Math.min(Math.max(teff, 4300), 44_000));
  const [a, b, c, d, e, f] =
    x < 3.7
      ? [-0.190537291496456e5, 0.155144866764412e5, -0.421278819301717e4, 0.381476328422343e3, 0, 0]
      : x < 3.9
        ? [-0.370510203809015e5, 0.385672629965804e5, -0.150651486316025e5, 0.261724637119416e4, -0.170623810323864e3, 0]
        : [-0.118115450538963e6, 0.137145973583929e6, -0.636233812100225e5, 0.147412923562646e5, -0.170587278406872e4, 0.78873172180499e2];
  return a! + x * (b! + x * (c! + x * (d! + x * (e! + x * f!))));
}

interface Correction { bc: number; error: number }

/** BC_V and its uncertainty at a temperature for a family of stars: Mamajek's table for dwarfs; Flower/Torres above 4,300 K and the MARCS models of Levesque et al. below, for the rest. */
function bolometricCorrection(teff: number, family: Family, supergiant = false): Correction {
  const { dwarf, coolBc } = load();
  if (family === "dwarf") {
    const points = dwarf.map((r) => [r.teff, r.bc] as const).sort((p, q) => p[0] - q[0]);
    return { bc: through(points, teff), error: teff < 3300 ? 0.25 : teff > 25_000 ? 0.15 : 0.05 };
  }
  if (teff >= 4300) return { bc: flowerBc(teff), error: teff > 20_000 ? 0.2 : teff > 8000 ? 0.1 : 0.06 };
  const T = Math.max(teff, 2800);
  const bc = T >= 3200 ? through(coolBc, T) : coolBc[0]![1] + ((coolBc[1]![1] - coolBc[0]![1]) * (T - 3200)) / (coolBc[1]![0] - coolBc[0]![0]);
  // The bolometric correction of a cool supergiant is poorly known (Betelgeuse and Antares sit about 0.7 mag below the red-supergiant table, their light being split by dust and molecules).
  return { bc, error: supergiant ? 0.5 : teff < 3500 ? 0.3 : 0.15 };
}

// ----- limb darkening -----
const GRAVITY_COLUMN: Record<LuminosityClass, number> = { Ia: 0, Iab: 0, Ib: 0, I: 0, II: 1, III: 1, IV: 2, V: 3, VI: 3, D: 3 };

function limbCoefficient(teff: number, cls: LuminosityClass | undefined): number {
  const column = GRAVITY_COLUMN[cls ?? "V"];
  const rows = load().limb;
  return through(rows.map((r) => [r.teff, r.u[column]!] as const), teff);
}

// ----- typical radius by type -----
function typicalRadius(parsed: Parsed, cls: LuminosityClass | undefined): { radius: number; relative: number } | undefined {
  if (!LETTERS.includes(parsed.letter) || parsed.letter === "") return undefined;
  const sub = parsed.sub ?? 5;
  if (cls === "V" || cls === "VI") {
    const rows = load().dwarf;
    // Hot dwarfs of one type differ widely in size (they swell as they age); the cooler ones barely do.
    return { radius: through(rows.map((r) => [r.index, r.radius] as const), scaleIndex(parsed.letter, sub)), relative: "OBAF".includes(parsed.letter) ? 0.3 : 0.15 };
  }
  if (cls === "III" && "GKM".includes(parsed.letter)) {
    const s = giantIndex(parsed.letter, sub);
    return { radius: s < 60 ? 0.16 * s + 1.41 : s <= 65 ? 7.39 * s - 432.9 : 11.11 * s - 678.55, relative: 0.2 };
  }
  return undefined;
}

// ----- measured shapes -----
const SHAPES: Readonly<Record<number, StarShape>> = {
  // Altair: Monnier et al. 2007, Science 317, 342, Table 1, model with the gravity-darkening coefficient free.
  7557: { kind: "oblate", equatorialRadius: 2.029, polarRadius: 1.634, polarTemperatureK: 8450, equatorialTemperatureK: 6860, inclinationDegrees: 57.2, positionAngleDegrees: -61.8, rotationPeriodDays: undefined, source: "Monnier et al. 2007, Science 317, 342 (CHARA)" },
  // Regulus: McAlister et al. 2005, ApJ 628, 439, Table 5 (and the text for the period).
  3982: { kind: "oblate", equatorialRadius: 4.16, polarRadius: 3.14, polarTemperatureK: 15_400, equatorialTemperatureK: 10_314, inclinationDegrees: 90, positionAngleDegrees: 85.5, rotationPeriodDays: 15.9 / 24, source: "McAlister et al. 2005, ApJ 628, 439 (CHARA)" },
  // Vega: Monnier et al. 2012, ApJ 761, L3, Table 2, the "concordance" model.
  7001: { kind: "pole-on", equatorialRadius: 2.726, polarRadius: 2.418, polarTemperatureK: 10_070, equatorialTemperatureK: 8910, inclinationDegrees: 6.2, positionAngleDegrees: -58, rotationPeriodDays: 0.71, source: "Monnier et al. 2012, ApJ 761, L3 (CHARA/MIRC)" },
};

/**
 * The published shape measurement of a star, if it has one: Altair (HR 7557) and Regulus (HR 3982) are flattened by their spin, Vega (HR 7001) is seen nearly pole-on. Others return `undefined`.
 *
 * @param hr - The Bright Star Catalogue number.
 * @returns The measured shape, or `undefined`.
 *
 * @example
 * ```ts
 * import { starShape } from "@johnmorrisdotca/hoshi-stars/profile";
 *
 * console.log(starShape(3982)?.equatorialRadius, starShape(2491));
 * ```
 */
export function starShape(hr: number): StarShape | undefined {
  return SHAPES[hr];
}

let rotations: Map<number, StarRotation> | undefined;

/**
 * The Bright Star Catalogue's projected rotation speed (v sin i) of a star, if it gives one.
 *
 * @param hr - The Bright Star Catalogue number.
 * @returns The speed with the catalogue's flags, or `undefined`.
 *
 * @example
 * ```ts
 * import { starRotation } from "@johnmorrisdotca/hoshi-stars/profile";
 *
 * console.log(starRotation(7557)?.vSinIKmS, starRotation(2061));
 * ```
 */
export function starRotation(hr: number): StarRotation | undefined {
  if (rotations === undefined) {
    rotations = new Map();
    for (const row of ROTATION_ROWS.split("\n")) {
      const [id, speed, flag] = row.split("|");
      rotations.set(Number(id), { vSinIKmS: Number(speed), upperLimit: flag === "<", uncertain: flag === ":" });
    }
  }
  return rotations.get(hr);
}

// ----- the profile -----
const ln = Math.log;

/** Photometric floor on the V magnitude, with a larger one for the stars that vary: red and supergiant stars change by tenths of a magnitude. */
function magnitudeError(parsed: Parsed, cls: LuminosityClass | undefined, composite: boolean): number {
  const variable = cls === "Ia" || cls === "Iab" || cls === "Ib" || cls === "I" || parsed.letter === "M" || parsed.letter === "S" || parsed.letter === "C";
  const base = variable ? 0.15 : cls === "III" && parsed.letter === "K" ? 0.05 : 0.03;
  return composite ? Math.hypot(base, 0.3) : base;
}

/**
 * A star's profile: how hot, how big, how bright, and how dark its edge. The temperature comes from a published scale for its spectral type and luminosity class (or its colour), the luminosity from its
 * brightness, distance and a bolometric correction, the radius from `R = sqrt(L) / T²` in solar units, and every figure carries its uncertainty. The error of each step is added: the parallax's own error (as the
 * catalogue gives it: a whole milliarcsecond for the Bright Star Catalogue's own parallaxes, 5% for dynamical ones), the temperature scale's scatter and the star's subtype, the bolometric correction, the
 * V magnitude (0.03 mag, more for variable and composite stars), and a guess at unseen dimming by dust (0.3 mag a kiloparsec). The magnitude and colour are not corrected for that dust: a distant star reads a little too faint and too red.
 *
 * The apparent size of the disc needs no distance, so it is known for every star with a temperature. The radius needs a distance, or falls back on the typical radius of stars of the same type (`basis: "type"`) where
 * the distance is missing or poorer than that. Where neither works the figure is `undefined` and `unknown` says why. Nothing is guessed silently.
 *
 * @param star - A star, or anything with the same fields (build the Sun from its magnitude -26.74 and parallax 206,264,806 mas).
 * @returns The profile.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";
 *
 * const sirius = starProfile(starByName("Sirius")!);
 * console.log(sirius.radius?.value.toFixed(2), sirius.radius?.range.map((r) => r.toFixed(2)), sirius.temperature?.value);
 * ```
 */
export function starProfile(star: ProfileInput): StarProfile {
  const parsed = parse(star.spectralType);
  const cls = star.luminosityClass ?? (/^D[A-Z]/.test(star.spectralType) ? "D" : undefined);
  const unknown: StarProfile["unknown"] = {};
  const shape = star.hr === undefined ? undefined : SHAPES[star.hr];
  const base = { hr: star.hr, shape, rotation: star.hr === undefined ? undefined : starRotation(star.hr), luminosityClass: cls, composite: parsed.composite, unknown };
  const none = (why: Unknown): StarProfile => {
    unknown.temperature = why;
    unknown.luminosity = why;
    unknown.radius = why;
    return { ...base, temperature: undefined, colour: undefined, luminosity: undefined, radius: undefined, angularDiameterMas: undefined, limbDarkening: undefined };
  };
  if (cls === "D") return none("odd-type");
  const chosen = chooseTemperature(star, parsed, cls);
  if (chosen === undefined) return none(LETTERS.includes(parsed.letter) && parsed.letter !== "" ? "no-colour-or-type" : "odd-type");
  const sigmaT = chosen.sigma;
  const T = chosen.teff;
  const sigmaV = magnitudeError(parsed, cls, parsed.composite);
  const supergiant = cls === "Ia" || cls === "Iab" || cls === "Ib" || cls === "I";
  const correction = bolometricCorrection(T, chosen.family, supergiant);

  // The flux ratio to the Sun at 1 AU, f = 10^(-0.4 (m_bol + 26.832)), enters as sqrt(f); the bolometric correction depends on the temperature, so the temperature's own error is followed through it.
  const lnSqrtF = (teff: number): number => -0.2 * LN10 * (star.magnitude + bolometricCorrection(teff, chosen.family, supergiant).bc - SUN_APPARENT_BOLOMETRIC);
  const lnTheta = (teff: number): number => lnSqrtF(teff) + 2 * ln(SUN_TEMPERATURE_K / teff);
  const step = Math.max(sigmaT, 1);
  const dT = Math.abs(lnTheta(T + step) - lnTheta(Math.max(T - step, 100))) / 2;
  const photometric = 0.2 * LN10;
  const sTheta = Math.hypot(dT, photometric * sigmaV, photometric * correction.error);
  const sqrtFlux = Math.exp(lnSqrtF(T));
  const theta = ((2 * sqrtFlux * (SUN_TEMPERATURE_K / T) ** 2) / AU_IN_SOLAR_RADII) * AU_PER_PARSEC_MAS;
  const angular: Estimate = { value: theta, error: theta * sTheta, range: [theta * Math.exp(-sTheta), theta * Math.exp(sTheta)] };
  const temperature = { value: T, error: sigmaT, range: [T - sigmaT, T + sigmaT] as const, basis: chosen.basis };

  // The distance: parallax, with the error the catalogue states or, where it states none, what its precision implies. A parallax whose error is half of it or more fixes no distance.
  const parallax = star.parallaxMas;
  const parallaxError = !(parallax > 0) ? undefined : (star.parallaxErrorMas ?? (star.parallaxSource === "dynamical" ? 0.05 * parallax : 0.5));
  const odd = !(parsed.letter !== "" && LETTERS.includes(parsed.letter));
  const usable = parallaxError !== undefined && parallaxError < 0.5 * parallax && !odd;
  const distanceKiloparsec = parallax > 0 ? 1 / parallax : 0;
  const dust = 0.3 * distanceKiloparsec;
  const sBrightness = Math.hypot(sigmaV, correction.error, dust);

  let luminosity: Estimate | undefined;
  let fromParallax: (Estimate & { basis: RadiusBasis }) | undefined;
  if (usable) {
    const au = AU_PER_PARSEC_MAS / parallax;
    const lnL = (teff: number): number => -0.4 * LN10 * (star.magnitude + bolometricCorrection(teff, chosen.family, supergiant).bc - SUN_APPARENT_BOLOMETRIC);
    const L = 10 ** (-0.4 * (star.magnitude + correction.bc - SUN_APPARENT_BOLOMETRIC)) * au * au;
    const dLT = Math.abs(lnL(T + step) - lnL(Math.max(T - step, 100))) / 2;
    const sL = Math.hypot(dLT, 0.4 * LN10 * sigmaV, 0.4 * LN10 * correction.error, 0.4 * LN10 * dust);
    const near = parallax / (parallax + parallaxError);
    const far = parallax / (parallax - parallaxError);
    luminosity = { value: L, error: L * Math.hypot(sL, (2 * parallaxError) / parallax), range: [L * Math.exp(-sL) * near * near, L * Math.exp(sL) * far * far] };
    const R = sqrtFlux * (SUN_TEMPERATURE_K / T) ** 2 * au;
    const sR = Math.hypot(dT, photometric * sBrightness);
    fromParallax = { value: R, error: R * Math.hypot(sR, parallaxError / parallax), range: [R * Math.exp(-sR) * near, R * Math.exp(sR) * far], basis: "parallax" };
    // A radius far below that of a dwarf of the same temperature, or a dwarf far above it, is a wrong parallax, not a star.
    const floor = through(load().dwarf.map((r) => [r.teff, r.radius] as const).sort((p, q) => p[0] - q[0]), T);
    if (fromParallax.range[1] < 0.4 * floor || (cls === "V" && fromParallax.range[0] > 6 * floor)) {
      fromParallax = undefined;
      luminosity = undefined;
      unknown.radius = "implausible-parallax";
      unknown.luminosity = "implausible-parallax";
    }
  } else {
    unknown.luminosity = odd ? "odd-type" : parallax > 0 ? "poor-parallax" : "no-parallax";
  }

  const typical = typicalRadius(parsed, cls);
  let radius: StarProfile["radius"];
  const relativeOf = (e: Estimate): number => (Number.isFinite(e.range[1]) ? (e.range[1] - e.range[0]) / (2 * e.value) : Number.POSITIVE_INFINITY);
  if (typical !== undefined && !odd && (fromParallax === undefined || relativeOf(fromParallax) > typical.relative)) {
    const r = typical.radius;
    radius = { value: r, error: r * typical.relative, range: [r * (1 - typical.relative), r * (1 + typical.relative)], basis: "type" };
    delete unknown.radius;
  } else {
    radius = fromParallax;
  }
  if (radius === undefined && unknown.radius === undefined) unknown.radius = odd ? "odd-type" : unknown.luminosity ?? (cls === undefined ? "no-class" : "no-typical-radius");

  return { ...base, temperature, colour: blackBodyColour(T), luminosity, radius, angularDiameterMas: angular, limbDarkening: limbCoefficient(T, cls) };
}
