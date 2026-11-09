// How big each Messier, NGC and IC object is on the sky and which way it lies, and the outline that follows: the shapes of the galaxies and the sizes the rows carry. The large deep-sky shape tier (`@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic-shape`):
// the table is about 45 kB gzipped, so it is its own import and the Messier-only `@johnmorrisdotca/hoshi-stars/deep-sky/shape` stays small. Pure: no DOM, no clock, no state beyond the parsed table.
import { MESSIER_SHAPES } from "./data/deep-sky-shapes-messier.ts";
import { NGC_IC_SHAPES } from "./data/deep-sky-shapes-ngc-ic.ts";
import { shapeTable, type DeepSkyShape } from "./deep-sky-shape-core.ts";
import type { DeepSkyObject } from "./deep-sky-core.ts";

export { deepSkyOutline, measuredParts, offsetOnSky, type DeepSkyShape, type DeepSkyShapeSource } from "./deep-sky-shape-core.ts";

const table = shapeTable([MESSIER_SHAPES, NGC_IC_SHAPES]);

/**
 * The size, axis ratio and angle of a Messier, NGC or IC object on the sky. For a galaxy they are RC3's (the major axis at the 25th magnitude isophote, the axis ratio and the angle) or, where RC3 has
 * none, NASA/IPAC NED's; for any other object, and for a galaxy with neither, the one diameter that the object's own row carries (`sizeArcmin`, from Wikidata, and for a Messier object what the Messier
 * table gave), with no ratio and no angle. Every part is a measurement or `undefined`: no object is given an angle that a catalogue does not, and an object with no size at all has `undefined`. The
 * sources are in `NOTICE.md`.
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
