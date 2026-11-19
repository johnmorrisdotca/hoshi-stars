// The catalogue: the bright stars by default, the nearby and faint layers when handed in, every star once under an id that stays the same, the known pairs and close systems on the right side, the counts by tier and grade, and the options.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { starGrade } from "../src/accuracy.ts";
import { CATALOGUE_LAYERS, catalogueCounts, catalogueId, catalogueStar, catalogueStars } from "../src/catalogue.ts";
import { faintLayer, NEARBY_IN_FAINT, nearbyIdOfFaint } from "../src/catalogue-faint.ts";
import { nearbyLayer } from "../src/catalogue-nearby.ts";
import { decodeFaintTile, faintStarsIn, faintTilePath, faintTilesFor, type FaintField } from "../src/faint-core.ts";
import { nearbyStarByName, nearbyStars } from "../src/nearby.ts";
import { starByName, starDistance, stars } from "../src/stars.ts";

const RADIANS = Math.PI / 180;
const arcsecBetween = (a: { rightAscension: number; declination: number }, b: { rightAscension: number; declination: number }): number => {
  const cos = Math.sin(a.declination * RADIANS) * Math.sin(b.declination * RADIANS) + Math.cos(a.declination * RADIANS) * Math.cos(b.declination * RADIANS) * Math.cos((a.rightAscension - b.rightAscension) * RADIANS);
  return (Math.acos(Math.min(1, cos)) / RADIANS) * 3600;
};
const faintStarsOf = (field: FaintField) =>
  faintStarsIn(
    faintTilesFor(field).map((id) => {
      const file = new URL(`../faint-tiles/${faintTilePath(id)}`, import.meta.url);
      return decodeFaintTile(id, existsSync(file) ? new Uint8Array(readFileSync(file)) : new Uint8Array(0));
    }),
    field,
  ).stars;
const both = ["bright", nearbyLayer] as const;

test("the default is the bright stars alone, brightest first", () => {
  const all = catalogueStars();
  assert.equal(all.length, 5080);
  assert.ok(all.every((one) => one.layer === "bright"));
  assert.deepEqual(all.slice(0, 3).map((one) => one.name), ["Sirius", "Canopus", "Arcturus"]);
  assert.deepEqual(CATALOGUE_LAYERS, ["bright", "nearby", "faint"]);
  assert.strictEqual(catalogueStars()[0], all[0], "the records are shared");
  assert.ok(Object.isFrozen(all[0]));
});

test("with the nearby layer, every star of both tiers once, brightest first", () => {
  const all = catalogueStars({ layers: both });
  assert.equal(all.length, stars().length + nearbyStars().length);
  assert.equal(all.length, 10646);
  assert.equal(new Set(all.map((one) => one.id)).size, all.length);
  const magnitudes = all.map((one) => one.magnitude ?? Number.POSITIVE_INFINITY);
  assert.ok(magnitudes.every((m, i) => i === 0 || magnitudes[i - 1]! <= m));
  assert.equal(all.filter((one) => one.magnitude === undefined).length, 7);
  assert.equal(nearbyLayer.stars().length, 5566);
  assert.strictEqual(nearbyLayer.stars(), nearbyLayer.stars());
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
  const proxima = catalogueStar("gctp-3278", { layers: both })!;
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
    const entry = catalogueStar(star.id, { layers: [nearbyLayer] })!;
    assert.equal(entry.layer, "nearby", name);
    assert.equal(entry.star, star, name);
  }
});

test("61 Cygni B (HR 8086, V 6.03) is in the nearby tier, once, with its system's parallax", () => {
  assert.equal(starByName("61 Cyg")!.hr, 8085);
  assert.ok(stars().every((star) => star.hr !== 8086 && star.hd !== 201092), "fainter than the bright tier's 6.0");
  const found = catalogueStars({ layers: both }).filter((one) => one.hd === 201092);
  assert.deepEqual(found.map((one) => [one.id, one.layer, one.magnitude]), [["gctp-5077", "nearby", 6.03]]);
  assert.equal(catalogueStars({ layers: both }).filter((one) => one.id === "gctp-5077").length, 1);
  const a = catalogueStar("hr-8085")!;
  const b = catalogueStar("gctp-5077", { layers: both })!;
  assert.equal(b.distance!.lightYears, a.distance!.lightYears);
  assert.equal(b.grade, "A");
  // the faint tiles hold no star of its position and brightness, so no copy of it is left to count
  const near = faintStarsOf({ rightAscension: b.rightAscension, declination: b.declination, radius: 0.01 });
  assert.equal(near.filter((star) => star.magnitude < 8).length, 0);
});

test("each record carries the tier's values, its grade and its distance", () => {
  const sirius = catalogueStar("HR-2491")!;
  const star = starByName("Sirius")!;
  assert.deepEqual(
    [sirius.id, sirius.name, sirius.designation, sirius.hd, sirius.rightAscension, sirius.declination, sirius.magnitude, sirius.grade, sirius.sameAs],
    ["hr-2491", "Sirius", star.designation, star.hd, star.rightAscension, star.declination, star.magnitude, "A", undefined],
  );
  assert.deepEqual(sirius.distance, starDistance(star));
  for (const one of catalogueStars({ layers: both })) {
    assert.equal(one.grade, starGrade(one.star));
    assert.equal(one.id, catalogueId(one.star));
  }
  assert.equal(catalogueStar(`hr-${starByName("Alnilam")!.hr}`)!.distance, undefined);
});

test("catalogueStar finds by id only, among the layers asked for", () => {
  assert.equal(catalogueId(starByName("Vega")!), "hr-7001");
  assert.equal(catalogueId(nearbyStarByName("Proxima Centauri")!), "gctp-3278");
  assert.equal(catalogueStar("gctp-3278"), undefined, "not without the nearby layer");
  for (const id of ["hr-0", "hr-9999", "gctp-0", "Sirius", "HR 2491", "hr-02491", "gctp-3278x", ""]) assert.equal(catalogueStar(id, { layers: both }), undefined, id);
  assert.equal(catalogueStar(" gctp-4098 ", { layers: both })!.name, "Barnard's Star");
  for (const star of nearbyStars().slice(0, 500)) assert.equal(catalogueStar(star.id, { layers: [nearbyLayer] })!.star, star);
});

test("the faint layer: grade C, an id from its position, and a nearby star counted once", () => {
  const ad = nearbyStarByName("AD Leonis")!;
  const field = { rightAscension: ad.rightAscension, declination: ad.declination, radius: 0.2 };
  const faint = faintStarsOf(field);
  const layer = faintLayer(faint);
  assert.equal(layer.layer, "faint");
  assert.equal(layer.stars().length, faint.length);
  assert.ok(layer.stars().every((one) => one.layer === "faint" && one.grade === "C" && one.distance === undefined && one.id.startsWith("faint-")));
  const same = layer.stars().filter((one) => one.sameAs !== undefined);
  assert.deepEqual(same.map((one) => one.sameAs), [ad.id]);
  assert.equal(nearbyIdOfFaint(same[0]!.star), ad.id);
  assert.equal(catalogueStar(same[0]!.id, { layers: [layer] }), same[0]);
  // with the nearby layer the faint copy is left out, without it the faint star stays
  const all = catalogueStars({ layers: ["bright", nearbyLayer, layer] });
  assert.equal(all.filter((one) => one.id === ad.id || one.id === same[0]!.id).length, 1);
  assert.equal(catalogueStars({ layers: ["bright", layer] }).filter((one) => one.layer === "faint").length, faint.length);
  const counts = catalogueCounts({ layers: ["bright", nearbyLayer, layer] });
  assert.deepEqual(counts.map((count) => [count.layer, count.stars]), [["bright", 5080], ["nearby", 5566], ["faint", faint.length - 1]]);
  assert.deepEqual(counts[2]!.grades, { A: 0, B: 0, C: faint.length - 1 });
  assert.equal(catalogueStars({ layers: [layer], minGrade: "B" }).length, 0);
  assert.equal(NEARBY_IN_FAINT.matched, 2135);
  assert.throws(() => faintLayer(5 as never), TypeError);
});

test("the options: layers, magnitude and minGrade, and what a bad one throws", () => {
  assert.equal(catalogueStars({ layers: ["bright"] }).length, 5080);
  assert.equal(catalogueStars({ layers: [nearbyLayer] }).length, 5566);
  assert.equal(catalogueStars({ layers: [] }).length, 0);
  assert.equal(catalogueStars({ layers: both, magnitude: 2 }).length, stars({ magnitude: 2 }).length + nearbyStars({ magnitude: 2 }).length);
  const sure = catalogueStars({ layers: both, minGrade: "A" });
  assert.equal(sure.length, 68 + 237);
  assert.ok(sure.every((one) => one.grade === "A"));
  assert.equal(catalogueStars({ layers: both, minGrade: "B" }).length, 68 + 452 + 237 + 1281);
  assert.throws(() => catalogueStars({ layers: "bright" as never }), TypeError);
  assert.throws(() => catalogueStars({ layers: ["nearby" as never] }), /the nearby layer loads on request: pass nearbyLayer from @johnmorrisdotca\/hoshi-stars\/catalogue\/nearby/);
  assert.throws(() => catalogueStars({ layers: ["faint" as never] }), /pass faintLayer\(stars\) from @johnmorrisdotca\/hoshi-stars\/catalogue\/faint/);
  assert.throws(() => catalogueStars({ layers: ["bright", "bright"] }), /the bright layer twice/);
  assert.throws(() => catalogueStars({ layers: [{} as never] }), RangeError);
  assert.throws(() => catalogueStars({ minGrade: "D" as never }), /minGrade must be "A", "B" or "C", got D/);
  assert.throws(() => catalogueStars({ magnitude: "6" as never }), TypeError);
});

test("catalogueCounts: the headline counts by tier and grade", () => {
  assert.deepEqual(catalogueCounts(), [{ layer: "bright", stars: 5080, grades: { A: 68, B: 452, C: 4560 } }]);
  assert.deepEqual(catalogueCounts({ layers: both }), [
    { layer: "bright", stars: 5080, grades: { A: 68, B: 452, C: 4560 } },
    { layer: "nearby", stars: 5566, grades: { A: 237, B: 1281, C: 4048 } },
  ]);
});
