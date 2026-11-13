// What you can see tonight: the Sun against the Almanac's own worked values, the airmass against Kasten and Young's, and Sirius and Polaris from known places and hours.
import assert from "node:assert/strict";
import { test } from "node:test";
import { starByName, starPosition } from "../src/stars.ts";
import { horizontal } from "../src/sky.ts";
import { airmass, SKY_LIMITS, sunAltitude, sunPosition, twilightOf, visibleStars } from "../src/tonight.ts";

const vancouver = { latitude: 49.28, longitude: -123.12 };
const HOUR = 3_600_000;
const start = Date.UTC(2026, 10, 8, 0);
const names = (when: number, observer = vancouver, sky = {}): string[] => visibleStars({ observer, when, sky }).stars.map((s) => s.star.name ?? "");

test("the Sun: the solstice and the equinox, to a tenth of a degree", () => {
  assert.ok(Math.abs(sunPosition(Date.UTC(2026, 5, 21, 8, 24)).declination - 23.44) < 0.1);
  assert.ok(Math.abs(sunPosition(Date.UTC(2026, 11, 21, 15, 50)).declination + 23.44) < 0.1);
  assert.ok(Math.abs(sunPosition(Date.UTC(2026, 2, 20, 14, 46)).declination) < 0.1);
  // Almanac example: 2000 January 1 at 12 UT, the Sun's declination is -23.03 and its right ascension 281.3
  const noon2000 = sunPosition(Date.UTC(2000, 0, 1, 12));
  assert.ok(Math.abs(noon2000.declination + 23.03) < 0.05, String(noon2000.declination));
  assert.ok(Math.abs(noon2000.rightAscension - 281.3) < 0.2, String(noon2000.rightAscension));
});

test("the Sun is high at noon and far down at midnight, and the twilight names follow", () => {
  assert.ok(sunAltitude(vancouver, Date.UTC(2026, 5, 21, 20)) > 60);
  assert.ok(sunAltitude(vancouver, Date.UTC(2026, 10, 8, 8)) < -18);
  assert.deepEqual([twilightOf(30), twilightOf(-1), twilightOf(-3), twilightOf(-9), twilightOf(-15), twilightOf(-25)], ["day", "civil", "civil", "nautical", "astronomical", "night"]);
  assert.throws(() => twilightOf(Number.NaN), RangeError);
});

test("airmass: 1 at the zenith, 2 at 30 degrees, about 38 at the horizon", () => {
  assert.ok(Math.abs(airmass(90) - 1) < 0.001);
  assert.ok(Math.abs(airmass(30) - 2) < 0.01);
  assert.ok(Math.abs(airmass(0) - 38) < 0.5);
  assert.throws(() => airmass(-1), RangeError);
  assert.throws(() => airmass(91), RangeError);
});

test("Polaris: up every hour of the night from mid-northern latitudes, never from the far south", () => {
  for (const latitude of [30, 45, 60]) {
    for (let hour = 0; hour < 24; hour += 1) {
      const when = start + hour * HOUR;
      const sky = visibleStars({ observer: { latitude, longitude: 0 }, when });
      if (sky.twilight === "night") assert.ok(sky.stars.some((s) => s.star.name === "Polaris"), `Polaris at latitude ${latitude}, hour ${hour}`);
    }
  }
  for (let hour = 0; hour < 24; hour += 1) assert.ok(!names(start + hour * HOUR, { latitude: -60, longitude: 0 }).includes("Polaris"), `hour ${hour}`);
  // on the equator Polaris is at the horizon, where the air takes it
  assert.ok(!names(start, { latitude: 0, longitude: 0 }, {}).includes("Polaris"));
});

test("Polaris stands as high as the latitude, and the answer carries it", () => {
  const sky = visibleStars({ observer: vancouver, when: Date.UTC(2026, 10, 8, 8) });
  const polaris = sky.stars.find((s) => s.star.name === "Polaris")!;
  assert.ok(Math.abs(polaris.altitude - 49.28) < 1.1);
  assert.ok(polaris.azimuth < 3 || polaris.azimuth > 357);
  assert.ok(polaris.apparentMagnitude > polaris.star.magnitude);
  assert.equal(polaris.ease, "easy");
});

test("Sirius: not in daylight, up on a winter night, and never from the far north", () => {
  assert.ok(!names(Date.UTC(2026, 10, 8, 20)).includes("Sirius"));
  assert.equal(visibleStars({ observer: vancouver, when: Date.UTC(2026, 10, 8, 20) }).twilight, "day");
  assert.equal(visibleStars({ observer: vancouver, when: Date.UTC(2026, 10, 8, 20) }).stars.length, 0);
  // Sirius culminates near 2 am in early November: well up, the brightest star of the sky
  const sky = visibleStars({ observer: vancouver, when: Date.UTC(2026, 10, 8, 10) });
  assert.equal(sky.stars[0]!.star.name, "Sirius");
  assert.ok(sky.stars[0]!.altitude > 15);
  // declination -16.7: it never rises north of latitude 73.3
  for (let hour = 0; hour < 24; hour += 1) assert.ok(!names(start + hour * HOUR, { latitude: 75, longitude: 0 }, { limit: "dark" }).includes("Sirius"));
  const at = (latitude: number) => horizontal(starPosition(starByName("Sirius")!), { latitude, longitude: 0 }, start).altitude;
  assert.ok(at(75) < 0);
  assert.ok(at(60) < 25);
});

test("twilight and the site's darkness lower the limit, and the Moon lowers it more", () => {
  const dusk = Date.UTC(2026, 10, 9, 1, 30);
  const evening = visibleStars({ observer: vancouver, when: dusk });
  assert.ok(evening.twilight === "civil" || evening.twilight === "nautical");
  assert.ok(evening.limitingMagnitude < 5);
  const dark = visibleStars({ observer: vancouver, when: Date.UTC(2026, 10, 8, 10) });
  const city = visibleStars({ observer: vancouver, when: Date.UTC(2026, 10, 8, 10), sky: { limit: "city" } });
  assert.equal(dark.limitingMagnitude, SKY_LIMITS.rural);
  assert.equal(city.limitingMagnitude, SKY_LIMITS.city);
  assert.ok(city.stars.length < dark.stars.length / 3);
  assert.ok(city.stars.every((s) => s.apparentMagnitude <= SKY_LIMITS.city));
  assert.equal(visibleStars({ observer: vancouver, when: Date.UTC(2026, 10, 8, 10), sky: { moonPenalty: 2 } }).limitingMagnitude, SKY_LIMITS.rural - 2);
});

test("extinction dims a star low in the sky, and minAltitude and all behave", () => {
  const when = Date.UTC(2026, 10, 8, 10);
  const everything = visibleStars({ observer: vancouver, when, sky: { all: true } });
  assert.ok(everything.stars.some((s) => s.ease === "not tonight"));
  assert.ok(everything.stars.every((s) => s.altitude > 0));
  const low = everything.stars.filter((s) => s.altitude < 5);
  assert.ok(low.every((s) => s.apparentMagnitude > s.star.magnitude + 0.2));
  const high = visibleStars({ observer: vancouver, when, sky: { minAltitude: 30 } });
  assert.ok(high.stars.length > 0 && high.stars.every((s) => s.altitude >= 30));
  const sorted = [...high.stars].sort((a, b) => a.apparentMagnitude - b.apparentMagnitude);
  assert.deepEqual(high.stars.map((s) => s.star.hr), sorted.map((s) => s.star.hr));
  const easy = visibleStars({ observer: vancouver, when, sky: { extinction: 0 } });
  assert.ok(easy.stars.length >= visibleStars({ observer: vancouver, when }).stars.length);
});

test("a number for the limit and a given Sun altitude, and bad input says what it got", () => {
  const bright = visibleStars({ observer: vancouver, when: 0, sky: { limit: 1, sunAltitude: -30 } });
  assert.equal(bright.twilight, "night");
  assert.ok(bright.stars.every((s) => s.apparentMagnitude <= 1));
  assert.throws(() => visibleStars({ observer: vancouver, when: Number.NaN }), RangeError);
  assert.throws(() => visibleStars({ observer: { latitude: 95, longitude: 0 }, when: 0 }), RangeError);
  assert.throws(() => visibleStars({ observer: vancouver, when: 0, sky: { limit: "bright" as never } }), /sky\.limit/);
  assert.throws(() => visibleStars({ observer: vancouver, when: 0, sky: { extinction: -1 } }), /sky\.extinction/);
  assert.throws(() => visibleStars({ observer: vancouver, when: 0, sky: { moonPenalty: -1 } }), /sky\.moonPenalty/);
});
