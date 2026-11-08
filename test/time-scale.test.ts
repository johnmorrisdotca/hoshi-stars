// UTC to Terrestrial Time, for the rotation of another planet: the leap seconds from 1972 to wakusei-planets' own conversion (a dev-only second opinion), delta T before 1972 to Espenak and Meeus's published values,
// and the effect on a sky: Mars turns 0.2815 degrees in 69.184 seconds.
import assert from "node:assert/strict";
import { test } from "node:test";
import { convertTimeScale } from "@johnmorrisdotca/wakusei-planets/time";
import { horizontalFrom, type PlanetSpin } from "../src/sky.ts";
import { terrestrialMinusUtc } from "../src/time-scale.ts";

const seconds = (ms: number): number => terrestrialMinusUtc(ms);

test("from 1972 the offset is the leap seconds plus 32.184 s, and it agrees with wakusei-planets to the millisecond", () => {
  assert.equal(seconds(Date.UTC(1972, 0, 1)), 42.184);
  assert.equal(seconds(Date.UTC(1971, 11, 31, 23, 59, 59)) < 42.3, true);
  assert.equal(seconds(Date.UTC(2016, 11, 31, 23, 59, 59)), 68.184);
  assert.equal(seconds(Date.UTC(2017, 0, 1)), 69.184);
  assert.equal(seconds(Date.UTC(2040, 0, 1)), 69.184);
  let checked = 0;
  for (let year = 1972; year <= 2030; year += 1) {
    for (const [month, day] of [[0, 1], [5, 30], [6, 1], [11, 31]] as const) {
      for (const hours of [0, 12, 23.999]) {
        const ms = Date.UTC(year, month, day) + hours * 3_600_000;
        const oracle = (convertTimeScale(ms, "utc", "tt") - ms) / 1000;
        assert.ok(Math.abs(seconds(ms) - oracle) < 1e-3, `${new Date(ms).toISOString()}: ${seconds(ms)} against ${oracle}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 600);
});

test("a leap second moves the offset exactly at the start of the day it is announced for", () => {
  for (const [year, month] of [[1972, 6], [1981, 6], [1999, 0], [2006, 0], [2012, 6], [2015, 6], [2017, 0]] as const) {
    const day = Date.UTC(year, month, 1);
    assert.equal(seconds(day) - seconds(day - 1), 1, new Date(day).toISOString());
  }
});

test("before 1972 it is delta T: Espenak and Meeus's values, and close to wakusei-planets' for the twentieth century", () => {
  const published: Array<[number, number]> = [[Date.UTC(1900, 0, 1), -2.79], [Date.UTC(1800, 0, 1), 13.72], [Date.UTC(1700, 0, 1), 8.83], [Date.UTC(1600, 0, 1), 120]];
  for (const [ms, value] of published) assert.ok(Math.abs(seconds(ms) - value) < 1e-9, new Date(ms).toISOString());
  for (const year of [1920, 1941, 1950, 1961, 1971]) {
    const ms = Date.UTC(year, 5, 1);
    assert.ok(Math.abs(seconds(ms) - (convertTimeScale(ms, "utc", "tt") - ms) / 1000) < 0.3, String(year));
  }
  // The pieces of the fit meet: no jump of more than a few tenths of a second between neighbouring years of any century.
  const start = (year: number): number => new Date(0).setUTCFullYear(year, 0, 1);
  for (let year = -600; year < 1971; year += 1) {
    const jump = Math.abs(seconds(start(year + 1)) - seconds(start(year)));
    assert.ok(jump < (year < 1600 ? 20 : 2), `year ${year}: ${jump}`);
  }
});

test("horizontalFrom takes UTC: a spin of one turn a day about the Earth's pole is read 69.184 s further on", () => {
  // The pole at declination 90 and W = 360 degrees a day from 0 at J2000.0: a star at right ascension 0 on the equator, seen from latitude 0, has sin(altitude) = cos(W).
  const spin: PlanetSpin = { pole: { rightAscension: 270, declination: 90 }, primeMeridian: { w0: 0, rate: 360 } };
  const star = { rightAscension: 0, declination: 0 };
  const cases: Array<[number, number]> = [[Date.UTC(2026, 10, 8, 3, 17, 5), 69.184], [Date.UTC(2010, 5, 1), 66.184], [Date.UTC(1999, 0, 1, 12), 64.184]];
  for (const [utc, offset] of cases) {
    const turn = (((utc + offset * 1000 - 946_728_000_000) / 86_400_000) * 360) % 360;
    const expected = (Math.asin(Math.cos((turn * Math.PI) / 180)) * 180) / Math.PI;
    const got = horizontalFrom(star, spin, { latitude: 0, longitude: 0 }, utc).altitude;
    assert.ok(Math.abs(got - expected) < 1e-6, `${new Date(utc).toISOString()}: ${got} against ${expected}`);
  }
});
