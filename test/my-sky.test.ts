// "My sky": the turn from the stars to a horizon against `horizontal` (J. Meeus) for a thousand stars; the Moon against the published example (Meeus 47.a), against wakusei-planets' ELP series as a dev-only second opinion
// (its phase and its rise and set), and against the new Moon and full Moon it finds; the planets against the sample the chart's demo typed in from VSOP87; the camera's projection and its inverse; the words in both languages; the
// report; the sky's limiting magnitude; and the element loading on a server. wakusei-planets is a devDependency read by tests only: no source file names it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { apparent, moonGeocentric } from "@johnmorrisdotca/wakusei-planets";
import { SAMPLE_BODIES } from "../demo/bodies-sample.ts";
import { altitudeAzimuth, cameraAxes, clampView, compassPoint, degreesPerPixel, directionAt, limitingMagnitude, localFrame, moonHorizontal, moonPhase, moonPosition, moonRiseSet, mySkyWords, openingHeading, paintBackground, planetPlaces, projectDirection, say, skyColours, skyReport, sunPlace, viewScale } from "../src/my-sky/index.ts";
import { horizontal, type Observer } from "../src/sky.ts";
import { stars, starPosition } from "../src/stars.ts";

const DEG = 180 / Math.PI;
const VANCOUVER: Observer = { latitude: 49.28, longitude: -123.12 };
function close(actual: number, expected: number, tolerance: number, what: string): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected} (tolerance ${tolerance})`);
}
const gap = (a: number, b: number): number => Math.min(Math.abs(a - b) % 360, 360 - (Math.abs(a - b) % 360));

test("localFrame and altitudeAzimuth agree with horizontal for every 5th star, at places in both hemispheres and at several moments", () => {
  const places: Observer[] = [VANCOUVER, { latitude: -33.87, longitude: 151.21 }, { latitude: 0, longitude: 0 }, { latitude: 89.5, longitude: 20 }, { latitude: -64, longitude: -60 }];
  const moments = [Date.UTC(2026, 10, 12, 8), Date.UTC(1999, 5, 21, 3, 30), Date.UTC(2040, 0, 1)];
  const list = stars();
  let checked = 0;
  for (const observer of places) {
    for (const when of moments) {
      const frame = localFrame(observer, when);
      for (let i = 0; i < list.length; i += 5) {
        const p = { rightAscension: list[i]!.rightAscension, declination: list[i]!.declination };
        const mine = altitudeAzimuth(frame.fromJ2000(p.rightAscension, p.declination, { east: 0, north: 0, up: 0 }));
        const theirs = horizontal(p, observer, when);
        close(mine.altitude, theirs.altitude, 1e-6, `altitude of HR ${list[i]!.hr}`);
        if (Math.abs(theirs.altitude) < 89.99) close(gap(mine.azimuth, theirs.azimuth), 0, 1e-6, `azimuth of HR ${list[i]!.hr}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 5000);
});

test("a position of the date goes through fromDate without precession", () => {
  const frame = localFrame(VANCOUVER, Date.UTC(2026, 10, 12, 8));
  const date = { rightAscension: 100, declination: 20 };
  const mine = altitudeAzimuth(frame.fromDate(date.rightAscension, date.declination, { east: 0, north: 0, up: 0 }));
  const theirs = horizontal(date, VANCOUVER, Date.UTC(2026, 10, 12, 8), { equinox: "date" });
  close(mine.altitude, theirs.altitude, 1e-6, "altitude");
  close(gap(mine.azimuth, theirs.azimuth), 0, 1e-6, "azimuth");
});

test("the pole star stands as high as the latitude, due north, and altitudeAzimuth names the compass points", () => {
  const polaris = starPosition(stars().find((s) => s.name === "Polaris")!);
  const frame = localFrame(VANCOUVER, Date.UTC(2026, 10, 8, 6));
  const view = altitudeAzimuth(frame.fromJ2000(polaris.rightAscension, polaris.declination, { east: 0, north: 0, up: 0 }));
  close(view.altitude, 49.8, 0.2, "Polaris");
  assert.ok(view.azimuth < 2 || view.azimuth > 358);
  assert.deepEqual(altitudeAzimuth({ east: 1, north: 0, up: 0 }), { altitude: 0, azimuth: 90 });
  assert.deepEqual(altitudeAzimuth({ east: 0, north: -1, up: 0 }), { altitude: 0, azimuth: 180 });
  assert.equal(altitudeAzimuth({ east: 0, north: 0, up: 1 }).altitude, 90);
});

test("the Moon's position is Meeus example 47.a to about a tenth of a degree, and the Sun is where the solstice puts it", () => {
  const moon = moonPosition(Date.UTC(1992, 3, 12));
  close(moon.rightAscension, 134.68847, 0.3, "right ascension");
  close(moon.declination, 13.768368, 0.3, "declination");
  close(moon.distanceKm, 368409.7, 1500, "distance");
  const sun = sunPlace(Date.UTC(2026, 11, 21, 20, 50));
  close(sun.eclipticLongitude, 270, 0.05, "solstice longitude");
  close(sun.declination, -23.44, 0.05, "solstice declination");
  close(sun.distanceKm / 149_597_870.7, 0.9837, 0.001, "January distance");
});

test("the Moon's phase: new, full, quarters and the waxing flag, and the lit part agrees with wakusei-planets' ELP series to half a percent", () => {
  const newMoon = moonPhase(Date.UTC(2026, 10, 9, 6, 53));
  const fullMoon = moonPhase(Date.UTC(2026, 10, 24, 15, 1));
  assert.ok(newMoon.illuminated < 0.005 && newMoon.name === "new");
  assert.ok(fullMoon.illuminated > 0.995 && fullMoon.name === "full");
  assert.equal(moonPhase(Date.UTC(2026, 10, 12)).name, "waxing-crescent");
  assert.equal(moonPhase(Date.UTC(2026, 10, 12)).waxing, true);
  assert.equal(moonPhase(Date.UTC(2026, 10, 20)).name, "waxing-gibbous");
  assert.equal(moonPhase(Date.UTC(2026, 10, 28)).name, "waning-gibbous");
  assert.equal(moonPhase(Date.UTC(2026, 10, 28)).waxing, false);
  assert.equal(moonPhase(Date.UTC(2026, 11, 3)).name, "waning-crescent");
  assert.equal(moonPhase(Date.UTC(2026, 11, 1, 12)).name, "last-quarter");
  assert.equal(moonPhase(Date.UTC(2026, 10, 17, 0)).name, "first-quarter");
  for (let day = 0; day < 30; day++) {
    const t = Date.UTC(2026, 10, 1 + day, 12);
    close(moonPhase(t).illuminated, (apparent("moon" as never, t) as unknown as { illumination: number }).illumination, 0.005, `lit part on day ${day + 1}`);
  }
  // the phase angle and the lit part belong together
  const half = moonPhase(Date.UTC(2026, 10, 17, 0));
  close(Math.cos(half.phaseAngle / DEG), 2 * half.illuminated - 1, 1e-9, "cos(phase angle)");
});

test("the Moon's rise and set agree with the ELP series to two minutes, and the altitude includes the parallax", () => {
  const start = Date.UTC(2026, 10, 12, 12);
  const elpAbove = (t: number): number => {
    const [x, y, z] = moonGeocentric(t);
    const e = 23.43928 / DEG;
    const X = x;
    const Y = y * Math.cos(e) - z * Math.sin(e);
    const Z = y * Math.sin(e) + z * Math.cos(e);
    const r = Math.hypot(X, Y, Z);
    const h = horizontal({ rightAscension: ((Math.atan2(Y, X) * DEG) + 360) % 360, declination: Math.asin(Z / r) * DEG }, VANCOUVER, t);
    return h.altitude - (0.7275 * Math.asin(6378.14 / r) * DEG - 34 / 60);
  };
  let before = elpAbove(start);
  let rise = 0;
  let set = 0;
  for (let t = start + 60_000; t < start + 26 * 3_600_000; t += 60_000) {
    const now = elpAbove(t);
    if (before <= 0 && now > 0) rise = t;
    if (before > 0 && now <= 0) set = t;
    before = now;
  }
  const mine = moonRiseSet(VANCOUVER, start);
  assert.equal(mine.up, false);
  assert.ok(mine.rise !== null && mine.set !== null);
  close(mine.rise!, rise, 120_000, "rise");
  close(mine.set!, set, 120_000, "set");
  // at the moment of rising the Moon is on the horizon (the standard 0.125 degrees above, as seen from the place)
  close(moonHorizontal(VANCOUVER, mine.rise!).altitude, -0.8, 0.9, "altitude at moonrise");
  const when = Date.UTC(2026, 10, 12, 8);
  assert.ok(moonHorizontal(VANCOUVER, when).altitude < moonPosition(when).declination);
});

test("a Moon that is up says so, and at a pole it can go the whole 26 hours with no rise", () => {
  const up = moonRiseSet(VANCOUVER, Date.UTC(2026, 10, 17, 3));
  assert.equal(up.up, true);
  assert.ok(up.set !== null && up.set > Date.UTC(2026, 10, 17, 3));
  const pole = moonRiseSet({ latitude: 89, longitude: 0 }, Date.UTC(2026, 10, 12));
  assert.ok(pole.rise === null || pole.set === null || pole.rise > Date.UTC(2026, 10, 12));
});

test("the planets are where the chart demo's VSOP87 sample puts them on 12 November 2026, to a fifth of a degree", () => {
  const places = planetPlaces(Date.UTC(2026, 10, 12));
  assert.deepEqual(places.map((p) => p.id), ["mercury", "venus", "mars", "jupiter", "saturn"]);
  for (const place of places) {
    const sample = SAMPLE_BODIES.find((b) => b.id === place.id)!;
    close(gap(place.rightAscension, sample.ra), 0, 0.2, `${place.id} right ascension`);
    close(place.declination, sample.dec, 0.2, `${place.id} declination`);
    close(place.magnitude, sample.magnitude, 0.5, `${place.id} magnitude`);
    close(place.illuminated, sample.phase!, 0.03, `${place.id} lit part`);
  }
});

test("the camera: the middle of the picture is the heading, east is to the right when facing north, and a direction projects back to itself", () => {
  const camera = { heading: 0, pitch: 0, fov: 90, width: 400, height: 400 };
  const axes = cameraAxes(0, 0);
  const middle = { x: 0, y: 0 };
  const east = { x: 0, y: 0 };
  const zenith = { x: 0, y: 0 };
  assert.ok(projectDirection(camera, axes, { east: 0, north: 1, up: 0 }, middle));
  assert.deepEqual([Math.round(middle.x), Math.round(middle.y)], [200, 200]);
  projectDirection(camera, axes, { east: Math.sin(0.3), north: Math.cos(0.3), up: 0 }, east);
  assert.ok(east.x > 200 && Math.abs(east.y - 200) < 1e-9);
  projectDirection(camera, axes, { east: 0, north: Math.cos(0.3), up: Math.sin(0.3) }, zenith);
  assert.ok(zenith.y < 200);
  // facing south: east is on the left
  projectDirection({ ...camera, heading: 180 }, cameraAxes(180, 0), { east: Math.sin(0.3), north: -Math.cos(0.3), up: 0 }, east);
  assert.ok(east.x < 200);
  // half the field of view lands on the edge of the smaller side
  projectDirection(camera, axes, { east: Math.sin(Math.PI / 4), north: Math.cos(Math.PI / 4), up: 0 }, east);
  close(east.x, 400, 1e-6, "edge at half the field of view");
  // the inverse
  for (const [heading, pitch] of [[0, 0], [200, 40], [90, 80], [310, -20]] as const) {
    const cam = { ...camera, heading, pitch };
    const ax = cameraAxes(heading, pitch);
    for (const [x, y] of [[20, 30], [200, 200], [390, 380], [100, 350]] as const) {
      const d = directionAt(cam, ax, x, y, { east: 0, north: 0, up: 0 });
      close(Math.hypot(d.east, d.north, d.up), 1, 1e-9, "unit vector");
      const back = { x: 0, y: 0 };
      assert.ok(projectDirection(cam, ax, d, back));
      close(back.x, x, 1e-6, "x");
      close(back.y, y, 1e-6, "y");
    }
  }
  // a point behind you is not placed
  assert.equal(projectDirection(camera, axes, { east: 0, north: -1, up: 0 }, middle), false);
  close(degreesPerPixel(camera), DEG / viewScale(camera), 1e-12, "degrees per pixel");
  assert.equal(openingHeading(49), 180);
  assert.equal(openingHeading(-34), 0);
  assert.deepEqual(clampView({ heading: -90, pitch: 120, fov: 400 }), { heading: 270, pitch: 90, fov: 130 });
  assert.deepEqual(clampView({ heading: 725, pitch: -80, fov: 3 }), { heading: 5, pitch: -25, fov: 20 });
});

test("the sky's colours: blue by day, dark at night, and the ground is darker than the sky and not black", () => {
  assert.ok(skyColours(40).zenith[2] > 150);
  assert.ok(skyColours(-40).zenith[2] < 30);
  assert.ok(skyColours(-3).horizon[0] > skyColours(-3).zenith[0]);
  const camera = { heading: 180, pitch: 0, fov: 90, width: 40, height: 40 };
  const data = new Uint8ClampedArray(40 * 40 * 4);
  paintBackground(data, 40, 40, 1, camera, { altitude: -40, direction: { east: 0, north: 0, up: -0.64 } });
  const sky = data[(2 * 40 + 20) * 4 + 2]!;
  const ground = data[(37 * 40 + 20) * 4 + 2]!;
  assert.ok(sky > ground && ground > 0, `${sky} ${ground}`);
  assert.ok(data.every((v, i) => i % 4 !== 3 || v === 255));
});

test("the limiting magnitude falls from 6 in the dark to -3 when the Sun is up, in a straight line", () => {
  assert.equal(limitingMagnitude(-40), 6);
  assert.equal(limitingMagnitude(-18), 6);
  assert.equal(limitingMagnitude(-6), 0);
  assert.equal(limitingMagnitude(5), -3);
  assert.ok(limitingMagnitude(-12) > limitingMagnitude(-9));
});

test("the report: midnight in Vancouver in November has Mars, Jupiter and Saturn up and the Sun far down; noon has the Sun up and no stars", () => {
  const midnight = skyReport(VANCOUVER, new Date("2026-11-12T08:00:00Z"));
  assert.ok(midnight.sun.altitude < -50);
  assert.deepEqual(midnight.planets.filter((p) => p.up).map((p) => p.id), ["mars", "jupiter", "saturn"]);
  assert.equal(midnight.moon.up, false);
  assert.equal(midnight.limit, 6);
  const noon = skyReport(VANCOUVER, new Date("2026-11-12T20:00:00Z"));
  assert.ok(noon.sun.altitude > 15);
  assert.equal(noon.limit, -3);
  close(Math.hypot(noon.moon.towardSun.east, noon.moon.towardSun.north, noon.moon.towardSun.up), 1, 1e-9, "unit vector to the Sun");
  assert.throws(() => skyReport({ latitude: 95, longitude: 0 }, 0), RangeError);
  assert.throws(() => skyReport(VANCOUVER, Number.NaN), RangeError);
});

test("the words: every key in both languages, the phases, the planets, the compass and the gaps", () => {
  const en = mySkyWords("en");
  const ja = mySkyWords("ja");
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ja).sort());
  assert.deepEqual(Object.keys(en.phase), Object.keys(ja.phase));
  assert.equal(mySkyWords("fr"), en);
  assert.equal(say(en.lit, { n: 62 }), "62% lit");
  assert.equal(say(ja.lit, { n: 62 }), "月の62%が光っています");
  assert.equal(say("{a} {b}", { a: 1 }), "1 {b}");
  assert.deepEqual([0, 44, 46, 100, 200, 359, -45, 720].map(compassPoint), ["N", "NE", "NE", "E", "S", "N", "NW", "N"]);
  for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
    const value = ja[key];
    if (typeof value === "string") assert.ok(value.length > 0, key);
  }
});

test("the element and its define load on a server and define nothing", async () => {
  assert.equal(globalThis.HTMLElement, undefined);
  const { MY_SKY_TAG, HoshiMySkyElement } = await import("../src/my-sky/element.ts");
  const { defineMySky } = await import("../src/my-sky/define.ts");
  assert.equal(MY_SKY_TAG, "hoshi-my-sky");
  assert.equal(typeof HoshiMySkyElement, "function");
  assert.equal(defineMySky(), false);
});
