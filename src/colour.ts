// The temperature a colour index implies and the colour a temperature has: the two small functions the stars and their profiles share. Pure: no data, no DOM, no state.

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
