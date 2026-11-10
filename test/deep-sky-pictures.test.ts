// The deep-sky pictures: the table of where each lies, the corners on the sky, and that every file is here, within its size budget, and recorded in NOTICE.md with its source and licence.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";
import { deepSkyObject } from "../src/deep-sky-ngc-ic.ts";
import { deepSkyPicture, deepSkyPictures, deepSkyPicturesOf, pictureCorners, pictureUrl, type DeepSkyPicture } from "../src/deep-sky-pictures.ts";
import { deepSkyOutline, deepSkyShape } from "../src/deep-sky-shape-ngc-ic.ts";

const root = new URL("../", import.meta.url);
/** The sources of photographs in true colour: an observatory's own, placed by a fit to this package's stars (scripts/make-natural-pictures.py), not cut by a survey about the object. */
const NATURAL = new Set(["NSF NOIRLab", "ESO"]);
const natural = JSON.parse(readFileSync(new URL("scripts/natural-pictures.json", root), "utf8")) as Record<string, NaturalEntry>;
interface NaturalEntry {
  placement: "fit" | "shift" | "avm";
  matched?: number;
  rmsArcsec?: number;
  agree: { inside: number; near: number; medianPixels: number | null };
  avmShiftArcsec: number;
  wcsCorners: Array<[number, number]>;
  galaxy?: { centreOffsetArcmin: number; measuredPositionAngle: number | null; cataloguePositionAngle: number | null };
}
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
    if (picture.id !== picture.object || NATURAL.has(picture.source.name)) continue;
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

test("every picture file is here, is a WebP within 90 kB (110 kB for a photograph in true colour), and the folder holds nothing else", () => {
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
    assert.ok(statSync(path).size <= (natural[picture.id] !== undefined ? 110_000 : 90_000), `${picture.file} is ${statSync(path).size} bytes`);
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
  for (const name of sources) assert.ok(["SDSS g, r, i", "2MASS J, H, K", "WISE 3.4, 4.6, 12 micron", "ESA/Hubble", "NSF NOIRLab", "ESO"].includes(name), `${name} is a listed source`);
  for (const picture of deepSkyPictures()) {
    assert.match(picture.source.licence, /CC BY|government work|public domain/i);
    assert.doesNotMatch(picture.source.licence, /\bSA\b|ShareAlike|\bNC\b|NonCommercial|non-commercial|all rights reserved/i, `${picture.id}: only licences an MIT package can pass on`);
    assert.ok(picture.credit.length >= 3, `${picture.id} has a credit line`);
    assert.doesNotMatch(`${picture.source.name} ${picture.address}`, /\bDSS\b|stellarium|digitized/i);
  }
});

test("every finer picture lies inside its survey picture, where the object has one: its middle is on it (a wide Hubble field may reach past the survey's edge)", () => {
  let checked = 0;
  for (const finer of deepSkyPictures().filter((p) => p.id !== p.object)) {
    const survey = deepSkyPicture(finer.object);
    if (survey === undefined || survey.id !== survey.object) continue;
    checked += 1;
    const [a, b, c, d] = pictureCorners(survey).map((corner) => ({ x: (corner.rightAscension - survey.centre.rightAscension) * Math.cos((survey.centre.declination * Math.PI) / 180), y: corner.declination - survey.centre.declination }));
    const inside = (point: { rightAscension: number; declination: number }): boolean => {
      const p = { x: (point.rightAscension - survey.centre.rightAscension) * Math.cos((survey.centre.declination * Math.PI) / 180), y: point.declination - survey.centre.declination };
      const ring = [a!, b!, c!, d!];
      const signs = ring.map((q, i) => {
        const r = ring[(i + 1) % 4]!;
        return Math.sign((r.x - q.x) * (p.y - q.y) - (r.y - q.y) * (p.x - q.x));
      });
      return signs.every((s) => s === signs[0]);
    };
    assert.ok(inside(finer.centre), `${finer.id}'s middle is on ${survey.id}`);
  }
  assert.ok(checked >= 14, `${checked} finer pictures checked`);
});

test("the demo leaves out the pictures that look broken, and draws no finer picture alone but the one that is most of its object", async () => {
  const { drawnPictures, LEFT_OUT } = await import("../demo/picture-quality.ts");
  const all = deepSkyPictures();
  for (const id of Object.keys(LEFT_OUT)) assert.ok(all.some((p) => p.id === id), `${id} is a picture`);
  const drawn = drawnPictures();
  assert.equal(drawn.length, all.length - Object.keys(LEFT_OUT).length - 1, "all but the ones left out and the lone Hubble tile of NGC 2070");
  assert.ok(!drawn.some((p) => p.id === "NGC 2070-heic1105a"));
  for (const id of Object.keys(LEFT_OUT)) assert.ok(!drawn.some((p) => p.id === id));
  for (const finer of drawn.filter((p) => p.id !== p.object)) assert.ok(drawn.some((p) => p.id === finer.object), `${finer.id} has its wide picture`);
});

const NATURAL_IDS = Object.keys(natural);
const arcsecBetween = (a: { rightAscension: number; declination: number }, b: { rightAscension: number; declination: number }): number => separation(a, b) * 3600;

test("the natural-colour pictures are an observatory's own, under CC BY, each recorded with its credit, and replace the false-colour picture of the object where they are its widest", () => {
  assert.ok(NATURAL_IDS.length >= 15, `${NATURAL_IDS.length} natural pictures`);
  for (const id of NATURAL_IDS) {
    const picture = deepSkyPictures().find((p) => p.id === id);
    assert.ok(picture !== undefined, `${id} is in the index`);
    assert.ok(["NSF NOIRLab", "ESO", "ESA/Hubble"].includes(picture.source.name));
    assert.match(picture.source.licence, /CC BY 4\.0/);
    assert.ok(picture.address.startsWith("https://"), `${id}: its page`);
    if (picture.id === picture.object) assert.ok(!/WISE|2MASS/.test(picture.source.name), `${id}: no infrared picture is the widest view of it`);
  }
  // the widest picture of each of these is a photograph, where it was infrared in false colour
  for (const id of ["M31", "M33", "M42", "M45", "M8", "M16", "M17", "M20", "M27", "NGC 5139"]) assert.ok(NATURAL.has(deepSkyPicture(id)!.source.name), `${id} is a photograph`);
});

test("a natural-colour picture lies where the photograph's stars say: the index puts its corners within a pixel (and 3 arc-seconds) of the fitted placement, and the fit is a fit", () => {
  const unverified: string[] = [];
  for (const id of NATURAL_IDS) {
    const picture = deepSkyPictures().find((p) => p.id === id)!;
    const entry = natural[id]!;
    pictureCorners(picture).forEach((corner, i) => {
      const [ra, dec] = entry.wcsCorners[i]!;
      const off = arcsecBetween(corner, { rightAscension: ra, declination: dec });
      assert.ok(off < Math.max(3, picture.arcsecPerPixel), `${id}: corner ${i} is ${off.toFixed(2)} arc-seconds from the fitted placement`);
    });
    if (entry.placement === "fit") {
      // matched to this package's own stars by least squares (turn, scale and centre), to a small fraction of a pixel of the photograph
      assert.ok(entry.matched! >= 8, `${id}: ${entry.matched} stars matched`);
      assert.ok(entry.rmsArcsec! < 1.5, `${id}: the residual is ${entry.rmsArcsec} arc-seconds`);
      assert.ok(entry.avmShiftArcsec < 6, `${id}: the fit and the release's own tags agree to ${entry.avmShiftArcsec} arc-seconds`);
    } else if (entry.placement === "shift") {
      // a field of a few arc-minutes holds too few of our stars for the turn and the scale, which are the release's own: the centre is fitted to the few there are
      assert.ok(entry.matched! >= 3, `${id}: ${entry.matched} stars matched`);
      assert.ok(entry.rmsArcsec! < 1.5, `${id}: the residual is ${entry.rmsArcsec} arc-seconds`);
      assert.ok(entry.avmShiftArcsec < 6, `${id}: the shift from the release's own tags is ${entry.avmShiftArcsec} arc-seconds`);
      assert.ok(entry.agree.near >= 0.6 * entry.agree.inside, `${id}: ${entry.agree.near} of ${entry.agree.inside} of our stars are on a star of the picture`);
    } else if (entry.agree.inside >= 5) {
      // the release's own position, checked against the stars there are
      assert.ok(entry.agree.near >= 0.6 * entry.agree.inside && entry.agree.medianPixels! <= 3, `${id}: ${entry.agree.near} of ${entry.agree.inside} of our stars are on a star of the picture`);
    } else unverified.push(id);
  }
  // the pictures whose field holds almost none of our stars (to magnitude 12) are laid by the release's own position and are the ones NOTICE.md and the guide name as not checked
  assert.deepEqual(unverified.sort(), ["M101-heic0602a", "M27", "NGC 1316"]);
});

test("Andromeda's picture sits on Andromeda: its middle within a twentieth of its width of the outline's, its long axis within 3 degrees of the catalogue's angle, and the disc in the picture within 5", () => {
  const picture = deepSkyPicture("M31")!;
  const m31 = deepSkyObject("M31")!;
  const shape = deepSkyShape(m31);
  const widthArcmin = (Math.max(picture.width, picture.height) * picture.arcsecPerPixel) / 60;
  assert.ok(separation(picture.centre, m31) * 60 <= widthArcmin / 20, `the middle of the picture is ${(separation(picture.centre, m31) * 60).toFixed(1)}' from the middle of M31's outline, of ${widthArcmin.toFixed(0)}' across`);
  // the picture's long side runs along the galaxy: its direction on the sky, east of north, from the corners
  const [topLeft, topRight] = pictureCorners(picture);
  const east = (topRight.rightAscension - topLeft.rightAscension) * Math.cos((picture.centre.declination * Math.PI) / 180);
  const north = topRight.declination - topLeft.declination;
  assert.ok(picture.width > picture.height * 3, "a long picture of a long galaxy");
  const frameAngle = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 180;
  assert.ok(Math.abs(frameAngle - shape.positionAngle!) <= 3, `the long side runs at ${frameAngle.toFixed(1)} degrees, the catalogue's angle is ${shape.positionAngle}`);
  // and the galaxy's own light, measured in the saved picture by scripts/make-natural-pictures.py, lies along the catalogue's outline
  const measured = natural["M31"]!.galaxy!;
  assert.ok(Math.abs(measured.measuredPositionAngle! - shape.positionAngle!) <= 5, `the disc in the picture is at ${measured.measuredPositionAngle}, the catalogue's angle is ${shape.positionAngle}`);
  assert.ok(measured.centreOffsetArcmin <= widthArcmin / 20, `the bright middle is ${measured.centreOffsetArcmin}' from the catalogue's`);
  // it is under the Hubble strip: coarser than it, so drawn first
  const all = deepSkyPicturesOf("M31");
  assert.equal(all[0]!.id, "M31");
  assert.equal(all[all.length - 1]!.id, "M31-heic1502a");
});

test("a natural-colour picture that is the widest of its object is coarser than the finer pictures of it, so they are drawn over it", () => {
  for (const id of NATURAL_IDS) {
    const picture = deepSkyPictures().find((p) => p.id === id)!;
    if (picture.id !== picture.object) continue;
    for (const finer of deepSkyPicturesOf(picture.object).filter((p) => p.id !== picture.id)) assert.ok(finer.arcsecPerPixel < picture.arcsecPerPixel, `${finer.id} is finer than ${picture.id}`);
    assert.equal(deepSkyPicturesOf(picture.object)[0]!.id, picture.id);
  }
});
