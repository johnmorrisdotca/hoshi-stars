// The exoplanet-host table: TRAPPIST-1 and its seven planets, Proxima Centauri's, the rule for who is in, a source on every value, and that none of the star's values is the Archive's (Gaia and Hipparcos).
import assert from "node:assert/strict";
import { test } from "node:test";
import { EXOPLANET_HOST_ROWS } from "../src/data/exoplanet-hosts.ts";
import { EXOPLANET_ARCHIVE_ACKNOWLEDGEMENT, EXOPLANET_HOST_LIMIT_LY, exoplanetHostByName, exoplanetHosts } from "../src/exoplanet-hosts.ts";
import { nearStarByName } from "../src/near-stars.ts";

const all = exoplanetHosts();

test("TRAPPIST-1 is about 40 light-years away with seven planets whose periods are the published ones", () => {
  // Published (Gillon et al. 2017, Agol et al. 2021): b 1.5108, c 2.4219, d 4.0492, e 6.1010, f 9.2075, g 12.3524, h 18.7729 days; M8 dwarf; parallax 82.6 +- 2.6 mas, 12.1 parsecs, about 39.5 light-years.
  const host = exoplanetHostByName("TRAPPIST-1")!;
  assert.equal(host.planetCount, 7);
  assert.deepEqual(host.planets.map((p) => p.letter), ["b", "c", "d", "e", "f", "g", "h"]);
  const published = [1.5108, 2.4219, 4.0492, 6.101, 9.2075, 12.3524, 18.7729];
  host.planets.forEach((p, i) => assert.ok(Math.abs(p.periodDays! - published[i]!) < 0.001, `${p.name} ${p.periodDays}`));
  assert.ok(Math.abs(host.lightYears - 39.5) < 0.1);
  assert.ok(host.lightYearsError > 1 && host.lightYearsError < 1.5);
  assert.equal(host.spectralType, "M8");
  assert.equal(host.constellation, "Aqr");
  assert.ok(Math.abs(host.rightAscension - (23 + 6 / 60 + 29.28 / 3600) * 15) < 0.001);
  assert.ok(Math.abs(host.declination - -(5 + 2 / 60 + 29 / 3600)) < 0.001);
  assert.equal(host.selection, "typed");
  assert.deepEqual(host.sources, { position: "2MASS", distance: "typed", spectralType: "typed", magnitude: "typed", planets: "NASA Exoplanet Archive" });
  assert.ok(host.references.length === 3 && host.references[0]!.includes("Costa et al. 2006"));
  assert.equal(host.nearStarId, undefined);
  assert.equal(host.nameJa, "トラピスト1");
  assert.ok(host.planets.every((p) => p.discoveryMethod === "Transit" && p.periodReference !== undefined && (p.discoveryYear === 2016 || p.discoveryYear === 2017)));
  assert.equal(exoplanetHostByName("trappist-1 e"), host);
});

test("Proxima Centauri has its two planets, at the distance and place of the near-star table", () => {
  // Published: Proxima b, 11.19 days (Anglada-Escudé 2016: 11.186); the star is 4.24 light-years away.
  const host = exoplanetHostByName("Proxima Cen")!;
  assert.equal(host.name, "Proxima Centauri");
  assert.equal(host.nameJa, "プロキシマ・ケンタウリ");
  assert.deepEqual(host.planets.map((p) => p.name), ["Proxima Cen b", "Proxima Cen d"]);
  assert.ok(Math.abs(host.planets[0]!.periodDays! - 11.19) < 0.02);
  assert.equal(host.planets[0]!.discoveryYear, 2016);
  assert.equal(host.planets[0]!.discoveryMethod, "Radial Velocity");
  assert.ok(Math.abs(host.lightYears - 4.24) < 0.1);
  assert.equal(host.nearStarId, "alpha-centauri");
  const member = nearStarByName(host.nearStarId!)!.members.find((m) => m.name === "Proxima Centauri")!;
  assert.equal(member.rightAscension, host.rightAscension);
  assert.equal(member.declination, host.declination);
  assert.equal(exoplanetHostByName("Proxima Cen b"), host);
});

test("the rule: within 50 light-years or an IAU-named star, distance known to 10%, at least one planet, nearest first", () => {
  assert.equal(EXOPLANET_HOST_LIMIT_LY, 50);
  assert.equal(all.length, 80);
  assert.equal(EXOPLANET_HOST_ROWS.length, 80);
  assert.deepEqual(all.map((h) => h.lightYears), [...all.map((h) => h.lightYears)].sort((a, b) => a - b));
  assert.deepEqual(Object.fromEntries(["near", "named", "typed"].map((k) => [k, all.filter((h) => h.selection === k).length])), { near: 75, named: 4, typed: 1 });
  for (const h of all) {
    assert.ok(h.planetCount >= 1 && h.planets.length === h.planetCount, h.name);
    assert.ok(h.lightYearsError / h.lightYears <= 0.1, h.name);
    if (h.selection === "near") assert.ok(h.lightYears <= 50 + 1e-9, h.name);
    if (h.selection === "named") assert.ok(h.lightYears > 50 && h.sources.position === "BSC", h.name);
  }
  assert.deepEqual(all.filter((h) => h.selection === "named").map((h) => h.name), ["Errai", "Helvetios", "Titawin", "Hamal"]);
  assert.equal(all.reduce((n, h) => n + h.planetCount, 0), 134);
  assert.deepEqual(exoplanetHosts({ minPlanets: 5 }).map((h) => h.name), ["TRAPPIST-1", "Copernicus"]);
  assert.ok(exoplanetHosts({ maxLightYears: 12 }).every((h) => h.lightYears <= 12));
  assert.throws(() => exoplanetHosts({ minPlanets: "many" as unknown as number }), TypeError);
});

test("the nearest hosts and the well-known ones are there", () => {
  const names = new Set(all.map((h) => h.name));
  for (const name of ["Proxima Centauri", "Barnard's Star", "Lalande 21185", "Ross 128", "Wolf 1061", "GJ 876", "GJ 581", "TRAPPIST-1", "Copernicus", "Pollux"]) assert.ok(names.has(name), name);
  assert.equal(all[0]!.name, "Proxima Centauri");
  assert.equal(exoplanetHostByName("Barnard's Star")!.planetCount, 4);
  assert.equal(exoplanetHostByName("GJ 876")!.planetCount, 4);
  assert.equal(exoplanetHostByName("Copernicus")!.planetCount, 5);
  // Hosts in the near-star table point at their system, and the others do not.
  assert.ok(all.filter((h) => h.nearStarId !== undefined).every((h) => nearStarByName(h.nearStarId!) !== undefined && h.lightYears <= 20.5));
  assert.equal(exoplanetHostByName("Pollux")!.nearStarId, undefined);
});

test("every star value has its source, none from the Archive, and the Archive is acknowledged", () => {
  for (const h of all) {
    assert.ok(["BSC", "GCTP", "2MASS", "typed"].includes(h.sources.position), h.name);
    assert.ok(["GCTP", "BSC", "dynamical", "typed"].includes(h.sources.distance), h.name);
    assert.equal(h.sources.magnitude === undefined, h.magnitude === undefined, h.name);
    assert.equal(h.sources.planets, "NASA Exoplanet Archive");
    assert.equal(h.references.length > 0, h.selection === "typed", h.name);
    for (const p of h.planets) assert.ok(p.name.length > 0 && p.letter.length > 0 && p.discoveryMethod.length > 0, p.name);
  }
  assert.ok(all.filter((h) => h.sources.distance === "typed").length === 1);
  assert.ok(!JSON.stringify(EXOPLANET_HOST_ROWS).toLowerCase().match(/gaia|hipparcos|tycho|tess input|ticv8/));
  assert.ok(!JSON.stringify(EXOPLANET_HOST_ROWS).includes("&"), "no HTML entities left in a reference");
  assert.match(EXOPLANET_ARCHIVE_ACKNOWLEDGEMENT, /^This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program\.$/);
});
