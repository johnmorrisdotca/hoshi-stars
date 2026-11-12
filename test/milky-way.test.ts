// The Milky Way tier: the frame it is in, the band following the galactic equator, the core and the dust lanes, the size of the data and the bands as polygons.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fromGalactic, MILKY_WAY_NIGHT_RAMP, milkyWayBands, milkyWayBrightness, milkyWayTexture, toGalactic } from "../src/milky-way.ts";

const at = (longitude: number, latitude: number): number => milkyWayBrightness(fromGalactic({ longitude, latitude }));
const mean = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length;
const range = (from: number, to: number, step: number): number[] => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const disc = (longitude: number, latitude: number, radius: number): number[] =>
  range(-radius, radius, 0.5).flatMap((dl) => range(-radius, radius, 0.5).filter((db) => Math.hypot(dl, db) <= radius).map((db) => at(longitude + dl, latitude + db)));

test("toGalactic and fromGalactic are the IAU frame: Sagittarius A*, the pole, M31 and the way back", () => {
  const centre = toGalactic({ rightAscension: 266.4168, declination: -29.0078 });
  assert.ok(Math.abs(centre.latitude) < 0.1 && (centre.longitude < 0.1 || centre.longitude > 359.9), JSON.stringify(centre));
  assert.ok(toGalactic({ rightAscension: 192.85948, declination: 27.12825 }).latitude > 89.999);
  const m31 = toGalactic({ rightAscension: 10.6847, declination: 41.2688 });
  assert.ok(Math.abs(m31.longitude - 121.17) < 0.05 && Math.abs(m31.latitude + 21.57) < 0.05, JSON.stringify(m31));
  for (const [longitude, latitude] of [[0, 0], [121.2, -21.6], [303, -1], [250, 60], [10, -89]] as const) {
    const back = toGalactic(fromGalactic({ longitude, latitude }));
    assert.ok(Math.abs(back.latitude - latitude) < 1e-9 && Math.abs(((back.longitude - longitude + 540) % 360) - 180) < 1e-6 || Math.abs(latitude) > 88, `${longitude} ${latitude}`);
  }
  assert.throws(() => toGalactic({ rightAscension: Number.NaN, declination: 0 }), TypeError);
  assert.throws(() => fromGalactic({ longitude: 0, latitude: "1" as unknown as number }), TypeError);
});

test("the band follows the galactic equator: brightest along latitude 0, fading to nothing at 30 degrees", () => {
  const longitudes = range(0, 359, 3);
  const level = (latitude: number): number => mean(longitudes.map((l) => at(l, latitude)));
  assert.ok(level(0) > level(6) * 1.25, `${level(0)} ${level(6)}`);
  assert.ok(level(6) > level(15) * 1.5);
  assert.ok(level(15) > level(25) + 0.01);
  assert.equal(at(100, 45), 0);
  assert.equal(at(100, -80), 0);
  // in every 30 degrees of longitude the brightest latitude is within 8 degrees of the plane, north or south
  for (let l = 0; l < 360; l += 30) {
    const profile = range(-30, 30, 0.5).map((b) => ({ b, v: mean(range(l, l + 29, 1).map((x) => at(x, b))) }));
    const best = profile.reduce((a, c) => (c.v > a.v ? c : a));
    assert.ok(Math.abs(best.b) <= 8, `longitude ${l}: brightest at ${best.b}`);
  }
  // the equator of the galaxy, drawn in the equatorial frame, runs through the same bright places as latitude 0 does
  const along = mean(longitudes.map((l) => milkyWayBrightness(fromGalactic({ longitude: l, latitude: 0 }))));
  const across = mean(longitudes.map((l) => milkyWayBrightness(fromGalactic({ longitude: l, latitude: 20 }))));
  assert.ok(along > 2 * across);
});

test("the core toward Sagittarius is the brightest part, and the anticentre is dimmer", () => {
  const core = Math.max(...range(-6, 6, 0.5).flatMap((l) => range(-6, 6, 0.5).map((b) => at(l, b))));
  const everywhereElse = Math.max(...range(20, 340, 1).flatMap((l) => range(-10, 10, 1).map((b) => at(l, b))));
  assert.ok(core > everywhereElse + 0.1, `${core} ${everywhereElse}`);
  assert.ok(core > 0.7);
  assert.ok(mean(disc(0, 0, 8)) > 1.8 * mean(disc(180, 0, 8)), `${mean(disc(0, 0, 8))} ${mean(disc(180, 0, 8))}`);
});

test("the dust lanes are dimmer than their surroundings: the Coalsack, the Great Rift and the Cygnus Rift", () => {
  // the Coalsack, a dark cloud in Crux at about l 303: its place in the plane against the plane either side of it, at the same latitudes
  const box = (l0: number, l1: number, b0: number, b1: number): number => mean(range(l0, l1, 0.5).flatMap((l) => range(b0, b1, 0.5).map((b) => at(l, b))));
  const coalsack = box(301, 305, -4, 0);
  const beside = (box(287, 297, -4, 0) + box(311, 321, -4, 0)) / 2;
  assert.ok(coalsack < 0.8 * beside, `Coalsack ${coalsack} against ${beside}`);
  // the Great Rift in Aquila and Serpens, a lane on the north side of the plane at about b +2: darker than the plane beside it
  const rift = mean(range(18, 42, 1).map((l) => at(l, 2)));
  const either = mean(range(18, 42, 1).flatMap((l) => [at(l, -1), at(l, 5)]));
  assert.ok(rift < 0.85 * either, `Great Rift ${rift} against ${either}`);
  // the Cygnus Rift, the lane that splits the band in Cygnus: dim at b +3 where the plane is bright
  const cygnus = mean(range(72, 88, 1).map((l) => at(l, 3)));
  const plane = mean(range(72, 88, 1).flatMap((l) => [at(l, 0), at(l, -3)]));
  assert.ok(cygnus < 0.85 * plane, `Cygnus Rift ${cygnus} against ${plane}`);
});

test("the data fits its size budget: 16 kB of source, 12 kB of numbers", () => {
  const source = readFileSync(new URL("../src/data/milky-way.ts", import.meta.url));
  assert.ok(source.length <= 16_000, `${source.length} bytes of source`);
  const packed = /MILKY_WAY_PACKED = "([^"]+)"/.exec(source.toString())![1]!;
  assert.ok(Buffer.from(packed, "base64").length <= 12_000);
});

test("the bands are ribbons of equal-length edges, nested from faint to bright, with the lanes as gaps", () => {
  const bands = milkyWayBands();
  assert.deepEqual(bands.map((b) => b.level), [0.2, 0.42, 0.68]);
  const area = (band: ReturnType<typeof milkyWayBands>[number]): number =>
    band.strips.reduce((sum, s) => sum + s.upper.reduce((t, p, i) => t + Math.abs(toGalactic(p).latitude - toGalactic(s.lower[i]!).latitude), 0), 0);
  assert.ok(area(bands[0]!) > area(bands[1]!) && area(bands[1]!) > area(bands[2]!) && area(bands[2]!) > 0);
  for (const band of bands) {
    assert.ok(band.strips.length > 0);
    for (const strip of band.strips) {
      assert.equal(strip.upper.length, strip.lower.length);
      assert.ok(strip.upper.length >= 1);
      strip.upper.forEach((u, i) => {
        const lower = strip.lower[i]!;
        const north = toGalactic(u);
        const south = toGalactic(lower);
        assert.ok(north.latitude >= south.latitude - 1e-9, "the upper edge is north of the lower");
        // each point is on the level's edge, or at the pinched end of a strip
        if (north.latitude > south.latitude + 1e-6) {
          for (const edge of [north, south]) assert.ok(Math.abs(at(edge.longitude, edge.latitude) - band.level) < 0.04 || Math.abs(edge.latitude) >= 29.5, `${band.level} at ${JSON.stringify(edge)} is ${at(edge.longitude, edge.latitude)}`);
        }
      });
    }
  }
  // the band is brighter than its level in the middle of every strip's span
  const strip = bands[1]!.strips.reduce((a, c) => (c.upper.length > a.upper.length ? c : a));
  const middle = Math.floor(strip.upper.length / 2);
  const [a, b] = [toGalactic(strip.upper[middle]!), toGalactic(strip.lower[middle]!)];
  assert.ok(at(a.longitude, (a.latitude + b.latitude) / 2) > 0.42);
  // a coarser step gives fewer points; the level and the step are checked
  const points = (step: number): number => milkyWayBands([0.3], { step }).reduce((n, band) => n + band.strips.reduce((m, s) => m + s.upper.length, 0), 0);
  assert.ok(points(1) > 1.5 * points(2));
  assert.throws(() => milkyWayBands([0]), RangeError);
  assert.throws(() => milkyWayBands([1]), RangeError);
  assert.throws(() => milkyWayBands(["0.3" as unknown as number]), TypeError);
  assert.throws(() => milkyWayBands([0.3], { step: 0.7 }), RangeError);
  assert.throws(() => milkyWayBands([0.3], { step: 0 }), RangeError);
});

test("detail sharpens the lanes without moving the band: the Cygnus Rift darker, Carina brighter, the pole still dark", () => {
  const sharp = (longitude: number, latitude: number, detail: number): number => milkyWayBrightness(fromGalactic({ longitude, latitude }), { detail });
  const sky = (rightAscension: number, declination: number, detail: number): number => milkyWayBrightness({ rightAscension, declination }, { detail });
  // the Cygnus Rift (right ascension 305, declination +40) is darker read sharper; the Carina star cloud (161, -59) is brighter
  assert.ok(sky(305, 40, 1) < sky(305, 40, 0) - 0.01, `${sky(305, 40, 1)} ${sky(305, 40, 0)}`);
  assert.ok(sky(161, -59, 1) > sky(161, -59, 0) + 0.005, `${sky(161, -59, 1)} ${sky(161, -59, 0)}`);
  assert.ok(sky(305, 40, 2) < sky(305, 40, 1));
  // it moves light about, it does not add any: over the whole band the mean changes by under 3 per cent
  const whole = (detail: number): number => mean(range(0, 358, 2).flatMap((l) => range(-29, 29, 1).map((b) => sharp(l, b, detail))));
  assert.ok(Math.abs(whole(1) / whole(0) - 1) < 0.03, `${whole(1)} ${whole(0)}`);
  assert.equal(sharp(0, 45, 1), 0);
  assert.equal(milkyWayBrightness({ rightAscension: 192.9, declination: 27.1 }, { detail: 2 }), 0);
  // every reading stays from 0 to 1
  for (const l of range(0, 359, 7)) for (const b of range(-29.5, 29.5, 1.5)) {
    const v = sharp(l, b, 2);
    assert.ok(v >= 0 && v <= 1, `${l} ${b} ${v}`);
  }
  // detail 0 is the plain reading, and the default
  assert.equal(milkyWayBrightness({ rightAscension: 280, declination: -8 }, { detail: 0 }), milkyWayBrightness({ rightAscension: 280, declination: -8 }));
  assert.throws(() => milkyWayBrightness({ rightAscension: 0, declination: 0 }, { detail: -0.1 }), RangeError);
  assert.throws(() => milkyWayBrightness({ rightAscension: 0, declination: 0 }, { detail: 2.1 }), RangeError);
  assert.throws(() => milkyWayBrightness({ rightAscension: 0, declination: 0 }, { detail: Number.NaN }), TypeError);
});

test("milkyWayTexture paints the whole sky, twice as wide as high, in the frame asked for, from the ramp", () => {
  const texture = milkyWayTexture({ width: 512 });
  assert.equal(texture.width, 512);
  assert.equal(texture.height, 256);
  assert.equal(texture.data.length, 512 * 256 * 4);
  assert.equal(milkyWayTexture().width, 2048);
  const pixel = (t: { width: number; height: number; data: Uint8ClampedArray }, x: number, y: number): number[] => Array.from(t.data.subarray((y * t.width + x) * 4, (y * t.width + x) * 4 + 4));
  // equatorial: across is right ascension from 0 at the left, down is declination from +90 at the top
  const place = (t: { width: number; height: number }, ra: number, dec: number): [number, number] => [Math.floor((ra / 360) * t.width), Math.floor(((90 - dec) / 180) * t.height)];
  const core = pixel(texture, ...place(texture, 266.4, -28.9));
  const pole = pixel(texture, ...place(texture, 192.9, 27.1));
  assert.ok(core[3]! > 120 && core[0]! > 200, `core ${core}`);
  assert.deepEqual(pole, [0, 0, 0, 0]);
  // each pixel is the ramp's colour at the sharp reading there
  const [x, y] = place(texture, 300, 30);
  const level = milkyWayBrightness({ rightAscension: ((x + 0.5) / 512) * 360, declination: 90 - ((y + 0.5) / 256) * 180 }, { detail: 1 });
  assert.ok(level > 0.05, String(level));
  const opacity = (b: number): number => {
    const k = MILKY_WAY_NIGHT_RAMP.findIndex((s) => s.level >= b);
    const [a, z] = [MILKY_WAY_NIGHT_RAMP[k - 1]!, MILKY_WAY_NIGHT_RAMP[k]!];
    return (a.alpha + ((z.alpha - a.alpha) * (b - a.level)) / (z.level - a.level)) * 255;
  };
  assert.ok(Math.abs(pixel(texture, x, y)[3]! - opacity(level)) <= 2, `${pixel(texture, x, y)} ${opacity(level)}`);
  // galactic: the band is the middle row, the core at the left edge
  const galactic = milkyWayTexture({ width: 512, frame: "galactic" });
  assert.ok(pixel(galactic, 0, 128)[3]! > 120);
  assert.deepEqual(pixel(galactic, 256, 10), [0, 0, 0, 0]);
  // detail 0 paints the plain grid; a ramp of one's own is used as it is
  const plain = milkyWayTexture({ width: 64, detail: 0 });
  const plainLevel = milkyWayBrightness({ rightAscension: ((47 + 0.5) / 64) * 360, declination: 90 - ((19 + 0.5) / 32) * 180 });
  assert.ok(Math.abs(pixel(plain, 47, 19)[3]! - opacity(plainLevel)) <= 2);
  const white = milkyWayTexture({ width: 64, ramp: [{ level: 0, red: 0, green: 0, blue: 0, alpha: 1 }, { level: 1, red: 255, green: 255, blue: 255, alpha: 1 }] });
  assert.deepEqual(pixel(white, 0, 0), [0, 0, 0, 255]);
  // the same call gives the same pixels
  assert.deepEqual(milkyWayTexture({ width: 128 }).data, milkyWayTexture({ width: 128 }).data);
  for (const width of [15, 17, 4098, 1000.5]) assert.throws(() => milkyWayTexture({ width }), RangeError, String(width));
  assert.throws(() => milkyWayTexture({ frame: "ecliptic" as "galactic" }), RangeError);
  assert.throws(() => milkyWayTexture({ detail: 3 }), RangeError);
  assert.throws(() => milkyWayTexture({ ramp: [MILKY_WAY_NIGHT_RAMP[0]!] }), RangeError);
  assert.throws(() => milkyWayTexture({ ramp: [MILKY_WAY_NIGHT_RAMP[1]!, MILKY_WAY_NIGHT_RAMP[5]!] }), RangeError);
  assert.throws(() => milkyWayTexture({ ramp: [MILKY_WAY_NIGHT_RAMP[0]!, MILKY_WAY_NIGHT_RAMP[0]!, MILKY_WAY_NIGHT_RAMP[5]!] }), RangeError);
  assert.ok(Object.isFrozen(MILKY_WAY_NIGHT_RAMP) && Object.isFrozen(MILKY_WAY_NIGHT_RAMP[0]));
});
