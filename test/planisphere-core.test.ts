// The planisphere page's sums: the window is the printed plate's window, a star lands where the printed disc puts it, a star is inside the window exactly when horizontal() says it is above the horizon (north and south, every latitude band, every
// hour), turning the disc moves the moment and the moment turns the disc, and the address's date and time are read and written without a slip.
import assert from "node:assert/strict";
import { test } from "node:test";
import { discTurn, insideWindow, labelledStars, momentAfterTurn, momentText, namedStarsInWindow, parseMoment, sheetPosition, wheelGeometry, WHEEL_SHEET } from "../demo/planisphere-core.ts";
import { horizontal } from "../src/sky.ts";
import { starByName, stars, starPosition } from "../src/stars.ts";
import { starWheelDisc, starWheelPlate } from "../src/sheets/wheel.ts";

const number = (markup: string, tag: string, name: string): number => Number(new RegExp(`${name}="([-0-9.]+)"`).exec(tag)![1]);
const LATITUDES = [45, -45, 20, -20, 34, -34, 60, -60, 70, -70, 52];

test("the window is the window of the printed plate, north and south", () => {
  for (const latitude of LATITUDES) {
    const plate = starWheelPlate(latitude, { widthMm: WHEEL_SHEET.width, heightMm: 400, type: "normal" });
    const tag = /<circle[^>]*data-cut="window"[^>]*>/.exec(plate)![0];
    const w = wheelGeometry(latitude).window;
    assert.ok(Math.abs(number(plate, tag, "cx") - w.x) < 0.01, `x at ${latitude}`);
    assert.ok(Math.abs(number(plate, tag, "cy") - w.y) < 0.01, `y at ${latitude}`);
    assert.ok(Math.abs(number(plate, tag, "r") - w.r) < 0.01, `r at ${latitude}`);
    const rim = /<circle[^>]*data-cut="plate"[^>]*>/.exec(plate)![0];
    assert.equal(number(plate, rim, "r"), WHEEL_SHEET.radius);
  }
});

test("a star lands where the printed disc draws it, north and south", () => {
  for (const latitude of [45, -34]) {
    const disc = starWheelDisc(latitude, { widthMm: WHEEL_SHEET.width, heightMm: 400, type: "normal" });
    let checked = 0;
    for (const found of disc.matchAll(/<circle cx="([-0-9.]+)" cy="([-0-9.]+)" r="[-0-9.]+" fill="#000" data-hr="(\d+)"\/>/g)) {
      const star = stars().find((s) => s.hr === Number(found[3]))!;
      const spot = sheetPosition(star, latitude, 0);
      assert.ok(Math.abs(spot.x - Number(found[1])) < 0.02 && Math.abs(spot.y - Number(found[2])) < 0.02, `HR ${star.hr} at ${latitude}`);
      checked += 1;
    }
    assert.ok(checked > 1000, `${checked} stars compared`);
  }
});

test("inside the window is above the horizon: every star to magnitude 4.5 against horizontal(), for each latitude and 12 hours of the night", () => {
  const bright = stars().filter((s) => s.magnitude <= 4.5);
  let compared = 0;
  for (const latitude of LATITUDES) {
    for (let hour = 0; hour < 24; hour += 2) {
      const when = Date.UTC(2026, 10, 8, hour, 17);
      const turn = discTurn(latitude, when);
      for (const star of bright) {
        const sky = horizontal(starPosition(star), { latitude, longitude: 0 }, when);
        if (Math.abs(sky.altitude) < 1) continue; // the disc keeps J2000 positions while horizontal() carries the star to the date: 26 years of precession move a star by up to about 0.4 degrees, so one within a degree of the horizon may be on either side
        assert.equal(insideWindow(sheetPosition(star, latitude, turn), latitude), sky.altitude > 0, `HR ${star.hr} at latitude ${latitude}, ${hour}:17 (altitude ${sky.altitude.toFixed(2)})`);
        compared += 1;
      }
    }
  }
  assert.ok(compared > 40000, `${compared} comparisons`);
});

test("turning the disc moves the moment and the moment turns the disc", () => {
  const when = Date.UTC(2026, 10, 8, 21, 0);
  for (const latitude of [45, -45]) {
    const before = discTurn(latitude, when);
    const after = discTurn(latitude, momentAfterTurn(latitude, when, 30));
    assert.ok(Math.abs((((after - before - 30) % 360) + 540) % 360 - 180) < 1e-6, `a turn of 30 degrees at ${latitude}`);
  }
  // clockwise in the north is an earlier time, clockwise in the south a later one
  assert.ok(momentAfterTurn(45, when, 15) < when);
  assert.ok(momentAfterTurn(-45, when, 15) > when);
  assert.throws(() => momentAfterTurn(45, Number.NaN, 1), RangeError);
});

test("the named stars in the window: Sirius up and Canopus down over latitude 45, the reverse of Polaris over -45, and the list is the horizon's", () => {
  const when = Date.UTC(2026, 11, 20, 21, 0);
  const names = (latitude: number): string[] => namedStarsInWindow(latitude, when).map((s) => s.name!);
  assert.ok(names(45).includes("Sirius") && !names(45).includes("Canopus") && names(45).includes("Polaris"));
  assert.ok(names(-45).includes("Canopus") && !names(-45).includes("Polaris"));
  for (const latitude of [45, -45]) {
    const inside = new Set(namedStarsInWindow(latitude, when).map((s) => s.hr));
    for (const star of labelledStars()) {
      const alt = horizontal(starPosition(star), { latitude, longitude: 0 }, when).altitude;
      if (Math.abs(alt) >= 1) assert.equal(inside.has(star.hr), alt > 0, `${star.name} at ${latitude}`);
    }
  }
  assert.equal(labelledStars()[0]!.name, "Sirius");
  assert.ok(starByName("Vega") !== undefined);
});

test("the address's date and time: read, refused when not a real day, and written to the minute", () => {
  assert.equal(parseMoment("2026-11-08", "21:30"), Date.UTC(2026, 10, 8, 21, 30));
  for (const [date, time] of [["2026-02-30", "21:30"], ["2026-11-08", "24:00"], ["2026-11-08", "9:5"], [null, "21:30"], ["2026-11-08", undefined], ["tonight", "21:30"]] as const) assert.equal(parseMoment(date, time), undefined, `${String(date)} ${String(time)}`);
  assert.deepEqual(momentText(Date.UTC(2026, 10, 8, 21, 30, 40)), { date: "2026-11-08", time: "21:31" });
  assert.deepEqual(momentText(Date.UTC(2026, 11, 31, 23, 59, 40)), { date: "2027-01-01", time: "00:00" });
  assert.throws(() => momentText(Number.NaN), RangeError);
  assert.throws(() => wheelGeometry(91), RangeError);
});
