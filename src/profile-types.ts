// The shapes a star's profile is given and gives back: an estimate with its uncertainty, the basis of each step, the shape, the rotation and the profile itself. Moved out of profile.ts as they were; profile.ts re-exports them.
import type { LuminosityClass } from "./spectral.ts";
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
