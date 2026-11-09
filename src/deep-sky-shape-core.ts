// The part the two shape entry points share: what a deep-sky object's size and angle are, how a row of the data becomes one, and the outline on the sky. Not an entry point itself.
// Pure: no DOM, no clock, no state beyond the parsed tables.
import type { DeepSkyObject } from "./deep-sky-core.ts";
import { unproject, type SkyPoint } from "./projection.ts";

/**
 * The catalogue a size came from, as `deepSkyShape` names it: `RC3` (the Third Reference Catalogue of Bright Galaxies, for a galaxy's major axis, axis ratio and angle), `Messier table`
 * (Sky Catalog 2000.0, for a Messier object's diameters), `NGC 2000.0` (one diameter for an NGC or IC object) or `Wikidata` (a size the other three lack).
 *
 * @example
 * ```ts
 * import { type DeepSkyShapeSource } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
 *
 * const source: DeepSkyShapeSource = "RC3";
 * console.log(source);
 * ```
 */
export type DeepSkyShapeSource = "RC3" | "Messier table" | "NGC 2000.0" | "Wikidata";

/**
 * How big a deep-sky object is on the sky and which way it lies. Each part is a measurement or it is `undefined`: nothing is guessed. Where the minor axis or the angle is missing, the object is
 * known to be at least that large and no more.
 *
 * @example
 * ```ts
 * import { deepSkyShape } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
 * import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * const shape = deepSkyShape(deepSkyObject("M31")!);
 * console.log(shape.majorArcmin, shape.minorArcmin, shape.positionAngle, shape.source);
 * ```
 */
export interface DeepSkyShape {
  /** The longest way across, in arc-minutes, or `undefined` where no catalogue gives one. */
  majorArcmin: number | undefined;
  /** The shortest way across, in arc-minutes, or `undefined` where it is not measured (then the object is drawn round, at the major diameter). */
  minorArcmin: number | undefined;
  /** The angle of the major axis in degrees, 0 up to 180, measured from north through east (90 is east-west), or `undefined` where it is not measured. */
  positionAngle: number | undefined;
  /** The catalogue of the major axis, or `undefined` with it. */
  source: DeepSkyShapeSource | undefined;
}

const SOURCES: Record<string, DeepSkyShapeSource> = { r: "RC3", m: "Messier table", n: "NGC 2000.0", w: "Wikidata" };

/**
 * What a table of shapes offers: the shape of an object.
 *
 * @example
 * ```ts
 * import { deepSkyShape } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
 * import { messier } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * console.log(messier().filter((o) => deepSkyShape(o).positionAngle !== undefined).length);
 * ```
 */
export interface ShapeTable {
  /** The shape of an object, with every part `undefined` that is not known. */
  shapeOf(object: DeepSkyObject): DeepSkyShape;
}

const parsedRows = new Map<string, Map<string, DeepSkyShape>>();

/** The shapes of a string of rows, parsed once however many tables use it. */
function parsed(rows: string): Map<string, DeepSkyShape> {
  const found = parsedRows.get(rows);
  if (found !== undefined) return found;
  const map = new Map<string, DeepSkyShape>();
  for (const row of rows.split("\n")) {
    const p = row.split("|") as [string, string, string, string, string];
    map.set(p[0], Object.freeze({ majorArcmin: Number(p[1]) / 10, minorArcmin: p[2] === "" ? undefined : Number(p[2]) / 10, positionAngle: p[3] === "" ? undefined : Number(p[3]), source: SOURCES[p[4]] }));
  }
  parsedRows.set(rows, map);
  return map;
}

/** The short id the rows use: `M31`, `N7000` for NGC 7000 and `I434` for IC 434. */
function shortId(object: DeepSkyObject): string {
  return object.messier ?? (object.ngc !== undefined ? object.ngc.replace("NGC ", "N") : object.ic!.replace("IC ", "I"));
}

/**
 * Make a table from rows of the data, as `scripts/make-deep-sky-shapes.py` writes them: `id | major | minor | angle | source`, the diameters in tenths of an arc-minute.
 *
 * @param rowSets - One or more strings of rows, one object a line.
 * @returns The table.
 *
 * @example
 * ```ts
 * import { shapeTable } from "../src/deep-sky-shape-core.ts";
 * import { deepSkyObject } from "../src/deep-sky.ts";
 *
 * console.log(shapeTable(["M31|1905|617|35|r"]).shapeOf(deepSkyObject("M31")!).positionAngle);
 * ```
 */
export function shapeTable(rowSets: string[]): ShapeTable {
  const none: DeepSkyShape = Object.freeze({ majorArcmin: undefined, minorArcmin: undefined, positionAngle: undefined, source: undefined });
  return {
    shapeOf: (object) => {
      const id = shortId(object);
      for (const rows of rowSets) {
        const found = parsed(rows).get(id);
        if (found !== undefined) return found;
      }
      return object.sizeArcmin === undefined ? none : Object.freeze({ majorArcmin: object.sizeArcmin, minorArcmin: undefined, positionAngle: undefined, source: "Wikidata" });
    },
  };
}

const ARCMIN = Math.PI / 10800;

/**
 * The sky position `east` and `north` arc-minutes from a centre, on the tangent plane there (the gnomonic projection, the one that sky photographs and the standard picture header use). Exact on
 * the sphere; for a few degrees it differs from adding the offsets to right ascension and declination by the shrinking of the meridians.
 *
 * @param centre - The point the plane touches the sky at.
 * @param east - Arc-minutes toward increasing right ascension.
 * @param north - Arc-minutes toward the north celestial pole.
 * @returns The sky point, right ascension 0 up to 360.
 *
 * @example
 * ```ts
 * import { offsetOnSky } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
 *
 * console.log(offsetOnSky({ rightAscension: 10.68, declination: 41.27 }, 0, 60));
 * ```
 */
export function offsetOnSky(centre: SkyPoint, east: number, north: number): SkyPoint {
  const at = unproject("gnomonic", { x: east * ARCMIN, y: north * ARCMIN }, { centre, scale: 1, mirror: true });
  if (at === undefined) throw new RangeError(`the offset ${east}, ${north} arc-minutes is not on the sky`);
  return { rightAscension: ((at.rightAscension % 360) + 360) % 360, declination: at.declination };
}

/**
 * The outline of an object on the sky: a closed ring of points (the first repeated as the last) round an ellipse of the shape's major and minor axes at its angle. Where the minor axis or the
 * angle is not known the ring is a circle of the major diameter, because no other shape is measured. The points are on the sky, so any projection can draw them.
 *
 * @param centre - The object's position.
 * @param shape - Its shape, from `deepSkyShape`.
 * @param points - How many points round it, at least 8 (default 48).
 * @returns The ring, or `undefined` where the shape has no size.
 * @throws RangeError if `points` is not a whole number of at least 8.
 *
 * @example
 * ```ts
 * import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 * import { deepSkyOutline, deepSkyShape } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
 *
 * const m31 = deepSkyObject("M31")!;
 * console.log(deepSkyOutline(m31, deepSkyShape(m31), 16)!.length);
 * ```
 */
export function deepSkyOutline(centre: SkyPoint, shape: DeepSkyShape, points = 48): SkyPoint[] | undefined {
  if (!Number.isInteger(points) || points < 8) throw new RangeError(`points must be a whole number of at least 8, got ${String(points)}`);
  if (shape.majorArcmin === undefined) return undefined;
  const a = shape.majorArcmin / 2;
  const oriented = shape.minorArcmin !== undefined && shape.positionAngle !== undefined;
  const b = oriented ? shape.minorArcmin! / 2 : a;
  const theta = ((oriented ? shape.positionAngle! : 0) * Math.PI) / 180;
  const ring: SkyPoint[] = [];
  for (let i = 0; i < points; i++) {
    const t = (2 * Math.PI * i) / points;
    const along = a * Math.cos(t);
    const across = b * Math.sin(t);
    ring.push(offsetOnSky(centre, along * Math.sin(theta) + across * Math.cos(theta), along * Math.cos(theta) - across * Math.sin(theta)));
  }
  ring.push(ring[0]!);
  return ring;
}

/**
 * Which parts of an object's drawn shape are measured: the size, the axis ratio and the angle. An object whose axis ratio or angle is not measured is drawn round, so `oval` says whether the
 * drawing is the measured ellipse.
 *
 * @param shape - The shape from `deepSkyShape`.
 * @returns `size`, `ratio` and `angle` as true where measured, and `oval` as true where both of the last two are.
 *
 * @example
 * ```ts
 * import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 * import { deepSkyShape, measuredParts } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
 *
 * console.log(measuredParts(deepSkyShape(deepSkyObject("M42")!)));
 * ```
 */
export function measuredParts(shape: DeepSkyShape): { size: boolean; ratio: boolean; angle: boolean; oval: boolean } {
  const size = shape.majorArcmin !== undefined;
  const ratio = size && shape.minorArcmin !== undefined;
  const angle = size && shape.positionAngle !== undefined;
  return { size, ratio, angle, oval: ratio && angle };
}
