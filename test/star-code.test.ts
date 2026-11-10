// The code the demo hands out for one star's picture: the module's own lines are run here against the package and their picture is the one `/portrait` draws.
import assert from "node:assert/strict";
import { test } from "node:test";
import { starComparison, starPortrait } from "../src/portrait.ts";
import { starProfile } from "../src/profile.ts";
import { starByHr } from "../src/stars.ts";
import { starChoiceOf, starCode, starFrameCode, starHeightFor, starLines, starQuery, type StarChoice } from "../demo/star-code.ts";

const betelgeuse: StarChoice = { hr: 2061, name: "Betelgeuse", view: "portrait", lang: "en" };

function run(choice: StarChoice, width: number): string {
  const { body } = starLines(choice, width);
  return new Function("starByHr", "starProfile", "starPortrait", "starComparison", `${body}\nreturn starPicture();`)(starByHr, starProfile, starPortrait, starComparison) as string;
}

test("starLines: the module's lines draw the same portrait and the same comparison as the package", () => {
  const profile = starProfile(starByHr(2061)!);
  assert.equal(run(betelgeuse, 320), starPortrait(profile, { name: "Betelgeuse", size: 320 }));
  assert.equal(run({ ...betelgeuse, view: "compare", lang: "ja" }, 400), starComparison(profile, { name: "Betelgeuse", size: 400, lang: "ja" }));
  // the 3D star's code draws its portrait, the still the live view stands on
  assert.equal(run({ ...betelgeuse, view: "3d" }, 320), starPortrait(profile, { name: "Betelgeuse", size: 320 }));
});

test("starCode: every way a page is made imports the package, calls starPicture and puts the picture on the page", () => {
  for (const kind of ["html", "module", "react", "vue", "angular", "svelte"]) {
    const code = starCode(kind, betelgeuse, 320)!;
    assert.ok(code.includes("starPicture()") && code.includes("hoshi-stars") && code.includes("starProfile"), kind);
  }
  assert.ok(starCode("html", betelgeuse, 320)!.includes("/portrait/+esm"));
  assert.ok(starCode("react", betelgeuse, 320)!.includes("dangerouslySetInnerHTML"));
  assert.equal(starCode("nothing", betelgeuse, 320), undefined);
});

test("starQuery and starChoiceOf: a choice is written into an address and read back, with defaults left out and bad parts mended", () => {
  assert.equal(starQuery(betelgeuse), "star=2061");
  assert.equal(starQuery({ ...betelgeuse, view: "compare", lang: "ja" }), "star=2061&view=compare&lang=ja");
  const name = (hr: number): string | undefined => starByHr(hr)?.name;
  assert.deepEqual(starChoiceOf(new URLSearchParams("star=2061&view=compare&lang=ja"), name), { hr: 2061, name: "Betelgeuse", view: "compare", lang: "ja" });
  assert.deepEqual(starChoiceOf(new URLSearchParams("star=2061&view=nonsense&lang=fr"), name), betelgeuse);
  assert.equal(starQuery({ ...betelgeuse, view: "3d" }), "star=2061&view=3d");
  assert.equal(starChoiceOf(new URLSearchParams("star=2061&view=3d"), name)?.view, "3d");
  assert.equal(starChoiceOf(new URLSearchParams("star=abc"), name), undefined);
  assert.equal(starChoiceOf(new URLSearchParams("star=99999999"), name), undefined);
  assert.equal(starChoiceOf(new URLSearchParams(""), name), undefined);
});

test("starFrameCode: the iframe names the embed page and its address, relative in the demo's own preview", () => {
  const code = starFrameCode({ ...betelgeuse, view: "compare" }, "Betelgeuse next to the Sun", 320, false);
  assert.ok(code.includes("https://johnmorrisdotca.github.io/hoshi-stars/star.html?star=2061&amp;view=compare") || code.includes("https://johnmorrisdotca.github.io/hoshi-stars/star.html?star=2061&view=compare"), code);
  assert.ok(starFrameCode(betelgeuse, "x", 320, true).includes('src="star.html?star=2061"'));
  assert.equal(starHeightFor("portrait", 320), 384);
  assert.equal(starHeightFor("compare", 400), 344);
  assert.equal(starHeightFor("3d", 320), 464);
  assert.ok(starFrameCode({ ...betelgeuse, view: "3d" }, "x", 320, true).includes("star.html?star=2061&amp;view=3d") || starFrameCode({ ...betelgeuse, view: "3d" }, "x", 320, true).includes("star.html?star=2061&view=3d"));
});
