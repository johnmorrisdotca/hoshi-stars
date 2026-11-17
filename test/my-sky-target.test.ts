// Turning "my sky" to a target: what a target text means (`parseTarget`), where the five kinds stand (`locate`, `targetInSky`) against `horizontal` and the Moon's own maths, the rise and set (`riseAndSet`) at its edges (a star that never rises or never
// sets, the Sun at the Arctic Circle, the equator, a pole, a thing up now), the views that centre a thing (`viewOfObject`) and frame a constellation (`viewOfGroup`), the glide (`glideView`), the ids that are looked up (`resolveTarget`,
// `resolveStarId`), the page's marks (`cleanMarks`, `sameMarks`) and the words of the new labels in both languages.
import assert from "node:assert/strict";
import { test } from "node:test";
import { altitudeAzimuth, cleanMarks, glideView, locate, localFrame, MARKS_MAX, moonHorizontal, moonRiseSet, mySkyWords, parseTarget, planetPlaces, resolveStarId, resolveTarget, riseAndSet, say, sameMarks, sunPlace, targetInSky, viewOfGroup, viewOfObject, type SkyLocator } from "../src/my-sky/index.ts";
import { horizontal, type Observer } from "../src/sky.ts";
import { starByHr, starByName } from "../src/stars.ts";

const VANCOUVER: Observer = { latitude: 49.28, longitude: -123.12 };
const EVENING = Date.UTC(2026, 10, 17, 4);
const HOUR = 3_600_000;
const STAR_HORIZON = -34 / 60;
function close(actual: number, expected: number, tolerance: number, what: string): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected} (tolerance ${tolerance})`);
}
const starAt = (name: string): SkyLocator => {
  const star = starByName(name)!;
  return { kind: "star", rightAscension: star.rightAscension, declination: star.declination };
};

test("parseTarget reads every kind of target, ignores case and spaces, and refuses what is not one", () => {
  assert.deepEqual(parseTarget("planet:mars"), { kind: "planet", id: "mars" });
  assert.deepEqual(parseTarget("  Planet: Jupiter "), { kind: "planet", id: "jupiter" });
  assert.deepEqual(parseTarget("moon"), { kind: "moon" });
  assert.deepEqual(parseTarget(" SUN "), { kind: "sun" });
  assert.deepEqual(parseTarget("constellation:Ori"), { kind: "constellation", name: "Ori" });
  assert.deepEqual(parseTarget("Constellation: Canis Major"), { kind: "constellation", name: "Canis Major" });
  assert.deepEqual(parseTarget("Betelgeuse"), { kind: "star", id: "betelgeuse" });
  assert.deepEqual(parseTarget("alpha-orionis"), { kind: "star", id: "alpha-orionis" });
  assert.deepEqual(parseTarget("hr-2061"), { kind: "star", id: "hr-2061" });
  // the planets are the five bright ones: Pluto, Earth and the Sun as a planet are not
  assert.equal(parseTarget("planet:pluto"), undefined);
  assert.equal(parseTarget("planet:"), undefined);
  assert.equal(parseTarget("constellation:"), undefined);
  assert.equal(parseTarget(""), undefined);
  assert.equal(parseTarget("   "), undefined);
  assert.equal(parseTarget(null), undefined);
  assert.equal(parseTarget(undefined), undefined);
  assert.equal(parseTarget(42), undefined);
  // a point: the azimuth comes round into 0 up to 360, the altitude is held to -90 up to 90, a label is kept only if it is a text
  assert.deepEqual(parseTarget({ azimuth: -90, altitude: 120, label: "Probe" }), { kind: "point", point: { azimuth: 270, altitude: 90, label: "Probe" } });
  assert.deepEqual(parseTarget({ azimuth: 725, altitude: -95, label: 4 }), { kind: "point", point: { azimuth: 5, altitude: -90 } });
  assert.equal(parseTarget({ azimuth: Number.NaN, altitude: 10 }), undefined);
  assert.equal(parseTarget({ azimuth: 10, altitude: Number.POSITIVE_INFINITY }), undefined);
  assert.equal(parseTarget({ azimuth: "10", altitude: 10 }), undefined);
});

test("locate gives the altitude and azimuth horizontal gives for a star, the Moon's own for the Moon, and a point stays where it was put", () => {
  for (const when of [EVENING, Date.UTC(2027, 5, 21, 12), Date.UTC(2031, 0, 1)]) {
    for (const place of [VANCOUVER, { latitude: -33.87, longitude: 151.21 }, { latitude: 0, longitude: 0 }, { latitude: 89.9, longitude: 20 }]) {
      const betelgeuse = starByName("Betelgeuse")!;
      const mine = locate({ kind: "star", rightAscension: betelgeuse.rightAscension, declination: betelgeuse.declination }, place, when);
      const theirs = horizontal({ rightAscension: betelgeuse.rightAscension, declination: betelgeuse.declination }, place, when);
      close(mine.altitude, theirs.altitude, 1e-6, "altitude of Betelgeuse");
      const moon = locate({ kind: "moon" }, place, when);
      const moonOwn = moonHorizontal(place, when);
      assert.deepEqual(moon, moonOwn);
    }
  }
  // the Sun is the Sun's place of the date through the same frame, a planet the planet's J2000 place
  const frame = localFrame(VANCOUVER, EVENING);
  const sun = sunPlace(EVENING);
  assert.deepEqual(locate({ kind: "sun" }, VANCOUVER, EVENING), altitudeAzimuth(frame.fromDate(sun.rightAscension, sun.declination, { east: 0, north: 0, up: 0 })));
  const saturn = planetPlaces(EVENING).find((p) => p.id === "saturn")!;
  assert.deepEqual(locate({ kind: "planet", id: "saturn" }, VANCOUVER, EVENING), altitudeAzimuth(frame.fromJ2000(saturn.rightAscension, saturn.declination, { east: 0, north: 0, up: 0 })));
  assert.deepEqual(locate({ kind: "point", azimuth: -30, altitude: 12 }, VANCOUVER, EVENING), { altitude: 12, azimuth: 330 });
  assert.throws(() => locate({ kind: "moon" }, { latitude: 95, longitude: 0 }, EVENING), RangeError);
  assert.throws(() => locate({ kind: "moon" }, VANCOUVER, Number.NaN), RangeError);
});

test("riseAndSet: a star that never sets (Polaris) and one that never rises (Acrux) from Vancouver, and a star that comes and goes", () => {
  const polaris = riseAndSet(starAt("Polaris"), VANCOUVER, EVENING);
  assert.deepEqual({ up: polaris.up, rise: polaris.rise, set: polaris.set, always: polaris.always, never: polaris.never }, { up: true, rise: null, set: null, always: true, never: false });
  const acrux = riseAndSet(starAt("Acrux"), VANCOUVER, EVENING);
  assert.deepEqual({ up: acrux.up, rise: acrux.rise, set: acrux.set, always: acrux.always, never: acrux.never }, { up: false, rise: null, set: null, always: false, never: true });
  // Sirius is down in the evening (about 25 degrees below the horizon) and rises in about two and a half hours, at the altitude where the air bends its light up
  const sirius = riseAndSet(starAt("Sirius"), VANCOUVER, EVENING);
  assert.equal(sirius.up, false);
  assert.ok(sirius.rise !== null && sirius.rise > EVENING && sirius.rise < EVENING + 4 * HOUR, "Sirius rises within four hours");
  assert.ok(sirius.set !== null && sirius.set > sirius.rise!, "and sets after it has risen");
  assert.equal(sirius.always || sirius.never, false);
  const sky = starAt("Sirius") as { rightAscension: number; declination: number };
  close(horizontal(sky, VANCOUVER, sirius.rise!).altitude, STAR_HORIZON, 0.02, "Sirius's altitude at its rise");
  close(horizontal(sky, VANCOUVER, sirius.set!).altitude, STAR_HORIZON, 0.02, "Sirius's altitude at its set");
  // a star that is up now sets before it rises again
  const vega = riseAndSet(starAt("Vega"), VANCOUVER, EVENING);
  assert.ok(vega.up && vega.set !== null && vega.set < vega.rise!);
});

test("riseAndSet at the edges: the equator, a pole, the midnight sun and the polar night, a planet, the Sun and the Moon", () => {
  // on the equator a star on the celestial equator is up for half a sidereal day: its rise and set are 11 h 58 min apart
  const equator = riseAndSet({ kind: "star", rightAscension: 100, declination: 0 }, { latitude: 0, longitude: 30 }, EVENING);
  assert.ok(equator.rise !== null && equator.set !== null);
  const gap = Math.abs(equator.set - equator.rise);
  // up a little longer than half a turn (the air lifts the star over the horizon early and holds it late), down a little shorter: 718 minutes, and 4.5 either way
  const minutes = gap / 60_000;
  assert.ok(Math.abs(minutes - 713.5) < 1 || Math.abs(minutes - 722.5) < 1, `${minutes} minutes between a rise and a set on the equator`);
  // at the north pole a star's height is its declination (to a fraction of a degree of precession): north of the horizon it never sets, south of it never rises
  const pole: Observer = { latitude: 90, longitude: 0 };
  assert.equal(riseAndSet({ kind: "star", rightAscension: 100, declination: 10 }, pole, EVENING).always, true);
  assert.equal(riseAndSet({ kind: "star", rightAscension: 100, declination: -10 }, pole, EVENING).never, true);
  // the air lifts a star over the horizon: at the pole one 0.3 degrees under it counts as up (always), one 0.7 degrees under it does not
  assert.equal(riseAndSet({ kind: "star", rightAscension: 100, declination: -0.3 }, pole, EVENING).always, true);
  assert.equal(riseAndSet({ kind: "star", rightAscension: 100, declination: -0.7 }, pole, EVENING).never, true);
  // the Sun above the Arctic Circle: up all day at midsummer, down all day at midwinter, and rising and setting at the equinox
  const tromso: Observer = { latitude: 69.65, longitude: 18.96 };
  assert.equal(riseAndSet({ kind: "sun" }, tromso, Date.UTC(2026, 5, 21, 12)).always, true);
  assert.equal(riseAndSet({ kind: "sun" }, tromso, Date.UTC(2026, 11, 21, 12)).never, true);
  const equinox = riseAndSet({ kind: "sun" }, tromso, Date.UTC(2026, 2, 20, 12));
  assert.ok(equinox.rise !== null && equinox.set !== null && !equinox.always && !equinox.never);
  // Vancouver in November: the Sun rises at the upper edge's own altitude, and a planet where the air bends it
  const sun = riseAndSet({ kind: "sun" }, VANCOUVER, EVENING);
  assert.equal(sun.up, false);
  close(locate({ kind: "sun" }, VANCOUVER, sun.rise!).altitude, -50 / 60, 0.02, "the Sun's altitude at its rise");
  const mars = riseAndSet({ kind: "planet", id: "mars" }, VANCOUVER, EVENING);
  assert.equal(mars.up, false);
  close(locate({ kind: "planet", id: "mars" }, VANCOUVER, mars.rise!).altitude, STAR_HORIZON, 0.02, "Mars's altitude at its rise");
  // the Moon is moonRiseSet's, and one that is up now says so
  const moon = riseAndSet({ kind: "moon" }, VANCOUVER, EVENING);
  const own = moonRiseSet(VANCOUVER, EVENING);
  assert.deepEqual({ up: moon.up, rise: moon.rise, set: moon.set }, own);
  assert.equal(moon.up, true);
  assert.equal(moon.always, false);
  // a point has no rise or set, and is up when it is above the horizon
  assert.deepEqual(riseAndSet({ kind: "point", azimuth: 10, altitude: 5 }, VANCOUVER, EVENING), { up: true, rise: null, set: null, always: false, never: false });
  assert.equal(riseAndSet({ kind: "point", azimuth: 10, altitude: -5 }, VANCOUVER, EVENING).up, false);
});

test("targetInSky: where it stands and whether it is up agree with each other, and the times a page kept stay true until they pass", () => {
  const saturn = targetInSky({ kind: "planet", id: "saturn" }, VANCOUVER, EVENING);
  assert.equal(saturn.up, true);
  assert.ok(saturn.altitude > 30 && saturn.azimuth > 120 && saturn.azimuth < 240);
  assert.ok(saturn.set !== null && saturn.set > EVENING);
  const sirius = targetInSky(starAt("Sirius"), VANCOUVER, EVENING);
  assert.equal(sirius.up, false);
  assert.ok(sirius.altitude < -20);
  // with the times of a moment before, the place and `up` are of the moment asked: Sirius three hours later is up
  const later = EVENING + 3 * HOUR + 30 * 60_000;
  const kept = targetInSky(starAt("Sirius"), VANCOUVER, later, { rise: sirius.rise, set: sirius.set, always: sirius.always, never: sirius.never });
  assert.equal(kept.up, true);
  assert.equal(kept.rise, sirius.rise);
  assert.deepEqual(kept.altitude, locate(starAt("Sirius"), VANCOUVER, later).altitude);
  // a point's `up` is read at 0 degrees, not at the refraction horizon
  assert.equal(targetInSky({ kind: "point", azimuth: 0, altitude: -0.2 }, VANCOUVER, EVENING, { rise: null, set: null, always: false, never: false }).up, false);
  // a star at -0.4 degrees is "up" by the refraction horizon (it has risen as seen through the air) while a point there is not
  assert.equal(targetInSky({ kind: "star", rightAscension: 100, declination: -0.3 }, { latitude: 0, longitude: 0 }, Date.UTC(2026, 10, 17, 4), { rise: null, set: null, always: false, never: false }).up, locate({ kind: "star", rightAscension: 100, declination: -0.3 }, { latitude: 0, longitude: 0 }, Date.UTC(2026, 10, 17, 4)).altitude > STAR_HORIZON);
});

test("viewOfObject centres a thing, faces the horizon toward one far below it, and keeps or narrows the field of view", () => {
  assert.deepEqual(viewOfObject(30, 200, 60), { heading: 200, pitch: 30, fov: 60 });
  assert.deepEqual(viewOfObject(30, 200, 120), { heading: 200, pitch: 30, fov: 90 });
  assert.deepEqual(viewOfObject(-3, 15, 90), { heading: 15, pitch: -3, fov: 90 });
  assert.deepEqual(viewOfObject(-40, 200, 120), { heading: 200, pitch: 10, fov: 90 });
  assert.deepEqual(viewOfObject(90, 0, 20), { heading: 0, pitch: 90, fov: 20 });
  assert.equal(viewOfObject(10, -90, 90).heading, 270);
  assert.equal(viewOfObject(10, 725, 90).heading, 5);
});

test("viewOfGroup frames a constellation: faced at its middle, wide enough for its farthest star, held to 20 up to 130, and round the north", () => {
  const at = (altitude: number, azimuth: number) => {
    const a = (altitude * Math.PI) / 180;
    const z = (azimuth * Math.PI) / 180;
    return { east: Math.cos(a) * Math.sin(z), north: Math.cos(a) * Math.cos(z), up: Math.sin(a) };
  };
  // two stars on the meridian at 30 and 70 degrees: the middle is 50 degrees up due south, the farthest 20 from it, so 20 * 2 * 1.3 across
  const pair = viewOfGroup([at(30, 180), at(70, 180)]);
  close(pair.heading, 180, 1e-6, "heading");
  close(pair.pitch, 50, 1e-6, "pitch");
  close(pair.fov, 52, 1e-6, "field");
  // a small group is not framed tighter than the narrowest view
  assert.equal(viewOfGroup([at(40, 90), at(41, 91)]).fov, 20);
  // a group that spreads over the sky is held to the widest
  assert.equal(viewOfGroup([at(10, 0), at(10, 120), at(10, 240)]).fov, 130);
  // a group across due north: 350 and 10 degrees give a heading near north, not near south
  const north = viewOfGroup([at(40, 350), at(40, 10)]);
  assert.ok(north.heading < 1 || north.heading > 359, `heading ${north.heading}`);
  // a group far below the horizon is faced at the horizon, tipped 10 up; none gives the sky's own opening view
  assert.equal(viewOfGroup([at(-50, 90), at(-60, 95)]).pitch, 10);
  assert.deepEqual(viewOfGroup([]), { heading: 180, pitch: 35, fov: 90 });
  // two opposite directions have no middle: the first is faced and the field is the widest
  assert.equal(viewOfGroup([at(0, 0), at(0, 180)]).fov, 130);
});

test("glideView goes the short way round, starts and ends exactly, eases at both ends and stays in range", () => {
  const from = { heading: 350, pitch: 10, fov: 90 };
  const to = { heading: 10, pitch: 50, fov: 60 };
  assert.deepEqual(glideView(from, to, 0), from);
  assert.deepEqual(glideView(from, to, 1), to);
  // half way is half way: 0 degrees (north), 30 up, 75 across
  const half = glideView(from, to, 0.5);
  assert.ok(half.heading < 1e-9 || half.heading > 359.999999, `heading ${half.heading}`);
  close(half.pitch, 30, 1e-9, "pitch");
  close(half.fov, 75, 1e-9, "field");
  // slow at the ends: a tenth of the time covers much less than a tenth of the way
  assert.ok(glideView(from, to, 0.1).pitch - 10 < (40 * 0.1) / 2);
  // before the start and after the end it is held
  assert.deepEqual(glideView(from, to, -3), from);
  assert.deepEqual(glideView(from, to, 9), to);
  // a long way round the other side: 10 to 200 goes through 105 the short way (down through 0), not through 100
  const across = glideView({ heading: 10, pitch: 0, fov: 90 }, { heading: 200, pitch: 0, fov: 90 }, 0.5);
  close(across.heading, 285, 1e-9, "the short way from 10 to 200 is backwards through 285");
  // the pitch is held to the sky's range
  assert.equal(glideView({ heading: 0, pitch: 80, fov: 90 }, { heading: 0, pitch: 400, fov: 90 }, 1).pitch, 90);
});

test("resolveTarget and resolveStarId: the five kinds, the constellation's figure, a star by catalogue number or by id, a deep-sky object, and ids that name nothing", async () => {
  assert.equal(resolveTarget("moon") !== "later" && (resolveTarget("moon") as { label: { en: string; ja: string } }).label.ja, "月");
  const mars = resolveTarget("planet:mars");
  assert.ok(mars !== "later" && mars !== undefined);
  assert.deepEqual(mars.label, { en: "Mars", ja: "火星" });
  assert.deepEqual(mars.locator, { kind: "planet", id: "mars" });
  assert.equal(resolveTarget("planet:pluto"), undefined);
  const point = resolveTarget({ azimuth: 120, altitude: 30, label: "Probe" });
  assert.ok(point !== "later" && point !== undefined && point.kind === "point");
  assert.deepEqual(point.label, { en: "Probe", ja: "Probe" });
  // a constellation: the 88 by abbreviation, by Latin name or by Japanese name; its middle is among its stars and its figure has lines
  const orion = resolveTarget("constellation:Ori");
  assert.ok(orion !== "later" && orion !== undefined && orion.figure !== undefined);
  assert.deepEqual(orion.label, { en: "Orion", ja: "オリオン座" });
  assert.ok(orion.figure.stars.length >= 7 && orion.figure.lines.length >= 7);
  assert.equal(orion.kind, "constellation");
  assert.deepEqual(resolveTarget("constellation:Orion"), orion);
  assert.deepEqual(resolveTarget("constellation:オリオン座"), orion);
  assert.equal(resolveTarget("constellation:nowhere"), undefined);
  // a star by its catalogue number needs no index; any other id is looked up
  const hr = resolveTarget("hr-2061");
  assert.ok(hr !== "later" && hr !== undefined && hr.kind === "star");
  assert.equal(hr.label.en, "Betelgeuse");
  assert.equal(hr.label.ja, "ベテルギウス");
  assert.equal((hr.locator as { rightAscension: number }).rightAscension, starByHr(2061)!.rightAscension);
  assert.equal(resolveTarget("hr-99999"), undefined);
  assert.equal(resolveTarget("betelgeuse"), "later");
  const byId = await resolveStarId("betelgeuse");
  assert.deepEqual(byId?.locator, hr.locator);
  assert.deepEqual(byId?.label, hr.label);
  assert.deepEqual((await resolveStarId("alpha-orionis"))?.locator, hr.locator);
  assert.equal((await resolveStarId(" BETELGEUSE "))?.label.en, "Betelgeuse");
  const andromeda = await resolveStarId("m31");
  assert.equal(andromeda?.kind, "star");
  assert.equal(andromeda?.label.en, "Andromeda Galaxy");
  assert.equal(await resolveStarId("not-a-star"), undefined);
  assert.equal(await resolveStarId(""), undefined);
});

test("cleanMarks drops what cannot be drawn and keeps the first of an id; sameMarks compares mark for mark", () => {
  assert.deepEqual(cleanMarks([{ id: "iss", azimuth: -110, altitude: 42, label: "ISS", kind: "satellite" }]), [{ id: "iss", azimuth: 250, altitude: 42, label: "ISS", kind: "satellite" }]);
  const cleaned = cleanMarks([
    { id: "a", azimuth: 10, altitude: 100, label: "A" },
    { id: "a", azimuth: 20, altitude: 20, label: "again" },
    { id: "", azimuth: 1, altitude: 1, label: "no id" },
    { id: "b", azimuth: Number.NaN, altitude: 1, label: "bad" },
    { id: "c", azimuth: 1, altitude: "1", label: "bad" },
    { id: 7, azimuth: 1, altitude: -100, label: 5, kind: 3 },
    null,
    "text",
    42,
  ]);
  assert.deepEqual(cleaned, [{ id: "a", azimuth: 10, altitude: 90, label: "A" }, { id: "7", azimuth: 1, altitude: -90, label: "7" }]);
  assert.deepEqual(cleanMarks(null), []);
  assert.deepEqual(cleanMarks({ id: "x" }), []);
  assert.deepEqual(cleanMarks(undefined), []);
  assert.equal(cleanMarks(Array.from({ length: MARKS_MAX + 50 }, (_, i) => ({ id: `m${i}`, azimuth: i, altitude: 1, label: "x" }))).length, MARKS_MAX);
  const a = [{ id: "iss", azimuth: 250, altitude: 42, label: "ISS" }];
  assert.equal(sameMarks(a, [{ ...a[0]! }]), true);
  assert.equal(sameMarks(a, [{ ...a[0]!, altitude: 43 }]), false);
  assert.equal(sameMarks(a, [{ ...a[0]!, kind: "satellite" }]), false);
  assert.equal(sameMarks(a, []), false);
  assert.equal(sameMarks([], []), true);
});

test("the new words are in both languages with the same gaps, and fill", () => {
  const en = mySkyWords("en");
  const ja = mySkyWords("ja");
  const keys = ["targetUp", "targetDown", "targetRises", "targetSets", "targetNeverRises", "targetNoRise", "targetAlwaysUp", "targetBelowTag", "targetUnknown", "marksLabel"] as const;
  for (const key of keys) {
    assert.ok(en[key].length > 0 && ja[key].length > 0, key);
    assert.deepEqual([...en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), [...ja[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), `the gaps of ${key}`);
  }
  assert.equal(say(en.targetDown, { name: "Sirius", depth: 25, direction: en.direction.E }), "Sirius is below the horizon: 25° down, toward the east");
  assert.equal(say(ja.targetDown, { name: "シリウス", depth: 25, direction: ja.direction.E }), "シリウスは地平線の下にあります。東の方角、地平線から25°下です");
  assert.equal(say(en.targetUp, { name: "Saturn", altitude: 40, direction: en.direction.S }), "Saturn: 40° above the horizon, south");
});
