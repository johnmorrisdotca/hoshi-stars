// The Milky Way's shapes: a galactic point, a strip, a band and the options and pixels of the detail, the texture and the bands. Moved out of milky-way.ts as they were; milky-way.ts re-exports them.
import type { SkyPoint } from "./projection.ts";

/**
 * A point in galactic coordinates, in degrees.
 *
 * @example
 * ```ts
 * import type { GalacticPoint } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const centre: GalacticPoint = { longitude: 0, latitude: 0 };
 * console.log(centre.longitude);
 * ```
 */
export interface GalacticPoint {
  /** Galactic longitude, 0 (toward the Galactic centre in Sagittarius) up to but not including 360. */
  longitude: number;
  /** Galactic latitude, -90 to 90: 0 is the plane of the Milky Way. */
  latitude: number;
}

/**
 * A ribbon of the Milky Way at one brightness level: two chains of sky points of the same length, the upper edge and the lower, each pair at the same galactic longitude. Draw the ribbon as
 * the polygon `upper` forward then `lower` backward. A strip stops where the band splits or ends (a dust lane, the end of a bright patch), so one level is several strips.
 *
 * @example
 * ```ts
 * import { milkyWayBands, type MilkyWayStrip } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const strip: MilkyWayStrip = milkyWayBands()[0]!.strips[0]!;
 * console.log(strip.upper.length === strip.lower.length);
 * ```
 */
export interface MilkyWayStrip {
  /** The edge toward the galactic north, from low longitude to high. */
  upper: SkyPoint[];
  /** The edge toward the galactic south, at the same longitudes as `upper`. */
  lower: SkyPoint[];
}

/**
 * Everywhere the Milky Way is brighter than one level.
 *
 * @example
 * ```ts
 * import { milkyWayBands, type MilkyWayBand } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const band: MilkyWayBand = milkyWayBands([0.5])[0]!;
 * console.log(band.level, band.strips.length);
 * ```
 */
export interface MilkyWayBand {
  /** The level, 0 (dark sky) to 1 (the brightest part of the core), as `milkyWayBrightness` gives it. */
  level: number;
  /** The ribbons where the brightness is above the level. */
  strips: MilkyWayStrip[];
}

/**
 * Where to cut the bands, and how finely.
 *
 * @example
 * ```ts
 * import { milkyWayBands, type MilkyWayBandsOptions } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const options: MilkyWayBandsOptions = { step: 2 };
 * console.log(milkyWayBands([0.3, 0.6], options).length);
 * ```
 */
export interface MilkyWayBandsOptions {
  /** Degrees of galactic longitude between points along a strip; a multiple of the grid's 0.5, default 1. */
  step?: number;
}

/**
 * How sharply to read the grid between its points.
 *
 * @example
 * ```ts
 * import { milkyWayBrightness, type MilkyWayDetailOptions } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const options: MilkyWayDetailOptions = { detail: 1 };
 * console.log(milkyWayBrightness({ rightAscension: 190, declination: -63 }, options)); // the Coalsack, darker than with detail 0
 * ```
 */
export interface MilkyWayDetailOptions {
  /**
   * 0 reads the grid in straight lines between its points (the default for `milkyWayBrightness`). Above 0 the grid is read along smooth curves and each value is pushed away from the mean of the
   * degree or two round it, by this much: the dust lanes come out narrower and darker and the star clouds beside them brighter, the way the eye sees them. It sharpens what the grid holds and adds
   * no detail of its own (no noise, nothing made up). From 0 to 2; 1 is the default for `milkyWayTexture`.
   */
  detail?: number;
}

/**
 * One stop of a colour ramp: at a brightness level, a colour and an opacity. Between stops the colour runs in a straight line.
 *
 * @example
 * ```ts
 * import type { MilkyWayRampStop } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const core: MilkyWayRampStop = { level: 1, red: 255, green: 243, blue: 216, alpha: 0.88 };
 * console.log(core.level);
 * ```
 */
export interface MilkyWayRampStop {
  /** The brightness, 0 to 1, as `milkyWayBrightness` gives it. */
  level: number;
  /** Red, green and blue, 0 to 255. */
  red: number;
  green: number;
  blue: number;
  /** Opacity, 0 (clear) to 1. */
  alpha: number;
}

/**
 * What texture to paint.
 *
 * @example
 * ```ts
 * import { milkyWayTexture, type MilkyWayTextureOptions } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const options: MilkyWayTextureOptions = { width: 1024, frame: "galactic", detail: 1.5 };
 * console.log(milkyWayTexture(options).height); // 512
 * ```
 */
export interface MilkyWayTextureOptions extends MilkyWayDetailOptions {
  /** Pixels across: an even whole number from 16 to 4096 (the family's largest texture side), default 2048. The height is half of it. */
  width?: number;
  /**
   * `equatorial` (the default): across is right ascension, 0 at the left edge rising to 360 at the right, and down is declination, +90 at the top to -90 at the bottom, the way a sky sphere in
   * equatorial coordinates is mapped. `galactic`: across is galactic longitude and down galactic latitude, the same way round, with the Galactic centre at the left edge.
   */
  frame?: "equatorial" | "galactic";
  /** The colours, at least two stops in rising order of level, the first at 0 and the last at 1. Default `MILKY_WAY_NIGHT_RAMP`. */
  ramp?: readonly MilkyWayRampStop[];
}

/**
 * A painted Milky Way texture.
 *
 * @example
 * ```ts
 * import { milkyWayTexture, type MilkyWayTexturePixels } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const texture: MilkyWayTexturePixels = milkyWayTexture({ width: 256 });
 * console.log(texture.data.length === texture.width * texture.height * 4); // true
 * ```
 */
export interface MilkyWayTexturePixels {
  width: number;
  height: number;
  /** Red, green, blue and opacity for each pixel, row by row from the top, as `ImageData` and a WebGL texture take them. The colour is not multiplied by the opacity. */
  data: Uint8ClampedArray;
}
