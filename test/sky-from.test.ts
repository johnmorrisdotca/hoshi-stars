// The sky from another star: from the Sun it is today's sky, from Alpha Centauri the Sun is a star of magnitude 0.5 in Cassiopeia, a nearer star shifts more than a far one, the viewpoint is left out, the stars with no distance are counted, and bad input is named.
import assert from "node:assert/strict";
import { test } from "node:test";
import { constellationAt } from "../src/boundaries.ts";
import { nearbyStarByName, nearbyStars } from "../src/nearby.ts";
import { skyFrom, type SeenStar } from "../src/sky-from.ts";
import { skyFromWithNearby } from "../src/sky-from-nearby.ts";
import { starByName, starDistance, stars } from "../src/stars.ts";

const RADIANS = Math.PI / 180;
const angleBetween = (a: { rightAscension: number; declination: number }, b: { rightAscension: number; declination: number }): number => {
  const h = Math.sin(((b.declination - a.declination) * RADIANS) / 2) ** 2 + Math.cos(a.declination * RADIANS) * Math.cos(b.declination * RADIANS) * Math.sin(((b.rightAscension - a.rightAscension) * RADIANS) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / RADIANS;
};
const sunOf = (sky: readonly SeenStar[]): SeenStar => sky.find((star) => star.id === "sun")!;

test("from the Sun's own position the sky is today's: the same stars, places and magnitudes, and no Sun", () => {
  const sky = skyFrom({ x: 0, y: 0, z: 0 });
  const withDistance = stars().filter((star) => starDistance(star) !== undefined);
  assert.equal(sky.length, withDistance.length);
  assert.equal(sky.skipped, stars().length - withDistance.length);
  assert.equal(sky.some((star) => star.id === "sun"), false);
  const byId = new Map(sky.map((star) => [star.id, star]));
  for (const star of withDistance) {
    const seen = byId.get(`hr-${star.hr}`)!;
    assert.ok(angleBetween(seen, star) < 1e-9, `HR ${star.hr}`);
    assert.ok(Math.abs(seen.magnitude - star.magnitude) < 1e-9, `HR ${star.hr} ${seen.magnitude} against ${star.magnitude}`);
    assert.ok(Math.abs(seen.lightYears - starDistance(star)!.lightYears) < 1e-9);
    assert.equal(seen.star, star);
  }
});

test("from Alpha Centauri the Sun is a star of magnitude about 0.5 in Cassiopeia, at right ascension 2h40m and declination +60.8", () => {
  const sky = skyFrom("Rigil Kentaurus");
  const sun = sunOf(sky);
  assert.equal(sun.name, "Sun");
  assert.ok(Math.abs(sun.rightAscension / 15 - (2 + 39.6 / 60)) < 0.01, String(sun.rightAscension / 15));
  assert.ok(Math.abs(sun.declination - 60.8) < 0.1, String(sun.declination));
  assert.ok(Math.abs(sun.magnitude - 0.5) < 0.1, String(sun.magnitude));
  assert.ok(Math.abs(sun.lightYears - 4.35) < 0.05);
  assert.equal(sun.absoluteMagnitude, 4.83);
  assert.equal(sun.star, undefined);
  assert.equal(constellationAt(sun).abbreviation, "Cas");
  // the viewpoint star is not in its own sky
  assert.equal(sky.some((star) => star.id === "hr-5459"), false);
  // the same sky by passing the star
  assert.equal(sunOf(skyFrom(starByName("Rigil Kentaurus")!)).magnitude, sun.magnitude);
});

test("a near star shifts a lot and a far one barely; brightness follows distance", () => {
  const sky = skyFrom("Rigil Kentaurus");
  const byName = (name: string): SeenStar => sky.find((star) => star.name === name)!;
  const shift = (name: string): number => angleBetween(byName(name), starByName(name)!);
  assert.ok(shift("Sirius") > 20, String(shift("Sirius")));
  assert.ok(shift("Procyon") > 10);
  assert.ok(shift("Rigel") < 1, String(shift("Rigel")));
  assert.ok(shift("Polaris") < 0.4, String(shift("Polaris")));
  assert.ok(shift("Sirius") > shift("Procyon") && shift("Procyon") > shift("Arcturus") && shift("Arcturus") > shift("Rigel"));
  // Deneb has no parallax in the table, so it is not in the sky from there
  assert.equal(sky.some((star) => star.name === "Deneb"), false);
  // seen from where it is, Sirius is 9.5 light-years off and the same absolute magnitude
  const sirius = byName("Sirius");
  assert.ok(Math.abs(sirius.lightYears - 9.5) < 0.1);
  assert.ok(Math.abs(sirius.absoluteMagnitude - (-1.46 - 5 * Math.log10(8.55 / 3.261563777 / 10))) < 0.05);
  // brightest first
  for (let i = 1; i < sky.length; i++) assert.ok(sky[i - 1]!.magnitude <= sky[i]!.magnitude);
});

test("the sky of a point is the same as the sky of a star at that point, and a point in front of a star makes it brighter", () => {
  const rigil = starByName("Rigil Kentaurus")!;
  const ly = starDistance(rigil)!.lightYears;
  const pc = ly / 3.261563777;
  const ra = rigil.rightAscension * RADIANS;
  const dec = rigil.declination * RADIANS;
  const point = skyFrom({ x: pc * Math.cos(dec) * Math.cos(ra), y: pc * Math.cos(dec) * Math.sin(ra), z: pc * Math.sin(dec) });
  const star = skyFrom(rigil);
  const sunFromPoint = sunOf(point);
  assert.ok(Math.abs(sunFromPoint.magnitude - sunOf(star).magnitude) < 1e-9);
  // half the way to Vega: Vega is brighter
  const vega = starByName("Vega")!;
  const half = skyFrom({ x: 0, y: 0, z: 0 }).find((s) => s.name === "Vega")!;
  const vegaPc = half.parsecs;
  const toward = skyFrom({ x: (vegaPc / 2) * Math.cos(vega.declination * RADIANS) * Math.cos(vega.rightAscension * RADIANS), y: (vegaPc / 2) * Math.cos(vega.declination * RADIANS) * Math.sin(vega.rightAscension * RADIANS), z: (vegaPc / 2) * Math.sin(vega.declination * RADIANS) }).find((s) => s.name === "Vega")!;
  assert.ok(Math.abs(toward.magnitude - (half.magnitude - 5 * Math.log10(2))) < 1e-6);
});

test("the faintest magnitude limits the list, and the stars without a distance are counted, not shown", () => {
  const all = skyFrom("Sirius");
  const bright = skyFrom("Sirius", { magnitude: 2 });
  assert.ok(bright.length > 5 && bright.length < all.length);
  assert.ok(bright.every((star) => star.magnitude <= 2));
  assert.equal(all.length + all.skipped, stars().length - 1 + 1); // Sirius out, the Sun in
  assert.equal(all.skipped, stars().filter((star) => starDistance(star) === undefined).length);
});

test("a companion nearer than the error of the viewpoint's distance is left out and counted", () => {
  const sky = skyFrom("Rigil Kentaurus");
  assert.equal(sky.some((star) => star.name === "Toliman"), false);
  assert.equal(sky.skipped, stars().filter((star) => starDistance(star) === undefined).length + 1);
});

test("the nearby stars are moved by their own entry, Proxima Centauri is a viewpoint, and the Sun is 4.2 light-years from it", () => {
  const sky = skyFromWithNearby("Proxima Centauri");
  const sun = sunOf(sky);
  assert.ok(Math.abs(sun.lightYears - 4.24) < 0.05, String(sun.lightYears));
  assert.ok(Math.abs(sun.declination - 62.7) < 0.2, String(sun.declination));
  assert.ok(sky.some((star) => star.id.startsWith("gctp-")));
  assert.equal(sky.some((star) => star.name === "Proxima Centauri"), false);
  assert.ok(sky.length > 5000);
  assert.equal(sky.length + sky.skipped, stars().length + nearbyStars().length + 1 - 1);
  // by object and by name are one thing
  assert.equal(sunOf(skyFromWithNearby(nearbyStarByName("Proxima Centauri")!)).magnitude, sun.magnitude);
  // the plain entry does not know the nearby star's name, and takes the object with `among`
  assert.throws(() => skyFrom("Proxima Centauri"), /not a star this package knows/);
  assert.equal(sunOf(skyFrom(nearbyStarByName("Proxima Centauri")!)).magnitude, sun.magnitude);
});

test("a bad viewpoint, a star with no distance and a bad option are named", () => {
  assert.throws(() => skyFrom("Nowhere"), /"Nowhere" is not a star/);
  assert.throws(() => skyFrom({ x: 0, y: Number.NaN, z: 0 }), /finite numbers of parsecs/);
  assert.throws(() => skyFrom({ x: 1, y: "2", z: 0 } as never), /\{ x, y, z \} in parsecs/);
  assert.throws(() => skyFrom(null as never), TypeError);
  const noDistance = stars().find((star) => starDistance(star) === undefined)!;
  assert.throws(() => skyFrom(noDistance), /no distance/);
  assert.throws(() => skyFrom("Sirius", { magnitude: "2" as never }), /magnitude must be a number/);
});

test("one sky takes a few milliseconds", () => {
  const start = performance.now();
  skyFrom("Sirius");
  assert.ok(performance.now() - start < 200);
});
