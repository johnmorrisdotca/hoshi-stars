// The birthday page's Sun (demo/sun.ts): the 13 constellations it crosses in 2020 and the moments it enters each, against Guy Ottewell's published table ("The Sun entering signs and
// constellations", universalworkshop.com, for 2020, IAU boundaries). His longitudes of the Sun at those moments agree with ours to 0.015 degrees; the moments differ by up to nine hours,
// because hoshi finds each edge by precessing to B1875 and looking it up in Roman's table of the IAU boundaries (tested against Roman's own positions in boundaries.test.ts), and where his
// edges cross the ecliptic is up to 0.33 degrees (eight hours of the Sun's motion) from that. So a moment passes within half a day of his.
import assert from "node:assert/strict";
import { test } from "node:test";
import { sunIn, sunPlace, sunStay, sunYear } from "../demo/sun.ts";

const OTTEWELL_2020: readonly [string, string][] = [
  ["Cap", "2020-01-20T09:00Z"],
  ["Aqr", "2020-02-17T03:00Z"],
  ["Psc", "2020-03-11T17:00Z"],
  ["Ari", "2020-04-18T17:00Z"],
  ["Tau", "2020-05-13T20:00Z"],
  ["Gem", "2020-06-21T09:00Z"],
  ["Cnc", "2020-07-20T13:00Z"],
  ["Leo", "2020-08-10T09:00Z"],
  ["Vir", "2020-09-16T14:00Z"],
  ["Lib", "2020-10-30T19:00Z"],
  ["Sco", "2020-11-23T00:00Z"],
  ["Oph", "2020-11-29T20:00Z"],
  ["Sgr", "2020-12-18T02:00Z"],
];
const HALF_DAY = 12 * 3_600_000;

test("in 2020 the Sun enters the 13 constellations of Ottewell's table, in his order, each within half a day of his moment", () => {
  const year = sunYear(2020);
  assert.equal(year[0]!.constellation.abbreviation, "Sgr");
  const entries = year.slice(1);
  assert.deepEqual(entries.map((one) => one.constellation.abbreviation), OTTEWELL_2020.map(([abbr]) => abbr));
  entries.forEach((one, i) => {
    const off = one.entered - Date.parse(OTTEWELL_2020[i]![1].replace("Z", ":00Z"));
    assert.ok(Math.abs(off) <= HALF_DAY, `${one.constellation.abbreviation}: ${(off / 3_600_000).toFixed(1)} hours from Ottewell`);
  });
});

test("the Sun is at the equinox and the solstice where it should be: right ascension 0 h in March, 6 h in June, declination 23.4 degrees", () => {
  const march = sunPlace(Date.UTC(2020, 2, 20, 3, 50));
  assert.ok(Math.min(march.rightAscension, 360 - march.rightAscension) < 0.05, `${march.rightAscension}`);
  assert.ok(Math.abs(march.declination) < 0.02);
  const june = sunPlace(Date.UTC(2020, 5, 20, 21, 44));
  assert.ok(Math.abs(june.rightAscension - 90) < 0.05, `${june.rightAscension}`);
  assert.ok(Math.abs(june.declination - 23.436) < 0.01, `${june.declination}`);
});

test("a stay runs from one edge to the next: on 1 December 2020 the Sun is in Ophiuchus, which it entered on 29 November and leaves on 18 December", () => {
  const stay = sunStay(Date.UTC(2020, 11, 1, 12));
  assert.equal(stay.constellation.abbreviation, "Oph");
  assert.equal(new Date(stay.entered).toISOString().slice(0, 10), "2020-11-29");
  assert.equal(new Date(stay.left).toISOString().slice(0, 10), "2020-12-18");
  assert.equal(sunIn(stay.entered - 3_600_000).abbreviation, "Sco");
  assert.equal(sunIn(stay.left + 3_600_000).abbreviation, "Sgr");
});
