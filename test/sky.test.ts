// Your sky against published answers: J. Meeus, "Astronomical Algorithms" 2nd ed. examples 12.a, 12.b, 13.b and 21.b; the pole star standing as high as the latitude; the zenith, nadir and compass points;
// another planet's sky (IAU WGCCRE Mars, a retrograde spin, and Earth's own spin as a check); wakusei-planets as a dev-only second opinion; bad input; and a speed budget.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { equatorialToHorizontal } from "@johnmorrisdotca/wakusei-planets/coordinates";
import { starByHr, starByName, starPosition, stars } from "../src/stars.ts";
import { greenwichSiderealTime, horizontal, horizontalFrom, isAboveHorizon, localSiderealTime, precess, type Observer, type PlanetSpin, type SkyPoint } from "../src/sky.ts";

const DEG = 180 / Math.PI;
const ARCSECOND = 1 / 3600;

function close(actual: number, expected: number, tolerance: number, what: string): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected} (tolerance ${tolerance})`);
}
function gap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}
/** The angle between two sky points from their dot product's chord, which stays exact for close pairs. */
function separation(a: SkyPoint, b: SkyPoint): number {
  const r = Math.PI / 180;
  const v = (p: SkyPoint): number[] => [Math.cos(p.declination * r) * Math.cos(p.rightAscension * r), Math.cos(p.declination * r) * Math.sin(p.rightAscension * r), Math.sin(p.declination * r)];
  const [p, q] = [v(a), v(b)];
  return 2 * Math.asin(Math.min(1, Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!) / 2)) * DEG;
}
function dms(d: number, m: number, s: number): number {
  return d + m / 60 + s / 3600;
}

test("Greenwich sidereal time: Meeus examples 12.a and 12.b", () => {
  // 12.a: 1987 April 10, 0h UT, JD 2446895.5: 13h10m46.3668s = 197.693195 degrees
  close(greenwichSiderealTime(Date.UTC(1987, 3, 10)), 197.693195, 1e-6, "12.a");
  close(greenwichSiderealTime(new Date(Date.UTC(1987, 3, 10))), 197.693195, 1e-6, "12.a as a Date");
  // 12.b: 1987 April 10, 19h21m00s UT: the mean sidereal time is 8h34m57.0896s = 128.7378734 degrees
  close(greenwichSiderealTime(Date.UTC(1987, 3, 10, 19, 21, 0)), 128.7378734, 1e-6, "12.b");
  close(greenwichSiderealTime(Date.UTC(2000, 0, 1, 12)), 280.46061837, 1e-9, "J2000.0");
  for (const ms of [-1e12, -86_400_000, 0, 946_728_000_000, 1e12, 4e12]) {
    const t = greenwichSiderealTime(ms);
    assert.ok(t >= 0 && t < 360, `${ms} gave ${t}`);
  }
});

test("a sidereal day is 23h56m04.0905s and local time is Greenwich time plus the east longitude", () => {
  const start = Date.UTC(2026, 10, 8, 3);
  const day = 86_164.0905 * 1000;
  close(gap(greenwichSiderealTime(start), greenwichSiderealTime(start + day)), 0, 1e-4, "after one sidereal day");
  close(gap(localSiderealTime(start, 90), greenwichSiderealTime(start) + 90), 0, 1e-8, "90 east");
  close(gap(localSiderealTime(start, -123.12), greenwichSiderealTime(start) - 123.12), 0, 1e-8, "123.12 west");
  close(gap(localSiderealTime(start, 450), localSiderealTime(start, 90)), 0, 1e-9, "longitude wraps");
});

test("precession: Meeus example 21.b, theta Persei carried from J2000 to 2028 November 13.19 TD, within 1 arc-second", () => {
  // The book first moves the star by its proper motion to the date: alpha0 = 2h44m12.975s, delta0 = +49 13 39.90. The answer is alpha = 2h46m11.331s, delta = +49 20 54.54.
  const there = precess({ rightAscension: (2 * 3600 + 44 * 60 + 12.975) / 240, declination: dms(49, 13, 39.9) }, Date.UTC(2028, 10, 13, 4, 33, 36));
  close(there.rightAscension, (2 * 3600 + 46 * 60 + 11.331) / 240, ARCSECOND, "right ascension");
  close(there.declination, dms(49, 20, 54.54), ARCSECOND, "declination");
});

test("precession: nothing at J2000, the pole circles slowly, and it is a rotation (angles between stars are kept)", () => {
  const a = { rightAscension: 123.4, declination: -56.7 };
  const same = precess(a, 946_728_000_000);
  close(same.rightAscension, a.rightAscension, 1e-9, "RA at J2000");
  close(same.declination, a.declination, 1e-9, "dec at J2000");
  // The J2000 pole is carried away from the pole of the date by theta = 2004.3109 arc-seconds a century: 20.04 arc-seconds, 0.005568 degrees, after a year (366 days from 2000 January 1.5 to 2001 January 1.5: 0.005579).
  const pole = precess({ rightAscension: 0, declination: 90 }, Date.UTC(2001, 0, 1, 12));
  close(pole.declination, 90 - 0.005579, 1e-5, "pole distance after a year");
  const b = { rightAscension: 200, declination: 10 };
  const when = Date.UTC(2150, 5, 1);
  close(separation(precess(a, when), precess(b, when)), separation(a, b), 1e-9, "separation kept");
  const nearPole = precess({ rightAscension: 10, declination: 89.99999 }, Date.UTC(2100, 0, 1));
  assert.ok(nearPole.declination <= 90 && nearPole.rightAscension >= 0 && nearPole.rightAscension < 360);
});

test("horizontal: Meeus example 13.b, Venus from the US Naval Observatory, within 0.01 degree", () => {
  // 1987 April 10, 19h21m00s UT; Venus (of the date) alpha = 23h09m16.641s, delta = -6 43 11.61; latitude +38 55 17, longitude 77 03 56 W.
  // The book gets altitude 15.1249 and azimuth 68.0337 measured from the SOUTH toward the west, which is 248.0337 from north through east.
  const venus = { rightAscension: (23 * 3600 + 9 * 60 + 16.641) / 240, declination: -dms(6, 43, 11.61) };
  const washington: Observer = { latitude: dms(38, 55, 17), longitude: -dms(77, 3, 56) };
  const view = horizontal(venus, washington, Date.UTC(1987, 3, 10, 19, 21, 0), { equinox: "date" });
  close(view.altitude, 15.1249, 0.01, "altitude");
  close(view.azimuth, 68.0337 + 180, 0.01, "azimuth");
  assert.equal(isAboveHorizon(venus, washington, Date.UTC(1987, 3, 10, 19, 21, 0), { equinox: "date" }), true);
});

test("Polaris stands as high as the observer's latitude, within 1 degree, at any hour", () => {
  const polaris = starPosition(starByName("Polaris")!, Date.UTC(2026, 10, 8));
  for (const latitude of [5, 20, 35, 49.28, 60, 75, 85]) {
    for (let hour = 0; hour < 24; hour += 3) {
      const view = horizontal(polaris, { latitude, longitude: -123.12 }, Date.UTC(2026, 10, 8, hour));
      close(view.altitude, latitude, 1, `Polaris at ${latitude} N, ${hour}h`);
      if (latitude <= 60) assert.ok(gap(view.azimuth, 0) < 3, `Polaris at ${latitude} N, ${hour}h is ${view.azimuth} from north`);
    }
  }
  assert.equal(isAboveHorizon(polaris, { latitude: -30, longitude: 0 }, Date.UTC(2026, 10, 8)), false);
  assert.equal(isAboveHorizon(polaris, { latitude: 30, longitude: 0 }, Date.UTC(2026, 10, 8)), true);
});

test("the zenith, the nadir and the compass points", () => {
  const when = Date.UTC(2026, 3, 20, 11, 11, 11);
  for (const [latitude, longitude] of [[49.28, -123.12], [-33.9, 151.2], [0, 0], [64, 25]] as const) {
    const lst = localSiderealTime(when, longitude);
    const observer = { latitude, longitude };
    const up = horizontal({ rightAscension: lst, declination: latitude }, observer, when, { equinox: "date" });
    close(up.altitude, 90, 1e-9, `zenith at ${latitude}`);
    const down = horizontal({ rightAscension: lst + 180, declination: -latitude }, observer, when, { equinox: "date" });
    close(down.altitude, -90, 1e-9, `nadir at ${latitude}`);
    // On the meridian a star north of the zenith is due north and one south of it is due south; one 90 degrees east of the meridian on the equator is due east.
    if (latitude < 80) {
      const north = horizontal({ rightAscension: lst, declination: latitude + 10 }, observer, when, { equinox: "date" });
      close(north.altitude, 80, 1e-9, "north of the zenith");
      close(gap(north.azimuth, 0), 0, 1e-7, "due north");
      const south = horizontal({ rightAscension: lst, declination: latitude - 10 }, observer, when, { equinox: "date" });
      close(gap(south.azimuth, 180), 0, 1e-7, "due south");
    }
    const east = horizontal({ rightAscension: lst + 90, declination: 0 }, { latitude: 0, longitude }, when, { equinox: "date" });
    close(east.altitude, 0, 1e-9, "rising");
    close(east.azimuth, 90, 1e-9, "due east");
    const west = horizontal({ rightAscension: lst - 90, declination: 0 }, { latitude: 0, longitude }, when, { equinox: "date" });
    close(west.azimuth, 270, 1e-9, "due west");
  }
});

test("the azimuth always lies from 0 up to but not including 360, and goes round the compass as the sky turns", () => {
  let seed = 7;
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 20_000; i += 1) {
    const view = horizontal({ rightAscension: random() * 720 - 360, declination: Math.asin(random() * 2 - 1) * DEG }, { latitude: random() * 180 - 90, longitude: random() * 1000 - 500 }, random() * 4e12 - 2e12);
    assert.ok(view.azimuth >= 0 && view.azimuth < 360, `azimuth ${view.azimuth}`);
    assert.ok(view.altitude >= -90 && view.altitude <= 90, `altitude ${view.altitude}`);
  }
  // A star within 10 degrees of the pole, seen from 5 degrees off the pole, goes all the way round the compass once a sidereal day, so its azimuth wraps through north.
  let wrapped = 0;
  let last = horizontal({ rightAscension: 0, declination: 80 }, { latitude: 85, longitude: 0 }, Date.UTC(2026, 0, 1)).azimuth;
  for (let minute = 1; minute <= 1440; minute += 1) {
    const now = horizontal({ rightAscension: 0, declination: 80 }, { latitude: 85, longitude: 0 }, Date.UTC(2026, 0, 1) + minute * 60_000).azimuth;
    if (Math.abs(now - last) > 180) wrapped += 1;
    last = now;
  }
  assert.ok(wrapped >= 1, "the azimuth wrapped 360 -> 0 at least once in a day");
});

test("refraction: off by default, about 0.48 degree at the horizon, nothing at the zenith, scaled by the air, and off below -1 degree", () => {
  const observer = { latitude: 0, longitude: 0 };
  const when = Date.UTC(2026, 5, 1);
  const lst = localSiderealTime(when, 0);
  const at = (altitude: number): SkyPoint => ({ rightAscension: lst - (90 - altitude), declination: 0 });
  for (const altitude of [-0.5, 0, 5, 45, 89.9]) {
    const flat = horizontal(at(altitude), observer, when, { equinox: "date" });
    close(flat.altitude, altitude, 1e-9, "the geometric altitude");
    const bent = horizontal(at(altitude), observer, when, { equinox: "date", refraction: true });
    const lift = bent.altitude - altitude;
    // Saemundsson typed again: R in arc-minutes is 1.02 / tan(h + 10.3 / (h + 5.11)), plus 0.0019279 for the zenith
    const expected = (1.02 / Math.tan(((altitude + 10.3 / (altitude + 5.11)) * Math.PI) / 180) + 0.0019279) / 60;
    close(lift, expected, 1e-9, `lift at ${altitude}`);
    close(bent.azimuth, flat.azimuth, 1e-12, "refraction does not move the azimuth");
  }
  close(horizontal(at(0), observer, when, { equinox: "date", refraction: true }).altitude, 0.4833, 0.002, "horizon, about 29 arc-minutes");
  close(horizontal(at(45), observer, when, { equinox: "date", refraction: true }).altitude - 45, 0.0169, 0.001, "45 degrees, about 1 arc-minute");
  close(horizontal(at(90), observer, when, { equinox: "date", refraction: true }).altitude, 90, 1e-4, "zenith");
  close(horizontal(at(-5), observer, when, { equinox: "date", refraction: true }).altitude, -5, 1e-9, "well below the horizon");
  const standard = horizontal(at(10), observer, when, { equinox: "date", refraction: true }).altitude - 10;
  const thin = horizontal(at(10), observer, when, { equinox: "date", refraction: true, pressureHpa: 505 }).altitude - 10;
  close(thin, standard / 2, 1e-9, "half the pressure, half the bending");
  const cold = horizontal(at(10), observer, when, { equinox: "date", refraction: true, temperatureC: -20 }).altitude - 10;
  assert.ok(cold > standard, "colder air bends more");
  assert.equal(isAboveHorizon(at(-0.3), observer, when, { equinox: "date" }), false);
  assert.equal(isAboveHorizon(at(-0.3), observer, when, { equinox: "date", refraction: true }), true);
});

test("heightM is accepted and changes nothing", () => {
  const p = { rightAscension: 88.79, declination: 7.41 };
  const when = Date.UTC(2026, 10, 8, 4);
  assert.deepEqual(horizontal(p, { latitude: 35.36, longitude: 138.73, heightM: 3776 }, when), horizontal(p, { latitude: 35.36, longitude: 138.73 }, when));
});

test("another planet: a spin equal to the Earth's gives the Earth's sky", () => {
  // Pole at declination 90 (the right ascension 270 puts the equator's node at right ascension 0), W the Greenwich sidereal angle: 280.46061837 degrees at 12:00 UT on 2000 January 1 and 360.98564736629 a day.
  // `horizontalFrom` counts from J2000.0 in Terrestrial Time, which is 64.184 s after that UTC moment, so the angle at the epoch is that much less.
  const earth: PlanetSpin = { pole: { rightAscension: 270, declination: 90 }, primeMeridian: { w0: 280.46061837 - (360.98564736629 * 64.184) / 86400, rate: 360.98564736629 } };
  const places: Observer[] = [{ latitude: 49.28, longitude: -123.12 }, { latitude: -33.9, longitude: 151.2 }, { latitude: 0, longitude: 0 }, { latitude: 89, longitude: 40 }];
  const sky: SkyPoint[] = [starPosition(starByName("Sirius")!), starPosition(starByName("Polaris")!), starPosition(starByName("Canopus")!), { rightAscension: 12.5, declination: 3 }];
  // At J2000 itself nothing has precessed yet, so the two agree to rounding.
  for (const hours of [-6, 0, 5.5, 6]) {
    const when = 946_728_000_000 + hours * 3_600_000;
    for (const observer of places) {
      for (const star of sky) {
        const here = horizontal(star, observer, when);
        const there = horizontalFrom(star, earth, observer, when);
        close(there.altitude, here.altitude, 1e-4, "altitude within a few thousandths of an arc-second per hour of precession");
        if (Math.abs(here.altitude) < 89.9) close(gap(there.azimuth, here.azimuth), 0, 1e-3, "azimuth");
      }
    }
  }
  // A month either side the fixed pole has drifted from the true one by about 4 arc-seconds, 0.001 degree.
  for (const days of [-30, 15, 30]) {
    const when = 946_728_000_000 + days * 86_400_000;
    for (const star of sky) {
      const here = horizontal(star, places[0]!, when);
      const there = horizontalFrom(star, earth, places[0]!, when);
      close(there.altitude, here.altitude, 0.002, `${days} days from J2000`);
    }
  }
  // Years on, the fixed pole and the real one part by the precession (about 0.36 degree by 2026), which is why the pole is an argument.
  const sirius = starPosition(starByName("Sirius")!);
  const drift = Math.abs(horizontalFrom(sirius, earth, places[1]!, Date.UTC(2026, 10, 8)).altitude - horizontal(sirius, places[1]!, Date.UTC(2026, 10, 8)).altitude);
  assert.ok(drift > 0.05 && drift < 0.5, `precession since 2000 moves the sky ${drift} degrees`);
});

// IAU WGCCRE, Archinal et al. (2018), "Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015", Celestial Mechanics and Dynamical Astronomy 130, 22, Table 1, Mars at J2000:
// pole alpha0 = 317.269202, delta0 = 54.432516, W = 176.049863 + 350.891982443297 d (d days since J2000.0). The pole's drift (-0.109 and -0.058 degrees a century) and the periodic terms are left out.
const mars: PlanetSpin = { pole: { rightAscension: 317.269202, declination: 54.432516 }, primeMeridian: { w0: 176.049863, rate: 350.891982443297 } };

test("Mars: its celestial north pole lies near Deneb (alpha Cygni), and from the pole the stars stay at fixed altitudes", () => {
  const deneb = starPosition(starByName("Deneb")!);
  const away = separation(deneb, mars.pole);
  assert.ok(away > 9 && away < 12, `Deneb is ${away} degrees from Mars's pole`);
  // Alderamin (alpha Cephei, HR 8162) lies on the other side, about 8 degrees off; no star brighter than magnitude 2.5 is nearer than that, so the pole sits in the Cygnus-Cepheus corner, "near Deneb".
  const alderamin = separation(starPosition(starByHr(8162)!), mars.pole);
  assert.ok(alderamin > 7 && alderamin < 9, `Alderamin is ${alderamin} degrees from Mars's pole`);
  assert.equal(stars().filter((star) => star.magnitude < 2.5 && separation(star, mars.pole) < alderamin - 0.01).length, 0);
  // Standing on the pole, a star's altitude is its declination in the planet's frame: it never changes with the time or the longitude.
  for (const when of [Date.UTC(2000, 0, 1, 12), Date.UTC(2026, 10, 8), Date.UTC(2031, 3, 2, 5, 6, 7)]) {
    for (const longitude of [0, 90, -170]) {
      close(horizontalFrom(deneb, mars, { latitude: 90, longitude }, when).altitude, 90 - away, 1e-9, "Deneb from Mars's pole");
    }
  }
  // Near the pole (latitude 85) Deneb stays within its distance from the pole of 85 degrees up, all through a Martian day, and circles the pole once.
  let lowest = 90;
  let highest = -90;
  for (let step = 0; step < 24; step += 1) {
    const altitude = horizontalFrom(deneb, mars, { latitude: 85, longitude: 20 }, Date.UTC(2026, 10, 8) + step * 3_600_000).altitude;
    lowest = Math.min(lowest, altitude);
    highest = Math.max(highest, altitude);
  }
  assert.ok(lowest > 85 - away - 1 && highest < 85 + away + 1, `Deneb ranged ${lowest} to ${highest} degrees`);
  // The north star of Mars is far off Earth's: its pole is about 10 degrees from Deneb, which from Earth's north is high but circling.
  const earth = horizontal(deneb, { latitude: 90, longitude: 0 }, Date.UTC(2026, 10, 8));
  close(earth.altitude, 45.28, 0.4, "Deneb from Earth's north pole is at its declination");
});

test("Mars: the sky comes back after one sidereal rotation, 24h37m22.66s", () => {
  const rotation = 360 / mars.primeMeridian.rate; // days
  close(rotation * 86400, 24 * 3600 + 37 * 60 + 22.66, 0.01, "the sidereal day of Mars");
  const start = Date.UTC(2026, 10, 8, 1, 2, 3);
  const star = starPosition(starByName("Sirius")!);
  for (const observer of [{ latitude: 30, longitude: 45 }, { latitude: -60, longitude: 170 }]) {
    const a = horizontalFrom(star, mars, observer, start);
    const b = horizontalFrom(star, mars, observer, start + rotation * 86_400_000);
    close(b.altitude, a.altitude, 1e-6, "altitude one rotation later");
    close(gap(b.azimuth, a.azimuth), 0, 1e-6, "azimuth one rotation later");
  }
});

test("another planet: a planet that turns the other way (negative rate) has its stars rise in the west, and an eastward one in the east", () => {
  const spin = (rate: number): PlanetSpin => ({ pole: { rightAscension: 272.76, declination: 67.16 }, primeMeridian: { w0: 160.2, rate } });
  const observer = { latitude: 10, longitude: 30 };
  const star = { rightAscension: 10, declination: 20 };
  let checked = 0;
  for (let step = 0; step < 96; step += 1) {
    const when = Date.UTC(2026, 10, 8) + step * 900_000;
    for (const rate of [350.89, -350.89]) {
      const now = horizontalFrom(star, spin(rate), observer, when);
      const later = horizontalFrom(star, spin(rate), observer, when + 60_000);
      if (Math.abs(now.altitude) > 80) continue;
      const rising = later.altitude > now.altitude;
      const east = now.azimuth < 180;
      assert.equal(rising, rate > 0 ? east : !east, `rate ${rate} at step ${step}: altitude ${now.altitude} azimuth ${now.azimuth}`);
      checked += 1;
    }
  }
  assert.ok(checked > 100, `${checked} checks`);
});

test("wakusei-planets as a second opinion (dev only): its equatorialToHorizontal agrees with horizontal", () => {
  const cases: Array<[SkyPoint, Observer, number]> = [
    [{ rightAscension: 101.287, declination: -16.716 }, { latitude: 49.28, longitude: -123.12 }, Date.UTC(2026, 10, 8, 6)],
    [{ rightAscension: 279.2347, declination: 38.7837 }, { latitude: -33.87, longitude: 151.21 }, Date.UTC(2031, 5, 1, 17, 30)],
    [{ rightAscension: 37.95, declination: 89.264 }, { latitude: 35.68, longitude: 139.69 }, Date.UTC(1999, 11, 31, 23, 59, 59)],
    [{ rightAscension: 0, declination: 0 }, { latitude: 0, longitude: 0 }, Date.UTC(2050, 0, 1)],
  ];
  for (const [position, observer, when] of cases) {
    const mine = horizontal(position, observer, when, { equinox: "date" });
    const theirs = equatorialToHorizontal({ origin: "geocentric", frame: "equatorialOfDate", epoch: when, corrections: "geometric", rightAscension: position.rightAscension, declination: position.declination }, when, { observer });
    close(mine.altitude, theirs.altitude, 1e-7, "altitude");
    close(gap(mine.azimuth, theirs.azimuth), 0, 1e-6, "azimuth");
  }
});

test("this package never imports wakusei-planets: no source mentions it and no dependency names it", () => {
  const dir = new URL("../src/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) assert.ok(!/wakusei/i.test(readFileSync(new URL(file, dir), "utf8")), `src/${file} mentions wakusei`);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as Record<string, unknown>;
  assert.equal(pkg.dependencies, undefined);
  // the one peer is kazoku-ui, optional, for the chart element's hands; wakusei-planets is never one
  assert.deepEqual(Object.keys((pkg.peerDependencies ?? {}) as object), ["@johnmorrisdotca/kazoku-ui"]);
  assert.deepEqual((pkg.peerDependenciesMeta as Record<string, unknown> | undefined)?.["@johnmorrisdotca/kazoku-ui"], { optional: true });
  assert.ok(!/wakusei/i.test(JSON.stringify(pkg.peerDependencies ?? {})));
});

test("bad input throws, naming the argument and the value", () => {
  const ok = { rightAscension: 10, declination: 20 };
  const here = { latitude: 40, longitude: -100 };
  const when = Date.UTC(2026, 0, 1);
  const named = (type: new (...a: never[]) => Error, text: RegExp) => (e: Error) => e instanceof type && text.test(e.message);
  assert.throws(() => horizontal({ rightAscension: Number.NaN, declination: 0 }, here, when), named(RangeError, /position\.rightAscension.*NaN/));
  assert.throws(() => horizontal({ rightAscension: 0, declination: 91 }, here, when), named(RangeError, /position\.declination.*-90 and 90.*91/));
  assert.throws(() => horizontal(undefined as unknown as SkyPoint, here, when), named(TypeError, /position/));
  assert.throws(() => horizontal(ok, { latitude: 90.5, longitude: 0 }, when), named(RangeError, /observer\.latitude.*90\.5/));
  assert.throws(() => horizontal(ok, { latitude: 0, longitude: Number.POSITIVE_INFINITY }, when), named(RangeError, /observer\.longitude.*Infinity/));
  assert.throws(() => horizontal(ok, { latitude: 0, longitude: 0, heightM: Number.NaN }, when), named(RangeError, /observer\.heightM/));
  assert.throws(() => horizontal(ok, undefined as unknown as Observer, when), named(TypeError, /observer/));
  assert.throws(() => horizontal(ok, here, Number.NaN), named(RangeError, /when.*NaN/));
  assert.throws(() => horizontal(ok, here, new Date("nope")), named(RangeError, /when/));
  assert.throws(() => horizontal(ok, here, "2026" as unknown as number), named(TypeError, /when.*string/));
  assert.throws(() => horizontal(ok, here, when, { equinox: "B1950" as "date" }), named(RangeError, /options\.equinox.*B1950/));
  assert.throws(() => horizontal(ok, here, when, { refraction: true, pressureHpa: 0 }), named(RangeError, /options\.pressureHpa.*0/));
  assert.throws(() => horizontal(ok, here, when, { refraction: true, temperatureC: Number.NaN }), named(RangeError, /options\.temperatureC/));
  assert.throws(() => isAboveHorizon(ok, { latitude: -91, longitude: 0 }, when), named(RangeError, /observer\.latitude/));
  assert.throws(() => greenwichSiderealTime(Number.POSITIVE_INFINITY), named(RangeError, /when/));
  assert.throws(() => localSiderealTime(when, Number.NaN), named(RangeError, /longitude.*NaN/));
  assert.throws(() => precess({ rightAscension: 0, declination: -100 }, when), named(RangeError, /position\.declination/));
  assert.throws(() => horizontalFrom(ok, undefined as unknown as PlanetSpin, here, when), named(TypeError, /spin/));
  assert.throws(() => horizontalFrom(ok, { ...mars, pole: { rightAscension: 0, declination: 95 } }, here, when), named(RangeError, /spin\.pole\.declination.*95/));
  assert.throws(() => horizontalFrom(ok, { pole: mars.pole } as unknown as PlanetSpin, here, when), named(TypeError, /spin\.primeMeridian/));
  assert.throws(() => horizontalFrom(ok, { ...mars, primeMeridian: { w0: Number.NaN, rate: 1 } }, here, when), named(RangeError, /spin\.primeMeridian\.w0.*NaN/));
  assert.throws(() => horizontalFrom(ok, { ...mars, primeMeridian: { w0: 0, rate: Number.POSITIVE_INFINITY } }, here, when), named(RangeError, /spin\.primeMeridian\.rate/));
  assert.throws(() => horizontalFrom(ok, mars, { latitude: 100, longitude: 0 }, when), named(RangeError, /observer\.latitude/));
  assert.throws(() => horizontalFrom(ok, mars, here, Number.NaN), named(RangeError, /when/));
});

test("speed: 100,000 horizontal conversions stay inside a stated budget", () => {
  // Measured on the author's Mac (Node 24): about 26 ms for 100,000 conversions (precession, sidereal time and the horizon formulas each time). The budget is 250 ms, nearly ten times that: a shared CI machine is about four times slower than the Mac and varies.
  // The best of five passes after a warm-up is timed: the test files run side by side, so one pass can share the machine with another file's work.
  const BUDGET_MS = 250;
  let seed = 4242;
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const points: SkyPoint[] = [];
  for (let i = 0; i < 100_000; i += 1) points.push({ rightAscension: random() * 360, declination: Math.asin(random() * 2 - 1) * DEG });
  const observer = { latitude: 49.28, longitude: -123.12 };
  const when = Date.UTC(2026, 10, 8);
  let up = 0;
  let took = Infinity;
  for (let pass = 0; pass < 6; pass += 1) {
    up = 0;
    const start = performance.now();
    for (const point of points) if (horizontal(point, observer, when).altitude > 0) up += 1;
    if (pass > 0) took = Math.min(took, performance.now() - start);
  }
  assert.ok(up > 40_000 && up < 60_000, `${up} of 100,000 were up`);
  assert.ok(took < BUDGET_MS, `100,000 conversions took ${took.toFixed(0)} ms; the budget is ${BUDGET_MS} ms`);
  console.log(`100,000 horizontal conversions: ${took.toFixed(1)} ms`);
});
