// A moment as the star functions take it: a `Date` or milliseconds since 1970 (UTC as JavaScript counts it). Pure: no DOM.

/** The J2000.0 epoch (2000 January 1, 12:00 UTC, which is TT to within the 64 seconds this package ignores) in milliseconds since 1970. */
export const J2000_MS = 946_728_000_000;

/**
 * A moment: a `Date` or a number of milliseconds since 1970 (UTC, as JavaScript counts).
 *
 * @example
 * ```ts
 * import { starPosition, starByName, type When } from "@johnmorrisdotca/hoshi-stars";
 *
 * const when: When = new Date(Date.UTC(2026, 10, 7));
 * console.log(starPosition(starByName("Sirius")!, when).declination.toFixed(4));
 * ```
 */
export type When = Date | number;

/** A moment as milliseconds since 1970. A `Date` is never changed. An invalid `Date`, a number that is not finite or anything else throws, naming the argument and the value. */
export function moment(when: When, name = "when"): number {
  if (typeof when === "number") {
    if (Number.isFinite(when)) return when;
  } else if (typeof (when as Date | undefined)?.getTime === "function") {
    const ms = when.getTime();
    if (Number.isFinite(ms)) return ms;
  } else throw new TypeError(`${name} must be a Date or a number of milliseconds since 1970, got ${typeof when}`);
  throw new RangeError(`${name} must be a valid Date or a finite number of milliseconds since 1970, got ${String(when)}`);
}
