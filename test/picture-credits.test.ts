// The credit line of the pictures on the chart: every credit word for word and once, the CC BY licence named and linked, the change said for the observatories' images, a link to every credit, and
// the chart reporting which pictures it drew so the line can follow them.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, DEFAULT_VIEW } from "../demo/chart.ts";
import { pictureCredits } from "../demo/picture-credits.ts";
import { deepSkyPictures } from "../src/deep-sky-pictures.ts";

const text = (ids: string[], ja = false): string => pictureCredits(ids, ja).map((piece) => piece.text).join("");
const credit = (id: string): string => deepSkyPictures().find((p) => p.id === id)!.credit;

test("pictureCredits: nothing drawn, no line", () => {
  assert.deepEqual(pictureCredits([], false), []);
  assert.deepEqual(pictureCredits(["not a picture"], false), []);
});

test("pictureCredits: the photograph of M42 and its Hubble picture, each credit word for word with CC BY 4.0 linked, the change said, and a link to every credit", () => {
  const pieces = pictureCredits(["M42", "M42-heic0601a"], false);
  const line = text(["M42", "M42-heic0601a"]);
  assert.ok(line.startsWith("Pictures: ESO/G. Beccari (CC BY 4.0); "), line);
  assert.ok(line.includes(`${credit("M42-heic0601a")} (CC BY 4.0)`), line);
  assert.ok(line.includes("Resized, with the edges faded."), line);
  assert.deepEqual(pieces.filter((piece) => piece.text === "CC BY 4.0").map((piece) => piece.href), ["https://creativecommons.org/licenses/by/4.0/", "https://creativecommons.org/licenses/by/4.0/"]);
  assert.equal(pieces.at(-1)!.text, "All credits");
  assert.match(pieces.at(-1)!.href!, /NOTICE\.md$/);
});

test("pictureCredits: a credit shared by two pictures is given once; a survey picture's credit stands without a change note, its licence named where it is a Creative Commons one", () => {
  assert.equal(text(["M8", "M16"]).match(/ESO \(CC BY 4\.0\)/g)?.length, 1);
  const sdss = text(["M13"]);
  assert.ok(sdss.includes(`${credit("M13")} (CC BY)`), sdss);
  assert.ok(!sdss.includes("Resized"), sdss);
  const twoMass = text(["M2"]);
  assert.ok(twoMass.includes(credit("M2")) && !twoMass.includes("(CC"), twoMass);
});

test("pictureCredits: in Japanese the words around the credits are Japanese and the credits stay word for word", () => {
  const line = text(["M42"], true);
  assert.ok(line.startsWith("写真: ESO/G. Beccari (CC BY 4.0). "), line);
  assert.ok(line.endsWith("大きさを変え、縁をぼかしています。出典一覧"), line);
});

test("every picture's credit can be given, and every CC BY one names its licence", () => {
  for (const picture of deepSkyPictures()) {
    const line = text([picture.id]);
    assert.ok(line.includes(picture.credit), picture.id);
    if (/CC BY/.test(picture.source.licence)) assert.match(line, /\(CC BY( 4\.0)?\)/, picture.id);
  }
});

test("the chart reports the pictures it drew with some of them in view, and none that have not arrived", () => {
  const view = { ...DEFAULT_VIEW, width: 800, height: 520, magnitude: 5, layers: new Set(["deep", "pictures"] as const), lang: "en" as const, ra: 83.82, dec: -5.39, zoom: 150 };
  assert.deepEqual(chart(view).pictures, [], "nothing has arrived");
  const drawn = chart({ ...view, readyPictures: new Set(["M42", "M43", "M42-heic0601a"]) });
  assert.ok(drawn.pictures.includes("M42"), drawn.pictures.join(","));
  assert.ok(drawn.pictures.every((id) => drawn.svg.includes(`data-pic="${id}"`)));
  assert.deepEqual(chart({ ...view, layers: new Set(["deep"] as const), readyPictures: new Set(["M42"]) }).pictures, [], "the Pictures layer off");
});
