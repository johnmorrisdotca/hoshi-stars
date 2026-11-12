// The days of the markers page's time slider, in the reader's own calendar (John's rule: every shown date and time is the reader's, MODULES-851). Pure: a moment is always an argument.
import type { MarkerRange } from "../src/chart/markers.ts";

/** Midnight at the start of the reader's day that holds `ms`. */
export function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** `ms` moved by whole calendar days of the reader's own (a day with a clock change is still one day). */
export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()).getTime();
}

/** How many calendar days from the day of `a` to the day of `b`. */
export function daysBetween(a: number, b: number): number {
  const x = new Date(a);
  const y = new Date(b);
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86_400_000);
}

/**
 * The slider's two handles as a time range: from the start of day `from` to the last moment of day `to`, counted in days from the day that holds `origin`.
 *
 * @param origin - The moment that day 0 holds (the first marker's).
 * @param from - The day of the left handle.
 * @param to - The day of the right handle.
 * @param fade - The days a marker takes to come in from an edge.
 * @returns The range to give the chart.
 *
 * @example
 * ```ts
 * import { windowOf } from "./markers-days.ts";
 *
 * console.log(windowOf(Date.now(), 0, 2, 1).fade);
 * // 1
 * ```
 */
export function windowOf(origin: number, from: number, to: number, fade: number): MarkerRange {
  const start = dayStart(origin);
  return { from: addDays(start, from), to: addDays(start, to + 1) - 1, fade };
}
