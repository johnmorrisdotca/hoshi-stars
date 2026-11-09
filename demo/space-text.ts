// The words on the constellation in 3D: a star's name, and its distance as a number, a range or a plain "unknown". Pure: the words come in as a function, so a test can use the real table.
import type { StarIn3D } from "../src/constellation-3d.ts";
import type { Lang } from "./thumbs.ts";

export type Say = (key: string, values?: Record<string, string | number>) => string;

/** A distance in light-years for reading: one decimal under 10, whole numbers above, with the language's separators. */
export function lightYearsText(n: number, lang: Lang): string {
  const locale = lang === "ja" ? "ja-JP" : "en";
  return n < 10 ? n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : Math.round(n).toLocaleString(locale);
}

/** The star's name in a language: the common name, else its Bayer letter or Flamsteed number, else its catalogue number. */
export const nameOf = (one: StarIn3D, lang: Lang): string => (lang === "ja" ? one.star.nameJa : undefined) ?? one.star.name ?? one.star.designation ?? `HR ${one.star.hr}`;

export interface StarWords {
  name: string;
  /** The line under the name: the distance, the range or "distance unknown". */
  distance: string;
  /** The second line: the range around a distance, or empty. */
  range: string;
}

/**
 * What to say of a star: the distance for one with an error bar, the whole range for a streak (its far end may have none), and "distance unknown" for a ray.
 *
 * @example
 * ```ts
 * const words = describe(star, "en", say);
 * console.log(words.name, words.distance);
 * ```
 */
export function describe(one: StarIn3D, lang: Lang, say: Say): StarWords {
  const name = nameOf(one, lang);
  const n = (value: number): string => lightYearsText(value, lang);
  if (one.lightYears === undefined) return { name, distance: say("sp_unknown"), range: "" };
  if (one.range === undefined) return { name, distance: say("sp_ly", { n: n(one.lightYears) }), range: say("sp_noError") };
  const [near, far] = one.range;
  if (one.wide) return { name, distance: Number.isFinite(far) ? say("sp_range", { near: n(near), far: n(far) }) : say("sp_atLeast", { n: n(near) }), range: "" };
  return { name, distance: say("sp_ly", { n: n(one.lightYears) }), range: say("sp_range", { near: n(near), far: n(far) }) };
}
