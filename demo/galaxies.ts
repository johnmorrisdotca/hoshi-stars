// What the demo says about a galaxy's distance, and the list of the nearest and farthest galaxies. The numbers are the package's `galaxyDistance` (Wikidata, CC0, method not stated).
import type { DeepSkyObject } from "../src/deep-sky-core.ts";
import type { GalaxyDistance } from "../src/galaxy-distance-core.ts";

/** How many galaxies the list shows. */
export const GALAXY_LIST_COUNT = 10;

export type Order = "near" | "far";

/** A count with its magnitude in words for the language: 2.67 million, 820 thousand (English), 267万, 82万 (Japanese). Three digits. */
export function compact(value: number, lang: "en" | "ja"): string {
  return new Intl.NumberFormat(lang === "ja" ? "ja-JP" : "en", { notation: "compact", compactDisplay: "long", maximumSignificantDigits: 3 }).format(value);
}

/** The same distance in the unit astronomers use: `0.82 Mpc`, `60 kpc`. */
export function parsecsText(parsecs: number): string {
  const [n, unit] = parsecs >= 1e6 ? [parsecs / 1e6, "Mpc"] : parsecs >= 1e3 ? [parsecs / 1e3, "kpc"] : [parsecs, "pc"];
  return `${Number(n.toPrecision(3))} ${unit}`;
}

/** The galaxies that have a distance, nearest first. */
export function byDistance(catalogue: readonly DeepSkyObject[], distanceOf: (object: DeepSkyObject) => GalaxyDistance | null): { object: DeepSkyObject; distance: GalaxyDistance }[] {
  const found: { object: DeepSkyObject; distance: GalaxyDistance }[] = [];
  for (const object of catalogue) {
    if (object.type !== "galaxy") continue;
    const distance = distanceOf(object);
    if (distance !== null) found.push({ object, distance });
  }
  return found.sort((a, b) => a.distance.parsecs - b.distance.parsecs);
}

/** The nearest or the farthest of a list sorted nearest first: the farthest comes farthest first. */
export function ends<T>(sorted: readonly T[], order: Order, count = GALAXY_LIST_COUNT): T[] {
  return order === "near" ? sorted.slice(0, count) : sorted.slice(-count).reverse();
}
