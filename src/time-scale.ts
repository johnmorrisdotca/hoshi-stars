// From UTC (as JavaScript counts it) to Terrestrial Time, the scale the IAU rotation rates of the planets are in. TT runs ahead of UTC by the leap seconds (TAI - UTC) plus 32.184 s.
// Before 1972, when UTC had no leap seconds, TT - UT is delta T, from the polynomial fits of F. Espenak and J. Meeus (NASA, "Polynomial Expressions for Delta T", 2006), which are formulas, written out here.
// After the last leap second in the table (2017) the offset stays at 37 s + 32.184 s until a new leap second is announced: add a row below. TDB - TT, under 2 milliseconds, is ignored.
// Pure: no DOM, no clock. Not an entry point of the package; `horizontalFrom` in `/sky` uses it.

/** Each leap second's day (UTC, as milliseconds since 1970) and TAI - UTC in seconds from that day on. */
const LEAPS: ReadonlyArray<readonly [number, number]> = [
  [Date.UTC(1972, 0, 1), 10], [Date.UTC(1972, 6, 1), 11], [Date.UTC(1973, 0, 1), 12], [Date.UTC(1974, 0, 1), 13], [Date.UTC(1975, 0, 1), 14], [Date.UTC(1976, 0, 1), 15],
  [Date.UTC(1977, 0, 1), 16], [Date.UTC(1978, 0, 1), 17], [Date.UTC(1979, 0, 1), 18], [Date.UTC(1980, 0, 1), 19], [Date.UTC(1981, 6, 1), 20], [Date.UTC(1982, 6, 1), 21],
  [Date.UTC(1983, 6, 1), 22], [Date.UTC(1985, 6, 1), 23], [Date.UTC(1988, 0, 1), 24], [Date.UTC(1990, 0, 1), 25], [Date.UTC(1991, 0, 1), 26], [Date.UTC(1992, 6, 1), 27],
  [Date.UTC(1993, 6, 1), 28], [Date.UTC(1994, 6, 1), 29], [Date.UTC(1996, 0, 1), 30], [Date.UTC(1997, 6, 1), 31], [Date.UTC(1999, 0, 1), 32], [Date.UTC(2006, 0, 1), 33],
  [Date.UTC(2009, 0, 1), 34], [Date.UTC(2012, 6, 1), 35], [Date.UTC(2015, 6, 1), 36], [Date.UTC(2017, 0, 1), 37],
];

const TT_MINUS_TAI = 32.184;

/** The first moment of a year (UTC), for any year: `Date.UTC` reads 0 to 99 as 1900 to 1999. */
function startOf(year: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, 0, 1);
  return date.getTime();
}

/** Espenak and Meeus's delta T (TT - UT, seconds) for a year with a fraction. */
function deltaT(y: number): number {
  const poly = (t: number, ...c: number[]): number => c.reduceRight((sum, k) => sum * t + k, 0);
  if (y < -500) return -20 + 32 * ((y - 1820) / 100) ** 2;
  if (y < 500) return poly(y / 100, 10583.6, -1014.41, 33.78311, -5.952053, -0.1798452, 0.022174192, 0.0090316521);
  if (y < 1600) return poly((y - 1000) / 100, 1574.2, -556.01, 71.23472, 0.319781, -0.8503463, -0.005050998, 0.0083572073);
  if (y < 1700) return poly(y - 1600, 120, -0.9808, -0.01532, 1 / 7129);
  if (y < 1800) return poly(y - 1700, 8.83, 0.1603, -0.0059285, 0.00013336, -1 / 1_174_000);
  if (y < 1860) return poly(y - 1800, 13.72, -0.332447, 0.0068612, 0.0041116, -0.00037436, 0.0000121272, -0.0000001699, 0.000000000875);
  if (y < 1900) return poly(y - 1860, 7.62, 0.5737, -0.251754, 0.01680668, -0.0004473624, 1 / 233_174);
  if (y < 1920) return poly(y - 1900, -2.79, 1.494119, -0.0598939, 0.0061966, -0.000197);
  if (y < 1941) return poly(y - 1920, 21.2, 0.84493, -0.0761, 0.0020936);
  if (y < 1961) return poly(y - 1950, 29.07, 0.407, -1 / 233, 1 / 2547);
  if (y < 1986) return poly(y - 1975, 45.45, 1.067, -1 / 260, -1 / 718);
  return poly(y - 2000, 63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599);
}

/**
 * The offset TT - UTC in seconds at a moment given in UTC: 42.184 s at the start of 1972 and 69.184 s from 2017 on; before 1972, delta T (TT - UT) from the Espenak and Meeus fit.
 *
 * @param utcMs - Milliseconds since 1970 (UTC), finite.
 * @returns Seconds to add to UTC to get Terrestrial Time.
 *
 * @example
 * ```ts
 * import { terrestrialMinusUtc } from "./time-scale.ts";
 *
 * console.log(terrestrialMinusUtc(Date.UTC(2026, 10, 8)), terrestrialMinusUtc(Date.UTC(2000, 0, 1)));
 * ```
 */
export function terrestrialMinusUtc(utcMs: number): number {
  if (utcMs >= LEAPS[0]![0]) {
    let tai = LEAPS[0]![1];
    for (const [from, seconds] of LEAPS) if (utcMs >= from) tai = seconds;
    return tai + TT_MINUS_TAI;
  }
  const year = new Date(utcMs).getUTCFullYear();
  const start = startOf(year);
  return deltaT(year + (utcMs - start) / (startOf(year + 1) - start));
}
