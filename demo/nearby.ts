// What the Nearby panel and the embed page share: the things near a picked star, Messier object or constellation, as keys the chart can ring (`S:<HR>`, `D:<id>`, `C:<abbreviation>`).
import { constellation } from "../src/constellations.ts";
import { deepSkyObject } from "../src/deep-sky.ts";
import { starByHr } from "../src/index.ts";
import { nearest, neighbouringConstellations } from "../src/nearest.ts";

export type By = "sky" | "space";
export const NEARBY_COUNT = 10;

export interface NearRow {
  key: string;
  /** Degrees by sky, light-years by space; not given for a constellation. */
  value?: number;
}

export interface Nearby {
  /** What the picked thing is. */
  kind: "star" | "deep" | "constellation";
  rows: NearRow[];
  /** Stars left out for want of a distance, by space. */
  skipped: number;
  /** Whether the picked thing has a distance, so that `by: "space"` can be asked. */
  canSpace: boolean;
}

/** What is near a pick (`S:2491`, `D:M31` or `C:Ori`), or `undefined` for a pick that is none of the three. */
export function nearbyOf(pick: string | null | undefined, by: By): Nearby | undefined {
  if (pick === null || pick === undefined) return undefined;
  const id = pick.slice(2);
  if (pick.startsWith("C:")) {
    const found = constellation(id);
    return found === undefined ? undefined : { kind: "constellation", rows: neighbouringConstellations(found.abbreviation).map((c) => ({ key: `C:${c.abbreviation}` })), skipped: 0, canSpace: false };
  }
  if (pick.startsWith("S:")) {
    const star = starByHr(Number(id));
    if (star === undefined) return undefined;
    const canSpace = star.parallaxMas > 0;
    if (by === "space" && canSpace) {
      const found = nearest(star, { by: "space", count: NEARBY_COUNT });
      return { kind: "star", rows: found.map((n) => ({ key: `S:${n.thing.hr}`, value: n.distance })), skipped: found.skipped, canSpace };
    }
    return { kind: "star", rows: nearest(star, { count: NEARBY_COUNT }).map((n) => ({ key: `S:${n.thing.hr}`, value: n.angle })), skipped: 0, canSpace };
  }
  if (pick.startsWith("D:")) {
    const object = deepSkyObject(id);
    if (object === undefined) return undefined;
    return { kind: "deep", rows: nearest(object, { count: NEARBY_COUNT }).map((n) => ({ key: `S:${n.thing.hr}`, value: n.angle })), skipped: 0, canSpace: false };
  }
  return undefined;
}
