// What the Nearby panel and the embed page share: the things near a picked star, Messier object or constellation, as keys the chart can ring (`S:<HR>`, `D:<id>`, `C:<abbreviation>`).
import { constellation } from "../src/constellations.ts";
import { deepSkyObject } from "../src/deep-sky.ts";
import { starByHr } from "../src/index.ts";
import { nearest, neighbouringConstellations } from "../src/nearest.ts";
import type { SeenSky, SeenStar } from "../src/sky-from.ts";
import { keyOfSeen } from "./chart.ts";

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

const RADIANS = Math.PI / 180;
const vectorOf = (at: { rightAscension: number; declination: number }, length: number): [number, number, number] => [
  Math.cos(at.declination * RADIANS) * Math.cos(at.rightAscension * RADIANS) * length,
  Math.cos(at.declination * RADIANS) * Math.sin(at.rightAscension * RADIANS) * length,
  Math.sin(at.declination * RADIANS) * length,
];

const angleBetween = (a: readonly number[], b: readonly number[]): number =>
  Math.atan2(Math.hypot(a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!), a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!) / RADIANS;

/** What is near a star or a Messier object in the sky seen from another star: the angle on that sky, or the distance in space from the stars' places there (the same from anywhere). The Sun is among them. */
function nearbyInSky(sky: SeenSky, pick: string, by: By): Nearby | undefined {
  const id = pick.slice(2);
  let target: { rightAscension: number; declination: number; lightYears?: number } | undefined;
  let own: string | undefined;
  if (pick.startsWith("S:")) {
    const star: SeenStar | undefined = sky.find((one) => keyOfSeen(one.id) === id);
    if (star === undefined) return undefined;
    target = star;
    own = star.id;
  } else {
    target = deepSkyObject(id);
    if (target === undefined) return undefined;
  }
  const canSpace = target.lightYears !== undefined;
  const here = vectorOf(target, target.lightYears ?? 1);
  const rows = sky
    .filter((one) => one.id !== own)
    .map((one) => {
      const there = vectorOf(one, one.lightYears);
      const value = by === "space" && canSpace ? Math.hypot(there[0] - here[0], there[1] - here[1], there[2] - here[2]) : angleBetween(here, there);
      return { key: `S:${keyOfSeen(one.id)}`, value };
    })
    .sort((a, b) => a.value - b.value)
    .slice(0, NEARBY_COUNT);
  return { kind: pick.startsWith("S:") ? "star" : "deep", rows, skipped: sky.skipped, canSpace };
}

/** What is near a pick (`S:2491`, `D:M31` or `C:Ori`), or `undefined` for a pick that is none of the three. With `sky`, the sky seen from another star: the stars are the ones it holds. */
export function nearbyOf(pick: string | null | undefined, by: By, sky?: SeenSky): Nearby | undefined {
  if (pick === null || pick === undefined) return undefined;
  if (sky !== undefined && !pick.startsWith("C:")) return nearbyInSky(sky, pick, by);
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
