// The catalogue of both tiers: every star once under an id that stays the same, the known pairs and close systems on the right side, the counts by tier and grade, and the options.
import assert from "node:assert/strict";
import { test } from "node:test";
import { starGrade } from "../src/accuracy.ts";
import { CATALOGUE_LAYERS, catalogueCounts, catalogueId, catalogueStar, catalogueStars } from "../src/catalogue.ts";
import { nearbyStarByName, nearbyStars } from "../src/nearby.ts";
import { starByName, starDistance, stars } from "../src/stars.ts";

const RADIANS = Math.PI / 180;
const arcsecBetween = (a: { rightAscension: number; declination: number }, b: { rightAscension: number; declination: number }): number => {
  const cos = Math.sin(a.declination * RADIANS) * Math.sin(b.declination * RADIANS) + Math.cos(a.declination * RADIANS) * Math.cos(b.declination * RADIANS) * Math.cos((a.rightAscension - b.rightAscension) * RADIANS);
  return (Math.acos(Math.min(1, cos)) / RADIANS) * 3600;
};

test("catalogueStars holds every star of both tiers once, brightest first", () => {
  const all = catalogueStars();
  assert.equal(all.length, stars().length + nearbyStars().length);
  assert.equal(all.length, 10645);
  assert.equal(new Set(all.map((one) => one.id)).size, all.length);
  assert.deepEqual(CATALOGUE_LAYERS, ["bright", "nearby"]);
  assert.deepEqual(all.slice(0, 3).map((one) => one.name), ["Sirius", "Canopus", "Arcturus"]);
  const magnitudes = all.map((one) => one.magnitude ?? Number.POSITIVE_INFINITY);
  assert.ok(magnitudes.every((m, i) => i === 0 || magnitudes[i - 1]! <= m));
  assert.equal(all.filter((one) => one.magnitude === undefined).length, 7);
  assert.strictEqual(catalogueStars()[0], all[0], "the records are shared");
  assert.ok(Object.isFrozen(all[0]));
});

test("the two tiers never hold the same star: no HD number twice, no pair within 15 arc-seconds and a magnitude unless flagged", () => {
  const bright = stars();
  const hd = new Set(bright.map((star) => star.hd).filter((n) => n !== undefined));
  assert.equal(nearbyStars().filter((star) => star.hd !== undefined && hd.has(star.hd)).length, 0);
  let close = 0;
  for (const star of nearbyStars()) {
    for (const other of bright) {
      if (Math.abs(star.declination - other.declination) > 0.01) continue;
      if (arcsecBetween(star, other) < 15 && (star.magnitude === undefined || Math.abs(star.magnitude - other.magnitude) <= 1) && !star.flags.ambiguousMatch) close += 1;
    }
  }
  assert.equal(close, 0);
});

test("known pairs and close systems: each star in one tier, under its own id", () => {
  const rigil = catalogueStar("hr-5459")!;
  const toliman = catalogueStar("hr-5460")!;
  const proxima = catalogueStar("gctp-3278")!;
  assert.deepEqual([rigil.name, rigil.layer, toliman.name, toliman.layer, proxima.name, proxima.layer], ["Rigil Kentaurus", "bright", "Toliman", "bright", "Proxima Centauri", "nearby"]);
  // a pair shares the system's parallax (NOTICE.md), so Alpha Centauri A and B are at one distance and Proxima at its own
  assert.equal(rigil.distance!.lightYears, toliman.distance!.lightYears);
  assert.ok(Math.abs(proxima.distance!.lightYears - 4.24) < 0.01);
  for (const name of ["61 Cyg", "Sirius", "Procyon", "Mizar", "Alcor"]) {
    const star = starByName(name)!;
    assert.equal(catalogueStar(catalogueId(star))!.star, star, name);
    assert.equal(catalogueStar(catalogueId(star))!.layer, "bright", name);
  }
  for (const name of ["Barnard's Star", "Wolf 359", "Lalande 21185", "Ross 154"]) {
    const star = nearbyStarByName(name)!;
    const entry = catalogueStar(star.id)!;
    assert.equal(entry.layer, "nearby", name);
    assert.equal(entry.star, star, name);
  }
});

test("each record carries the tier's values, its grade and its distance", () => {
  const sirius = catalogueStar("HR-2491")!;
  const star = starByName("Sirius")!;
  assert.deepEqual(
    [sirius.id, sirius.name, sirius.designation, sirius.hd, sirius.rightAscension, sirius.declination, sirius.magnitude, sirius.grade],
    ["hr-2491", "Sirius", star.designation, star.hd, star.rightAscension, star.declination, star.magnitude, "A"],
  );
  assert.deepEqual(sirius.distance, starDistance(star));
  for (const one of catalogueStars()) {
    assert.equal(one.grade, starGrade(one.star));
    assert.equal(one.id, catalogueId(one.star));
  }
  const noParallax = catalogueStar(`hr-${starByName("Alnilam")!.hr}`)!;
  assert.equal(noParallax.distance, undefined);
});

test("catalogueStar finds by id only, and catalogueId gives it", () => {
  assert.equal(catalogueId(starByName("Vega")!), "hr-7001");
  assert.equal(catalogueId(nearbyStarByName("Proxima Centauri")!), "gctp-3278");
  for (const id of ["hr-0", "hr-9999", "gctp-0", "Sirius", "HR 2491", "hr-02491", "gctp-3278x", ""]) assert.equal(catalogueStar(id), undefined, id);
  assert.equal(catalogueStar(" gctp-4098 ")!.name, "Barnard's Star");
  for (const star of nearbyStars().slice(0, 500)) assert.equal(catalogueStar(star.id)!.star, star);
});

test("the options: layers, magnitude and minGrade, and what a bad one throws", () => {
  assert.equal(catalogueStars({ layers: ["bright"] }).length, 5080);
  assert.equal(catalogueStars({ layers: ["nearby"] }).length, 5565);
  assert.equal(catalogueStars({ layers: [] }).length, 0);
  assert.equal(catalogueStars({ magnitude: 2 }).length, stars({ magnitude: 2 }).length + nearbyStars({ magnitude: 2 }).length);
  const sure = catalogueStars({ minGrade: "A" });
  assert.equal(sure.length, 68 + 236);
  assert.ok(sure.every((one) => one.grade === "A"));
  assert.equal(catalogueStars({ minGrade: "B" }).length, 68 + 452 + 236 + 1281);
  assert.throws(() => catalogueStars({ layers: "bright" as never }), TypeError);
  assert.throws(() => catalogueStars({ layers: ["faint" as never] }), /layers must hold only "bright" and "nearby", got faint/);
  assert.throws(() => catalogueStars({ minGrade: "D" as never }), /minGrade must be "A", "B" or "C", got D/);
  assert.throws(() => catalogueStars({ magnitude: "6" as never }), TypeError);
});

test("catalogueCounts: the headline counts by tier and grade", () => {
  assert.deepEqual(catalogueCounts(), [
    { layer: "bright", stars: 5080, grades: { A: 68, B: 452, C: 4560 } },
    { layer: "nearby", stars: 5565, grades: { A: 236, B: 1281, C: 4048 } },
  ]);
});
