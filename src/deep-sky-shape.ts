// How big each Messier object is on the sky and which way it lies, and the outline that follows. The deep-sky shape tier (`@johnmorrisdotca/hoshi-stars/deep-sky/shape`): a table of about 3 kB gzipped.
// The shapes of the NGC and IC objects, about 45 kB more, are the separate `@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic-shape`. Pure: no DOM, no clock, no state beyond the parsed table.
import { MESSIER_SHAPES } from "./data/deep-sky-shapes-messier.ts";
import { shapeTable, type DeepSkyShape } from "./deep-sky-shape-core.ts";
import type { DeepSkyObject } from "./deep-sky-core.ts";

export { deepSkyOutline, measuredParts, offsetOnSky, type DeepSkyShape, type DeepSkyShapeSource } from "./deep-sky-shape-core.ts";

const table = shapeTable([MESSIER_SHAPES]);

/**
 * The size, axis ratio and angle of a Messier object on the sky, from RC3 for the galaxies (the major axis at the 25th magnitude isophote, the axis ratio and the angle) and from the Sky Catalog
 * 2000.0's table for the others (a diameter, and a second diameter for a nebula or a cluster that is oval). Every part is a measurement or `undefined`; the sources are in `NOTICE.md`. An object the
 * table has nothing for gets Wikidata's size if the object has one.
 *
 * @param object - A deep-sky object (any, but this table holds only the Messier objects' shapes: another gets its Wikidata size or nothing; use `ngc-ic-shape` for those).
 * @returns The shape, frozen.
 *
 * @example
 * ```ts
 * import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 * import { deepSkyShape } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
 *
 * const shape = deepSkyShape(deepSkyObject("M31")!);
 * console.log(shape.majorArcmin, shape.minorArcmin, shape.positionAngle);
 * ```
 */
export function deepSkyShape(object: DeepSkyObject): DeepSkyShape {
  return table.shapeOf(object);
}
