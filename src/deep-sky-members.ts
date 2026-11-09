// The stars of the Bright Star Catalogue that lie inside a deep-sky object's outline: for a cluster, the bright stars that can be drawn as its members. The deep-sky members tier
// (`@johnmorrisdotca/hoshi-stars/deep-sky/members`). Pure: no DOM, no clock, no state beyond a cache of the lists made.
import type { DeepSkyObject } from "./deep-sky-core.ts";
import type { DeepSkyShape } from "./deep-sky-shape-core.ts";
import { stars, type Star } from "./stars.ts";

const found = new Map<string, Star[]>();

/**
 * The catalogue stars (magnitude 6.0 and brighter) that lie inside the circle of an object's major diameter, brightest first. This says where a star is, not what it belongs to: a star in front
 * of a cluster or far behind it is in the list too, because the catalogue gives no cluster distance to tell them apart. Draw them as "inside the outline", not as proven members.
 *
 * @param object - The deep-sky object (a cluster, usually).
 * @param shape - Its shape from `deepSkyShape`; with no major axis the list is empty.
 * @returns A fresh array of the shared, frozen stars: empty where the object has no size or no catalogue star is inside.
 *
 * @example
 * ```ts
 * import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 * import { deepSkyShape } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
 * import { starsInside } from "@johnmorrisdotca/hoshi-stars/deep-sky/members";
 *
 * const pleiades = deepSkyObject("M45")!;
 * console.log(starsInside(pleiades, deepSkyShape(pleiades)).map((star) => star.name ?? star.hr));
 * ```
 */
export function starsInside(object: DeepSkyObject, shape: DeepSkyShape): Star[] {
  if (shape.majorArcmin === undefined) return [];
  const key = `${object.id}|${shape.majorArcmin}`;
  let list = found.get(key);
  if (list === undefined) {
    const rad = Math.PI / 180;
    const radius = shape.majorArcmin / 2 / 60;
    const reach = Math.cos(Math.min(radius, 180) * rad);
    const sinD = Math.sin(object.declination * rad);
    const cosD = Math.cos(object.declination * rad);
    list = stars()
      .filter((star) => sinD * Math.sin(star.declination * rad) + cosD * Math.cos(star.declination * rad) * Math.cos((star.rightAscension - object.rightAscension) * rad) >= reach)
      .sort((a, b) => a.magnitude - b.magnitude);
    found.set(key, list);
  }
  return [...list];
}
