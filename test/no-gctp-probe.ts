// What the package says on one build, as JSON on stdout: the child that test/no-gctp.test.ts runs twice, once on the Yale GCTP data and once on the fallback (HOSHI_NO_GCTP=0 and =1, with
// `node --import ./scripts/data-source-hook.mjs`). It is not a test: it only reads and reports, and counts whatever throws or comes out as NaN.
import { createHash } from "node:crypto";
import { constellationIn3D, distanceQualityTable } from "../src/constellation-3d.ts";
import { nearbyStarByName, nearbyStars } from "../src/nearby.ts";
import { nearest } from "../src/nearest.ts";
import { starComparison, starPortrait } from "../src/portrait.ts";
import { starProfile, type Estimate } from "../src/profile.ts";
import { skyFrom } from "../src/sky-from.ts";
import { skyFromWithNearby } from "../src/sky-from-nearby.ts";
import { starByHr, starByName, starDistance, stars } from "../src/stars.ts";

/** The named stars of test/no-gctp.test.ts: the two that lose their distance and the eight whose distance moves most, then the ones people look for first. */
export const NAMED = ["Mimosa", "Nunki", "Marfik", "Betelgeuse", "Pherkad", "Miram", "Saclateni", "Azmidi", "Brachium", "Tianguan", "Sirius", "Alioth", "Procyon", "Vega", "Rigel"];

let nan = 0;
let thrown = 0;
const problems: string[] = [];
/** Counts every NaN in a value, however deep. A text is searched for the word. */
function scan(value: unknown, where: string): void {
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      nan++;
      if (problems.length < 20) problems.push(`NaN in ${where}`);
    }
  } else if (typeof value === "string") {
    if (/NaN|undefined|\[object/.test(value)) {
      nan++;
      if (problems.length < 20) problems.push(`NaN or undefined in the text of ${where}`);
    }
  } else if (Array.isArray(value)) value.forEach((one, i) => scan(one, `${where}[${i}]`));
  else if (value !== null && typeof value === "object") for (const [key, one] of Object.entries(value)) if (key !== "star") scan(one, `${where}.${key}`);
}
function attempt<T>(where: string, make: () => T): T | undefined {
  try {
    const made = make();
    scan(made, where);
    return made;
  } catch (error) {
    thrown++;
    if (problems.length < 20) problems.push(`${where} threw ${String(error)}`);
    return undefined;
  }
}
const round = (x: number | undefined, digits = 4): number | null => (x === undefined ? null : Number.isFinite(x) ? Number(x.toFixed(digits)) : x > 0 ? 1e99 : -1e99);
const estimate = (e: Estimate | undefined): { value: number | null; error: number | null; low: number | null; high: number | null } | null =>
  e === undefined ? null : { value: round(e.value, 3), error: round(e.error, 3), low: round(e.range[0], 3), high: round(e.range[1], 3) };

const all = stars();
const bySource: Record<string, number> = {};
let withDistance = 0;
let withError = 0;
let unknownRadius = 0;
let unknownLuminosity = 0;
let radiusFromParallax = 0;
let portraits = 0;
let comparisons = 0;
const fixed = createHash("sha256");
const reasons: Record<string, number> = {};
for (const star of all) {
  bySource[star.parallaxSource ?? "none"] = (bySource[star.parallaxSource ?? "none"] ?? 0) + 1;
  // Everything about a star except its parallax, its error and its source: the fallback must not touch any of it.
  const { parallaxMas, parallaxErrorMas, parallaxSource, ...rest } = star;
  void parallaxMas;
  void parallaxErrorMas;
  void parallaxSource;
  fixed.update(JSON.stringify(rest));
  const distance = attempt(`starDistance(HR ${star.hr})`, () => starDistance(star));
  if (distance !== undefined) withDistance++;
  if (distance?.lightYearsError !== undefined) withError++;
  const profile = attempt(`starProfile(HR ${star.hr})`, () => starProfile(star));
  if (profile === undefined) continue;
  if (profile.radius === undefined) unknownRadius++;
  else if (profile.radius.basis === "parallax") radiusFromParallax++;
  if (profile.luminosity === undefined) {
    unknownLuminosity++;
    const why = profile.unknown.luminosity ?? "none given";
    reasons[why] = (reasons[why] ?? 0) + 1;
  }
  if (attempt(`starPortrait(HR ${star.hr})`, () => starPortrait(profile, { name: star.name ?? star.designation ?? String(star.hr) })) !== undefined) portraits++;
  if (attempt(`starComparison(HR ${star.hr})`, () => starComparison(profile, { name: star.name ?? String(star.hr), lang: "ja" })) !== undefined) comparisons++;
}

const named = NAMED.map((name) => {
  const star = starByName(name)!;
  const distance = starDistance(star);
  const profile = starProfile(star);
  return {
    name,
    hr: star.hr,
    parallaxMas: star.parallaxMas,
    parallaxErrorMas: star.parallaxErrorMas ?? null,
    parallaxSource: star.parallaxSource ?? null,
    lightYears: round(distance?.lightYears, 1),
    lightYearsError: round(distance?.lightYearsError, 1),
    lightYearsRange: distance?.lightYearsRange === undefined ? null : distance.lightYearsRange.map((x) => round(x, 1)),
    luminosity: estimate(profile.luminosity),
    radius: profile.radius === undefined ? null : { ...estimate(profile.radius), basis: profile.radius.basis },
    unknown: profile.unknown,
  };
});

const space = (name: string): unknown =>
  attempt(`nearest(${name}, by space)`, () => {
    const found = nearest(name, { by: "space", count: 5 });
    return { skipped: found.skipped, rows: found.map((one) => ({ hr: one.thing.hr, distance: round(one.distance, 2), error: round(one.error, 2) })) };
  });
const sky = (name: string, among: "bright" | "nearby"): unknown =>
  attempt(`sky from ${name} (${among})`, () => {
    const seen = among === "bright" ? skyFrom(name, { magnitude: 3 }) : skyFromWithNearby(name, { magnitude: 3 });
    return { count: seen.length, skipped: seen.skipped, first: seen.slice(0, 3).map((one) => ({ id: one.id, magnitude: round(one.magnitude, 2), lightYears: round(one.lightYears, 2) })) };
  });
let unknownNameError: string | null = null;
try {
  skyFromWithNearby("Proxima Centauri");
} catch (error) {
  unknownNameError = `${(error as Error).name}: ${(error as Error).message}`;
}
const nearbyAll = nearbyStars();
// The constellation in 3D: how well each star's distance is known, counted over all 88 figures, and two figures whole.
const qualities = { good: 0, fair: 0, rough: 0, none: 0 };
const table = attempt("distanceQualityTable()", () => distanceQualityTable()) ?? [];
for (const row of table) for (const key of Object.keys(qualities) as (keyof typeof qualities)[]) qualities[key] += row.counts[key];
const figure3d = (abbreviation: string): unknown =>
  attempt(`constellationIn3D(${abbreviation})`, () => {
    const found = constellationIn3D(abbreviation);
    return { stars: found.stars.length, counts: found.counts, placed: found.stars.filter((one) => one.position !== undefined).length, errors: found.stars.filter((one) => one.range !== undefined).length };
  });
const output = {
  stars: all.length,
  bySource,
  withDistance,
  withError,
  unknownRadius,
  unknownLuminosity,
  radiusFromParallax,
  luminosityReasons: reasons,
  portraits,
  comparisons,
  fixedDigest: fixed.digest("hex"),
  named,
  nearby: {
    count: nearbyAll.length,
    withDistance: nearbyStars({ withDistance: true }).length,
    tight: nearbyStars({ maxRelativeError: 0.05, withDistance: true, magnitude: 10 }).length,
    proxima: nearbyStarByName("Proxima Centauri")?.lightYears ?? null,
    barnard: nearbyStarByName("Barnard's Star")?.lightYears ?? null,
    unknownNameError,
  },
  space: { sirius: space("Sirius"), alioth: space("Alioth"), betelgeuse: space("Betelgeuse") },
  skies: { sirius: sky("Sirius", "bright"), siriusNearby: sky("Sirius", "nearby"), rigil: sky("Rigil Kentaurus", "nearby") },
  qualities,
  figures3d: { UMa: figure3d("UMa"), Ori: figure3d("Ori") },
  bright30ly: all.filter((star) => (starDistance(star)?.lightYears ?? Infinity) <= 30).length,
  bright50ly: all.filter((star) => (starDistance(star)?.lightYears ?? Infinity) <= 50).length,
  hr2491: starByHr(2491)?.name ?? null,
  nan,
  thrown,
  problems,
};
console.log(JSON.stringify(output));
