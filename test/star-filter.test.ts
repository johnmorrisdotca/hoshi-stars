// The star filters: the rule for a star (a distance range, a faintest magnitude, a star with no known distance), the text of the attributes and the steps of the bars, the bright stars it keeps, and what the chart and the star names do with it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chartSvg } from "../src/chart/index.ts";
import { brightCount, brightShown, brightWithoutDistance } from "../src/star-filter-bright.ts";
import { starFilterWords } from "../src/star-filter-bar.ts";
import {
  distanceNarrowed,
  distanceOfStep,
  distanceStep,
  DISTANCE_STOPS,
  magnitudeOfStep,
  magnitudeStep,
  MAGNITUDE_STOPS,
  normaliseStarFilter,
  STAR_FILTER_ATTRIBUTES,
  starFilterActive,
  starFilterFromText,
  starFilterKey,
  starFilterToText,
  starPasses,
} from "../src/star-filter.ts";
import { createStarNames } from "../src/star-names.ts";
import { starByName, stars } from "../src/stars.ts";

test("a star passes when it is bright enough and, if the distance is narrowed, known and inside the range, ends included", () => {
  const near = normaliseStarFilter({ distanceMax: 20, magnitudeLimit: 3 });
  assert.equal(starPasses(near, -1.46, 8.6), true);
  assert.equal(starPasses(near, 0.03, 25), false);
  assert.equal(starPasses(near, 3.5, 10), false);
  assert.equal(starPasses(near, 3, 20), true);
  const shell = normaliseStarFilter({ distanceMin: 100, distanceMax: 200 });
  assert.deepEqual([50, 100, 150, 200, 250].map((ly) => starPasses(shell, 2, ly)), [false, true, true, true, false]);
});

test("a star with no known distance is shown only while the distance is not narrowed", () => {
  assert.equal(starPasses({}, 5, undefined), true);
  assert.equal(starPasses({ magnitudeLimit: 6 }, 5, undefined), true);
  assert.equal(starPasses({ distanceMax: 1000 }, 5, undefined), false);
  assert.equal(starPasses({ distanceMin: 10 }, 5, undefined), false);
  assert.equal(starPasses({ distanceMax: 1000 }, 5, 0), false);
  assert.equal(distanceNarrowed({ magnitudeLimit: 3 }), false);
  assert.equal(distanceNarrowed({ distanceMin: 3 }), true);
});

test("a filter is made well: no limit for 0, Infinity or a word, short numbers, and a nearest above the farthest shows nothing", () => {
  assert.deepEqual({ ...normaliseStarFilter({ distanceMin: 0, distanceMax: Infinity, magnitudeLimit: Number.NaN }) }, {});
  assert.deepEqual({ ...normaliseStarFilter({ distanceMax: 123.456, magnitudeLimit: 4.555 }) }, { distanceMax: 123, magnitudeLimit: 4.56 });
  assert.equal(starFilterActive({}), false);
  assert.equal(starFilterActive({ magnitudeLimit: -2 }), true);
  const empty = normaliseStarFilter({ distanceMin: 200, distanceMax: 100 });
  assert.equal(stars().filter((star) => brightShown(empty)!.has(star.hr)).length, 0);
});

test("the attributes' text is read and written the same way, and a missing or worded limit is no limit", () => {
  assert.deepEqual({ ...starFilterFromText("20", "any", "4.5") }, { distanceMin: 20, magnitudeLimit: 4.5 });
  assert.deepEqual({ ...starFilterFromText(null, "", "off") }, {});
  assert.deepEqual({ ...starFilterFromText("far", "-5", "faint") }, {});
  assert.deepEqual(starFilterToText({ distanceMax: 100, magnitudeLimit: 4.5 }), { distanceMin: null, distanceMax: "100", magnitudeLimit: "4.5" });
  for (const filter of [{ distanceMin: 10, distanceMax: 500 }, { magnitudeLimit: 5.5 }, { distanceMax: 33.3, magnitudeLimit: -1 }]) {
    const text = starFilterToText(filter);
    assert.deepEqual({ ...starFilterFromText(text.distanceMin, text.distanceMax, text.magnitudeLimit) }, filter);
    assert.ok(Object.values(text).every((value) => value === null || value.length <= 5));
  }
  assert.deepEqual(Object.values(STAR_FILTER_ATTRIBUTES), ["distance-min", "distance-max", "magnitude-limit", "filter-bar"]);
  assert.equal(starFilterKey({}), "");
  assert.notEqual(starFilterKey({ distanceMax: 100 }), starFilterKey({ distanceMin: 100 }));
});

test("the bars' steps give back the limit they stand for, and the ends are no limit", () => {
  const last = DISTANCE_STOPS.length - 1;
  assert.equal(distanceOfStep(0, "min"), undefined);
  assert.equal(distanceOfStep(last, "max"), undefined);
  for (let step = 1; step < last; step += 1) assert.equal(distanceStep(distanceOfStep(step, "max"), "max"), step);
  for (let step = 1; step < last; step += 1) assert.equal(distanceStep(distanceOfStep(step, "min"), "min"), step);
  assert.equal(distanceStep(undefined, "min"), 0);
  assert.equal(distanceStep(undefined, "max"), last);
  for (let step = 0; step < MAGNITUDE_STOPS.length; step += 1) assert.equal(magnitudeStep(magnitudeOfStep(step)), step);
  assert.equal(magnitudeOfStep(MAGNITUDE_STOPS.length), undefined);
  assert.equal(magnitudeStep(undefined), MAGNITUDE_STOPS.length);
});

test("the bars say their value in English and in Japanese", () => {
  assert.deepEqual(starFilterWords({ distanceMax: 1000, magnitudeLimit: 4.5 }, "en"), { nearest: "any", farthest: "1,000 ly", brightness: "4.5 mag" });
  assert.deepEqual(starFilterWords({ distanceMin: 20 }, "ja"), { nearest: "20光年", farthest: "すべて", brightness: "すべて" });
});

test("the bright stars kept are worked out once for a filter, and every one passes the rule", () => {
  assert.equal(brightShown({}), undefined);
  const filter = normaliseStarFilter({ distanceMax: 50, magnitudeLimit: 5 });
  const kept = brightShown(filter)!;
  assert.equal(brightShown(normaliseStarFilter({ distanceMax: 50, magnitudeLimit: 5 })), kept);
  assert.equal(kept.total, stars().length);
  assert.ok(kept.shown > 20 && kept.shown < 400);
  assert.equal(kept.mask.reduce((sum, bit) => sum + bit, 0), kept.shown);
  assert.equal(kept.has(starByName("Sirius")!.hr), true);
  assert.equal(kept.has(starByName("Betelgeuse")!.hr), false);
  for (const star of stars()) assert.ok(star.magnitude <= 5 || !kept.has(star.hr));
  assert.ok(brightWithoutDistance() > 0);
  assert.deepEqual(brightCount(filter), { shown: kept.shown, total: stars().length, noDistance: brightWithoutDistance() });
  assert.equal(brightCount({}).shown, stars().length);
});

const count = (svg: string, tag: string): number => (svg.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;

test("on the chart only star dots and star names are filtered: the lines and the figures' names stay", () => {
  const all = chartSvg({ width: 640, height: 400, constellation: "Ori", layers: ["lines", "names"] });
  const near = chartSvg({ width: 640, height: 400, constellation: "Ori", layers: ["lines", "names"], distanceMax: 100 });
  assert.ok(count(near, "circle") < count(all, "circle") / 2);
  assert.equal(count(near, "path"), count(all, "path"));
  assert.ok(count(near, "text") < count(all, "text"));
  assert.ok(count(near, "text") > 0);
  const lines = (svg: string) => svg.match(/<path [^>]*stroke="#6f93e0"[^>]*>/g) ?? [];
  assert.deepEqual(lines(near), lines(all));
});

test("a magnitude limit is a hard limit that zooming in does not lift, and no limit is the same picture as before", () => {
  const base = { width: 640, height: 400, constellation: "Ori", zoom: 40 } as const;
  const open = chartSvg(base);
  assert.equal(chartSvg({ ...base, distanceMax: undefined, distanceMin: 0, magnitudeLimit: undefined }), open);
  const limited = chartSvg({ ...base, magnitudeLimit: 3 });
  assert.ok(count(limited, "circle") < count(open, "circle"));
  assert.ok(count(chartSvg({ ...base, magnitudeLimit: 5 }), "circle") > count(limited, "circle"));
});

test("a distance range keeps the shell asked for", () => {
  const base = { width: 640, height: 400, layers: [] as never[], projection: "mollweide" as const, zoom: 1, magnitude: 6 };
  const everything = count(chartSvg(base), "circle");
  const inside = count(chartSvg({ ...base, distanceMax: 100 }), "circle");
  const shell = count(chartSvg({ ...base, distanceMin: 100, distanceMax: 1000 }), "circle");
  const beyond = count(chartSvg({ ...base, distanceMin: 1000 }), "circle");
  assert.ok(inside > 0 && shell > 0 && beyond > 0);
  assert.ok(inside + shell + beyond <= everything);
});

test("star names leave out a star the page's include says no to, and only name the others", () => {
  const spot = { x: 0, y: 0 };
  const view = { width: 800, height: 600 };
  const project = (_ra: number, _dec: number, out: { x: number; y: number }): boolean => {
    out.x = 100 + (spot.x += 37) % 600;
    out.y = 100 + (spot.y += 61) % 400;
    return true;
  };
  const sirius = starByName("Sirius")!;
  const all = createStarNames({ count: 30 });
  all.update(project, view);
  assert.ok(all.labels.some((label) => label.hr === sirius.hr));
  const without = createStarNames({ count: 30, include: (star) => star.hr !== sirius.hr });
  without.update(project, view);
  assert.ok(without.labels.length > 0);
  assert.ok(without.labels.every((label) => label.hr !== sirius.hr));
});
