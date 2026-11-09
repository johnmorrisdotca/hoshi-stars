// The star portrait and the comparison with the Sun: what they draw, what they say about themselves, and that the same star is always drawn the same way.
import assert from "node:assert/strict";
import { test } from "node:test";
import { starByName } from "../src/index.ts";
import { portraitLook, starComparison, starPortrait } from "../src/portrait.ts";
import { starProfile } from "../src/profile.ts";

const profileOf = (name: string) => starProfile(starByName(name)!);

/** Every opening tag has its closing tag or closes itself: a cheap well-formedness check without a parser. */
function wellFormed(svg: string): boolean {
  const stack: string[] = [];
  for (const tag of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    if (tag[3] === "/") continue;
    if (tag[1] === "/") {
      if (stack.pop() !== tag[2]) return false;
    } else stack.push(tag[2]!);
  }
  return stack.length === 0;
}

test("portraitLook: the look follows the star: supergiants, giants, Sun-likes, red dwarfs, hot stars and measured fast rotators", () => {
  assert.equal(portraitLook(profileOf("Betelgeuse")), "supergiant");
  assert.equal(portraitLook(profileOf("Arcturus")), "giant");
  assert.equal(portraitLook(starProfile({ magnitude: 4.8, colourIndex: 0.65, spectralType: "G2V", luminosityClass: "V", parallaxMas: 100, parallaxErrorMas: 1, parallaxSource: "GCTP" })), "sun-like");
  assert.equal(portraitLook(starProfile({ magnitude: 9, colourIndex: 1.6, spectralType: "M3V", luminosityClass: "V", parallaxMas: 200, parallaxErrorMas: 2, parallaxSource: "GCTP" })), "red-dwarf");
  assert.equal(portraitLook(profileOf("Sirius")), "hot");
  assert.equal(portraitLook(profileOf("Altair")), "fast-rotator");
  assert.equal(portraitLook(starProfile({ magnitude: 6, colourIndex: undefined, spectralType: "DA2", luminosityClass: undefined, parallaxMas: 0, parallaxErrorMas: undefined, parallaxSource: undefined })), undefined);
});

test("starPortrait: a disc in the star's colour that says it is drawn from numbers and that its texture is generic", () => {
  const svg = starPortrait(profileOf("Betelgeuse"), { name: "Betelgeuse" })!;
  assert.ok(wellFormed(svg));
  assert.ok(svg.startsWith("<svg ") && svg.includes('viewBox="0 0 240 288"') && svg.includes('role="img"'));
  assert.ok(svg.includes("Drawn from its numbers, not a photo."));
  assert.ok(svg.includes("A generic look, not this star's surface."));
  assert.ok(svg.includes("<title>Betelgeuse, drawn from its numbers</title>"));
  assert.ok(svg.includes(profileOf("Betelgeuse").colour!), "the disc is the colour of its temperature");
  assert.ok(svg.includes("<ellipse"), "convection cells are drawn");
  assert.ok(!/<image|<script|href=|<foreignObject/.test(svg), "nothing is fetched or run");
});

test("starPortrait: the same star is drawn the same way every time, and different stars differently", () => {
  assert.equal(starPortrait(profileOf("Arcturus")), starPortrait(profileOf("Arcturus")));
  assert.notEqual(starPortrait(profileOf("Arcturus")), starPortrait(profileOf("Aldebaran")));
});

test("starPortrait: supergiants get a few huge cells and Sun-likes many small ones; hot stars are smooth", () => {
  const cellCount = (svg: string): number => (svg.match(/<ellipse[^>]*rotate\(/g) ?? []).length;
  const supergiant = cellCount(starPortrait(profileOf("Betelgeuse"))!);
  const sunLike = cellCount(starPortrait(starProfile({ magnitude: 4.8, colourIndex: 0.65, spectralType: "G2V", luminosityClass: "V", parallaxMas: 100, parallaxErrorMas: 1, parallaxSource: "GCTP" }))!);
  assert.ok(supergiant >= 5 && supergiant <= 20, String(supergiant));
  assert.ok(sunLike > 100, String(sunLike));
  assert.equal(cellCount(starPortrait(profileOf("Sirius"))!), 0);
});

test("starPortrait: Altair and Regulus are drawn flattened, Vega round, with the measured source named in the shape data", () => {
  const axes = (name: string): [number, number] => {
    const svg = starPortrait(profileOf(name), { captions: false })!;
    const body = /<ellipse cx="[\d.]+" cy="[\d.]+" rx="([\d.]+)" ry="([\d.]+)" fill="url\(#hs-\d+-fast-rotator-axis\)"/.exec(svg)!;
    return [Number(body[1]), Number(body[2])];
  };
  const [altairX, altairY] = axes("Altair");
  assert.ok(altairY / altairX < 0.92 && altairY / altairX > 0.8, `${altairY / altairX}`);
  const [regulusX, regulusY] = axes("Regulus");
  assert.ok(regulusY / regulusX < 0.78 && regulusY / regulusX > 0.72, `${regulusY / regulusX}`);
  const [vegaX, vegaY] = axes("Vega");
  assert.equal(vegaX, vegaY, "Vega is a round disc");
  assert.ok(starPortrait(profileOf("Altair"))!.includes("Its flattened shape is measured."));
});

test("starPortrait: Japanese words, a transparent background, no captions, and a size", () => {
  const ja = starPortrait(profileOf("Betelgeuse"), { lang: "ja", name: "ベテルギウス" })!;
  assert.ok(ja.includes("写真ではありません") && ja.includes("ベテルギウス（数値から描いた絵）"));
  const bare = starPortrait(profileOf("Betelgeuse"), { background: "none", captions: false, size: 100 })!;
  assert.ok(!bare.includes("<rect") && !bare.includes("<text") && bare.includes('viewBox="0 0 100 100"'));
  assert.ok(wellFormed(ja) && wellFormed(bare));
});

test("starPortrait: the name is escaped, so a name cannot add markup", () => {
  const svg = starPortrait(profileOf("Sirius"), { name: `<script>alert("x")</script>` })!;
  assert.ok(!svg.includes("<script>") && svg.includes("&lt;script&gt;"));
});

test("starComparison: a star beside the Sun for a small one, a disc over Earth's orbit for a supergiant", () => {
  const giant = starComparison(profileOf("Aldebaran"), { name: "Aldebaran" })!;
  assert.ok(wellFormed(giant) && giant.includes("times the Sun's radius") && giant.includes(">Sun<") && !giant.includes("Earth's orbit"));
  const supergiant = starComparison(profileOf("Betelgeuse"))!;
  assert.ok(supergiant.includes("Earth's orbit") && supergiant.includes("The dot in the middle is the Sun, to scale."));
  const ja = starComparison(profileOf("Betelgeuse"), { lang: "ja" })!;
  assert.ok(ja.includes("地球の軌道") && ja.includes("太陽の半径の"));
  assert.ok(wellFormed(supergiant) && wellFormed(ja));
  const dwarf = starComparison(starProfile({ magnitude: 9, colourIndex: 1.6, spectralType: "M3V", luminosityClass: "V", parallaxMas: 200, parallaxErrorMas: 2, parallaxSource: "GCTP" }))!;
  assert.ok(dwarf.includes("of the Sun's radius"));
});

test("starComparison: there is no comparison where there is no radius", () => {
  assert.equal(starComparison(starProfile({ magnitude: 5, colourIndex: 1, spectralType: "A3II", luminosityClass: "II", parallaxMas: 0, parallaxErrorMas: undefined, parallaxSource: undefined })), undefined);
});
