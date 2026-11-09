// The deep-sky pictures: the table of where each lies, the corners on the sky, and that every file is here, within its size budget, and recorded in NOTICE.md with its source and licence.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";
import { deepSkyObject } from "../src/deep-sky-ngc-ic.ts";
import { deepSkyPicture, deepSkyPictures, deepSkyPicturesOf, pictureCorners, pictureUrl, type DeepSkyPicture } from "../src/deep-sky-pictures.ts";
import { deepSkyOutline, deepSkyShape } from "../src/deep-sky-shape-ngc-ic.ts";

const root = new URL("../", import.meta.url);
const notice = readFileSync(new URL("NOTICE.md", root), "utf8");
const separation = (a: { rightAscension: number; declination: number }, b: { rightAscension: number; declination: number }): number => {
  const [r1, d1, r2, d2] = [a.rightAscension, a.declination, b.rightAscension, b.declination].map((x) => (x * Math.PI) / 180) as [number, number, number, number];
  return (Math.acos(Math.min(1, Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(r1 - r2))) * 180) / Math.PI;
};

test("82 of the Messier objects have a picture: the galaxies, the globular clusters, the nebulae and the Pleiades, and not the open clusters that lie in the Milky Way's star clouds, the star cloud M24, the asterisms M40 and M73, or M32", () => {
  const ids = new Set(deepSkyPictures().map((p) => p.object));
  const missing = Array.from({ length: 110 }, (_, i) => `M${i + 1}`).filter((id) => !ids.has(id));
  assert.deepEqual(missing, ["M6", "M7", "M11", "M18", "M21", "M23", "M24", "M25", "M26", "M29", "M32", "M34", "M36", "M37", "M38", "M39", "M40", "M41", "M44", "M46", "M47", "M48", "M50", "M52", "M67", "M73", "M93", "M103"]);
  assert.ok(ids.has("M45") && ids.has("M31") && ids.has("M42") && ids.has("M13") && ids.has("M104"));
  assert.ok(deepSkyPictures().length >= 125);
});

test("deepSkyPicture finds a picture by designation, ignoring case and spacing, and none for an object without one", () => {
  assert.equal(deepSkyPicture("M31")?.id, "M31");
  assert.equal(deepSkyPicture("m 31")?.id, "M31");
  assert.equal(deepSkyPicture("Messier 31")?.id, "M31");
  assert.equal(deepSkyPicture("NGC 224"), undefined, "filed under the object's id, M31");
  assert.equal(deepSkyPicture("IC 1"), undefined);
  assert.throws(() => deepSkyPicture(31 as unknown as string), TypeError);
});

test("each survey picture is at its object's place, in a field that holds the whole outline, and is in the package's file layout", () => {
  for (const picture of deepSkyPictures()) {
    const object = deepSkyObject(picture.object);
    assert.ok(object !== undefined, `${picture.object} is a deep-sky object`);
    assert.equal(picture.file, `pictures/${picture.id.replace(" ", "-")}.webp`);
    if (picture.id !== picture.object) continue;
    assert.ok(separation(object, picture.centre) * 60 < 0.5, `${picture.id}'s picture is centred within half an arc-minute of the object`);
    assert.equal(picture.rotation, 0);
    const half = (Math.min(picture.width, picture.height) * picture.arcsecPerPixel) / 120;
    const shape = deepSkyShape(object);
    const ring = deepSkyOutline(object, shape);
    if (ring !== undefined && shape.majorArcmin! <= 2 * half * 0.99) {
      const reach = Math.max(...ring.map((point) => separation(object, point))) * 60;
      assert.ok(reach <= half * Math.SQRT2, `${picture.id}: the outline reaches ${reach.toFixed(1)}' and the picture half is ${half.toFixed(1)}'`);
    }
  }
});

test("a finer picture lies on its object, is finer than the survey picture, and comes after it", () => {
  const all = deepSkyPicturesOf("M51");
  assert.ok(all.length >= 2, "M51 has its survey picture and a Hubble one");
  assert.equal(all[0], deepSkyPicture("M51"));
  const finer = all[all.length - 1]!;
  assert.ok(finer.arcsecPerPixel < all[0]!.arcsecPerPixel / 1.5);
  assert.equal(finer.source.name, "ESA/Hubble");
  assert.match(finer.credit, /NASA, ESA/);
  const object = deepSkyObject("M51")!;
  assert.ok(separation(object, finer.centre) * 60 < 5, "the Hubble field is centred on the galaxy");
  assert.ok(Math.abs(finer.rotation - 91.9) < 0.1, "north is 91.9 degrees right of vertical in that picture, so its top points 91.9 degrees east of north");
  const [topLeft, topRight] = pictureCorners(finer);
  const middleOfTop = { rightAscension: (topLeft.rightAscension + topRight.rightAscension) / 2, declination: (topLeft.declination + topRight.declination) / 2 };
  assert.ok(middleOfTop.rightAscension > finer.centre.rightAscension, "the top of a picture turned 91.9 degrees points east");
  assert.deepEqual(deepSkyPicturesOf("M40"), []);
  assert.throws(() => deepSkyPicturesOf(1 as unknown as string), TypeError);
});

test("pictureCorners puts the corners at the picture's size, north at the top and east on the left", () => {
  const picture = deepSkyPicture("M51")!;
  const [topLeft, topRight, bottomRight, bottomLeft] = pictureCorners(picture);
  const wide = (picture.width * picture.arcsecPerPixel) / 3600;
  assert.ok(Math.abs(separation(topLeft, topRight) - wide) < wide * 0.002, "the top edge is the picture's width");
  assert.ok(topLeft.declination > picture.centre.declination && bottomLeft.declination < picture.centre.declination);
  assert.ok(topLeft.rightAscension > picture.centre.rightAscension && topRight.rightAscension < picture.centre.rightAscension, "east (larger right ascension) is on the left");
  assert.ok(Math.abs(topLeft.declination - topRight.declination) < 0.02 && Math.abs(bottomLeft.declination - bottomRight.declination) < 0.02, "the top and bottom run east-west");
});

test("a turned picture's corners turn with it: rotation 90 puts east at the top", () => {
  const base = deepSkyPicture("M51")!;
  const turned: DeepSkyPicture = { ...base, rotation: 90 };
  const [a, b] = pictureCorners(turned);
  const north = pictureCorners(base);
  assert.ok(Math.abs(separation(a, b) - separation(north[0], north[1])) < 1e-6, "the same size");
  const mid = { rightAscension: (a.rightAscension + b.rightAscension) / 2, declination: (a.declination + b.declination) / 2 };
  assert.ok(mid.rightAscension > turned.centre.rightAscension, "the middle of the top edge is east of the centre");
});

test("pictureUrl joins a base and the file with one slash", () => {
  const picture = deepSkyPicture("M31")!;
  assert.equal(pictureUrl(picture, "https://x.test/a"), "https://x.test/a/pictures/M31.webp");
  assert.equal(pictureUrl(picture, "./"), "./pictures/M31.webp");
});

test("every picture file is here, is a WebP within 90 kB, and the folder holds nothing else", () => {
  const files = readdirSync(new URL("pictures/", root)).sort();
  assert.deepEqual(files, deepSkyPictures().map((p) => p.file.replace("pictures/", "")).sort());
  assert.equal(new Set(deepSkyPictures().map((p) => p.id)).size, deepSkyPictures().length, "ids are unique");
  let total = 0;
  for (const picture of deepSkyPictures()) {
    const path = new URL(picture.file, root);
    assert.ok(existsSync(path), picture.file);
    const bytes = readFileSync(path);
    assert.equal(bytes.subarray(0, 4).toString("latin1"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("latin1"), "WEBP");
    assert.ok(statSync(path).size <= 90_000, `${picture.file} is ${statSync(path).size} bytes`);
    total += statSync(path).size;
  }
  assert.ok(total < 12_000_000, `all the pictures are ${total} bytes`);
});

test("NOTICE.md records every picture file with its survey, address, credit, licence and the day it was read", () => {
  for (const picture of deepSkyPictures()) {
    const row = notice.split("\n").find((line) => line.startsWith(`| ${picture.file} |`));
    assert.ok(row !== undefined, `${picture.file} is in NOTICE.md`);
    assert.ok(row.includes(picture.source.name) && row.includes(picture.credit) && row.includes(picture.source.licence), `${picture.file}: survey, credit and licence`);
    assert.ok(row.includes(picture.address), `${picture.file}: the address it was cut from`);
    assert.match(row, /\| 20\d\d-\d\d-\d\d \|$/);
  }
});

test("the sources are all ones whose terms allow it, and none is one the package refuses", () => {
  const sources = new Set(deepSkyPictures().map((p) => p.source.name));
  for (const name of sources) assert.ok(["SDSS g, r, i", "2MASS J, H, K", "WISE 3.4, 4.6, 12 micron", "ESA/Hubble"].includes(name), `${name} is a listed source`);
  for (const picture of deepSkyPictures()) {
    assert.match(picture.source.licence, /CC BY|government work|public domain/i);
    assert.ok(picture.credit.length > 10, `${picture.id} has a credit line`);
    assert.doesNotMatch(`${picture.source.name} ${picture.address}`, /\bDSS\b|stellarium|digitized/i);
  }
});
