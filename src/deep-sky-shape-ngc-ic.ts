// How big each Messier, NGC and IC object is on the sky and which way it lies, and the outline that follows: 8,329 shapes. The large deep-sky shape tier (`@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic-shape`):
// the table is about 45 kB gzipped, so it is its own import and the Messier-only `@johnmorrisdotca/hoshi-stars/deep-sky/shape` stays small. Pure: no DOM, no clock, no state beyond the parsed table.
import { MESSIER_SHAPES } from "./data/deep-sky-shapes-messier.ts";
import { NGC_IC_SHAPES } from "./data/deep-sky-shapes-ngc-ic.ts";
import { shapeTable, type DeepSkyShape } from "./deep-sky-shape-core.ts";
import type { DeepSkyObject } from "./deep-sky-core.ts";

export { deepSkyOutline, measuredParts, offsetOnSky, type DeepSkyShape, type DeepSkyShapeSource } from "./deep-sky-shape-core.ts";

const table = shapeTable([MESSIER_SHAPES, NGC_IC_SHAPES]);

/**
 * The size, axis ratio and angle of a Messier, NGC or IC object on the sky: RC3's for a galaxy (the major axis at the 25th magnitude isophote, the axis ratio and the angle, for about 7,000 of the
 * 10,282), the Sky Catalog's for a Messier object that is not a galaxy and NGC 2000.0's single diameter for most of the rest. Every part is a measurement or `undefined`: only the galaxies of
 * RC3 have an angle, and no object is given one that the catalogues do not. An object none of them has gets Wikidata's size if the object has one. The sources are in `NOTICE.md`.
 *
 * @param object - A deep-sky object from `deep-sky` or `deep-sky/ngc-ic`.
 * @returns The shape, frozen.
 *
 * @example
 * ```ts
 * import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic";
 * import { deepSkyShape } from "@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic-shape";
 *
 * const shape = deepSkyShape(deepSkyObject("NGC 253")!);
 * console.log(shape.majorArcmin, shape.minorArcmin, shape.positionAngle, shape.source);
 * ```
 */
export function deepSkyShape(object: DeepSkyObject): DeepSkyShape {
  return table.shapeOf(object);
}
