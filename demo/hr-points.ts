// The Hertzsprung-Russell page's numbers, apart from the drawing: which stars are plotted, where each lies on either pair of axes, and the ticks to label them with. Pure: no DOM, no clock.
// Colour (B-V) against absolute magnitude is what the catalogue gives; temperature against luminosity is what `starProfile` works out from it, so the two views hold the same stars in two shapes.
import { gradeAtLeast, starGrade, type StarGrade } from "../src/accuracy.ts";
import { starProfile, type ProfileInput } from "../src/profile.ts";
import { absoluteMagnitude, stars, type Star } from "../src/stars.ts";

/** The two pairs of axes: `"colour"` is B-V across and absolute magnitude up; `"physical"` is temperature across and luminosity up. Hot is on the left in both, as astronomers draw it. */
export type Axes = "colour" | "physical";
/** Which stars are shown: the graded ones (A and B), only grade A, or only the stars that have a name. */
export type Show = "graded" | "a" | "named";

export const AXES: readonly Axes[] = ["colour", "physical"];
export const SHOWS: readonly Show[] = ["graded", "a", "named"];

/** The Sun, as the reference point: G2V, B-V 0.65, magnitude -26.74, 1 astronomical unit away. Its figures are the IAU's, the same ones the package's profile tests use. */
export const SUN: ProfileInput = { magnitude: -26.74, colourIndex: 0.65, spectralType: "G2V", luminosityClass: "V", parallaxMas: 206_264_806.2, parallaxErrorMas: 1, parallaxSource: "GCTP" };

export interface HrPoint {
  /** The star's Bright Star Catalogue number, or 0 for the Sun. */
  hr: number;
  /** Across: B-V, or log10 of the temperature in kelvin. */
  x: number;
  /** Up: absolute magnitude (smaller is brighter), or log10 of the luminosity in solar luminosities. */
  y: number;
}

/**
 * Where an object lies on the axes, or `undefined` where its numbers are missing (no colour, no parallax, or no temperature or luminosity from the profile).
 *
 * @example
 * ```ts
 * const sun = place(SUN, "colour"); // { x: 0.65, y: 4.83 }
 * ```
 */
export function place(star: ProfileInput, axes: Axes): { x: number; y: number } | undefined {
  if (axes === "colour") {
    const magnitude = absoluteMagnitude(star);
    return star.colourIndex === undefined || magnitude === undefined ? undefined : { x: star.colourIndex, y: magnitude };
  }
  const profile = starProfile(star);
  if (profile.temperature === undefined || profile.luminosity === undefined || !(profile.luminosity.value > 0)) return undefined;
  return { x: Math.log10(profile.temperature.value), y: Math.log10(profile.luminosity.value) };
}

/** Whether a star is shown under a filter. */
export function shown(star: Star, show: Show): boolean {
  const minimum: StarGrade = show === "a" ? "A" : "B";
  return gradeAtLeast(starGrade(star), minimum) && (show !== "named" || star.name !== undefined);
}

/** The stars of the graded set (A and B by default) that have both numbers on these axes, with where each lies. */
export function hrPoints(axes: Axes, show: Show = "graded"): HrPoint[] {
  const out: HrPoint[] = [];
  for (const star of stars({ minGrade: "B" })) {
    if (!shown(star, show)) continue;
    const at = place(star, axes);
    if (at !== undefined) out.push({ hr: star.hr, ...at });
  }
  return out;
}

export interface Tick {
  value: number;
  label: string;
}
export interface Scale {
  min: number;
  max: number;
  ticks: Tick[];
}

const compact = (n: number): string => (n >= 1000 ? `${n / 1000}k` : String(n));
const power = (n: number): string => (n >= 0 && n <= 3 ? String(10 ** n) : n < 0 && n >= -3 ? String(10 ** n) : `10^${n}`);

/** The drawn range and the labelled ticks of one axis, wide enough for every point and its ticks at whole numbers (or half magnitudes of colour). */
export function scaleOf(axes: Axes, axis: "x" | "y", values: readonly number[]): Scale {
  const low = values.length === 0 ? 0 : Math.min(...values);
  const high = values.length === 0 ? 1 : Math.max(...values);
  if (axes === "colour" && axis === "x") {
    const min = Math.floor((low - 0.05) * 2) / 2;
    const max = Math.ceil((high + 0.05) * 2) / 2;
    return { min, max, ticks: range(min, max, 0.5).map((value) => ({ value, label: value.toFixed(1) })) };
  }
  if (axes === "colour") {
    const min = Math.floor((low - 0.5) / 2) * 2;
    const max = Math.ceil((high + 0.5) / 2) * 2;
    return { min, max, ticks: range(min, max, 2).map((value) => ({ value, label: String(value) })) };
  }
  if (axis === "x") {
    const min = Math.log10(2500);
    const max = Math.max(Math.log10(30_000), Math.ceil(high * 10) / 10);
    return { min: Math.min(min, Math.floor(low * 10) / 10), max, ticks: [3000, 5000, 10_000, 20_000].map((k) => ({ value: Math.log10(k), label: compact(k) })) };
  }
  const min = Math.floor(low - 0.25);
  const max = Math.ceil(high + 0.25);
  return { min, max, ticks: range(min, max, max - min > 8 ? 2 : 1).map((value) => ({ value, label: power(value) })) };
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let value = from; value <= to + 1e-9; value += step) out.push(Math.round(value * 100) / 100);
  return out;
}
