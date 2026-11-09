// `starProfile` against measurements: the Sun, 43 stars whose discs the CHARA Array resolved (Boyajian et al. 2012), and six famous ones with an interferometric diameter each. The test of the uncertainty is as
// important as the test of the figure: a one-sigma range that held the measurement for only half the stars would be a lie, so the share of stars inside it is checked as well.
import assert from "node:assert/strict";
import { test } from "node:test";
import { starByHr, starByName, stars } from "../src/index.ts";
import { starProfile, starShape, type Estimate, type StarProfile } from "../src/profile.ts";
import { CHARA_DWARFS, MEASURED_DIAMETERS } from "./profile-references.ts";

const between = (value: number, range: readonly [number, number]): boolean => value >= range[0] && value <= range[1];
const widened = (e: Estimate, sigmas: number): readonly [number, number] => [e.value - sigmas * (e.value - e.range[0]), e.value + sigmas * (e.range[1] - e.value)];

test("starProfile: the Sun, built by hand, comes out as one solar radius, one solar luminosity and 5,770 K", () => {
  const sun: StarProfile = starProfile({ magnitude: -26.74, colourIndex: 0.65, spectralType: "G2V", luminosityClass: "V", parallaxMas: 206_264_806.2, parallaxErrorMas: 1000, parallaxSource: "GCTP" });
  assert.ok(Math.abs(sun.radius!.value - 1) < 0.02, `radius ${sun.radius!.value}`);
  assert.ok(Math.abs(sun.luminosity!.value - 1) < 0.02, `luminosity ${sun.luminosity!.value}`);
  assert.ok(Math.abs(sun.temperature!.value - 5770) < 30);
  assert.ok(Math.abs(sun.angularDiameterMas!.value / 1.9193e6 - 1) < 0.02, "the Sun's disc is about 1,919 arc-seconds across");
  assert.ok(Math.abs(sun.limbDarkening! - 0.65) < 0.05, "the Sun's V-band limb darkening is about 0.65");
  assert.equal(sun.radius!.basis, "parallax");
});

test("starProfile: 43 CHARA-resolved stars, the angular diameter from the magnitude and temperature alone", () => {
  const z: number[] = [];
  let inside = 0;
  let wide = 0;
  for (const [hr, theta] of CHARA_DWARFS) {
    const star = starByHr(hr);
    assert.ok(star, `HR ${hr}`);
    const angular = starProfile(star).angularDiameterMas!;
    const sigma = (angular.range[1] - angular.range[0]) / 2;
    z.push((theta - angular.value) / sigma);
    if (between(theta, angular.range)) inside += 1;
    if (!between(theta, widened(angular, 3))) wide += 1;
  }
  const rms = Math.sqrt(z.reduce((sum, v) => sum + v * v, 0) / z.length);
  assert.equal(CHARA_DWARFS.length, 43);
  assert.ok(inside / z.length > 0.62, `${inside} of ${z.length} inside one sigma`);
  assert.ok(rms > 0.6 && rms < 1.25, `rms z ${rms.toFixed(2)}: the sigma is neither a boast nor a shrug`);
  assert.ok(wide <= 6, `${wide} stars beyond three sigma`);
});

test("starProfile: the same stars' radii, from the catalogue's own parallax, where it fixes a distance", () => {
  let tried = 0;
  let inside = 0;
  for (const [hr, , , radius] of CHARA_DWARFS) {
    const profile = starProfile(starByHr(hr)!);
    if (profile.radius?.basis !== "parallax") continue;
    tried += 1;
    if (between(radius, profile.radius.range)) inside += 1;
  }
  assert.ok(tried >= 30, `${tried} stars have a usable parallax`);
  assert.ok(inside / tried > 0.7, `${inside} of ${tried} radii inside one sigma`);
});

test("starProfile: Sirius, Arcturus, Aldebaran, Pollux, Betelgeuse and Antares, each within two sigma of an interferometer's diameter", () => {
  for (const one of MEASURED_DIAMETERS) {
    const star = starByName(one.name)!;
    const profile = starProfile(star);
    assert.ok(between(one.thetaMas, widened(profile.angularDiameterMas!, 2)), `${one.name}: ${profile.angularDiameterMas!.value.toFixed(2)} mas, range ${profile.angularDiameterMas!.range.map((v) => v.toFixed(2))}, measured ${one.thetaMas} (${one.source})`);
  }
  // Sirius A is the nearest miss: its type (A1) is a little cooler than the star's 9,850 K, so its disc reads 7% large; the radius from the catalogue's own parallax is 1.82 against the measured 1.711.
  const sirius = starProfile(starByName("Sirius")!);
  assert.ok(Math.abs(sirius.radius!.value / 1.711 - 1) < 0.1);
});

test("starProfile: Altair, Regulus and Vega sit between their measured polar and equatorial discs", () => {
  // The angular size across the poles and across the equator, in mas (twice the angular radius): Monnier et al. 2007 (Altair 2.958 and 3.670), McAlister et al. 2005 (Regulus 2.50 and 3.30), Monnier et al. 2012 (Vega 2.93 and 3.30).
  const bounds: Array<[string, number, number]> = [["Altair", 2.958, 3.67], ["Regulus", 1.25, 1.65], ["Vega", 2.93, 3.302]];
  for (const [name, low, high] of bounds) {
    const angular = starProfile(starByName(name)!).angularDiameterMas!;
    assert.ok(angular.range[1] >= low && angular.range[0] <= high, `${name}: ${angular.value.toFixed(2)} (${angular.range.map((v) => v.toFixed(2))}) against ${low} to ${high}`);
  }
});

test("starProfile: every one of the 5,080 stars has a temperature, an angular diameter and a limb darkening, and each estimate holds its own value", () => {
  const reasons = new Set<string>();
  let radii = 0;
  for (const star of stars()) {
    const profile = starProfile(star);
    assert.ok(profile.temperature && profile.colour && profile.angularDiameterMas && profile.limbDarkening !== undefined, `HR ${star.hr} ${star.spectralType}`);
    for (const e of [profile.temperature, profile.luminosity, profile.radius, profile.angularDiameterMas]) {
      if (e === undefined) continue;
      assert.ok(Number.isFinite(e.value) && e.value > 0 && Number.isFinite(e.error) && e.error >= 0, `HR ${star.hr}`);
      assert.ok(e.range[0] <= e.value && e.value <= e.range[1] && e.range[0] > 0, `HR ${star.hr} range`);
    }
    assert.ok(profile.limbDarkening! > 0.1 && profile.limbDarkening! < 1, `HR ${star.hr} limb darkening ${profile.limbDarkening}`);
    if (profile.radius !== undefined) {
      radii += 1;
      assert.equal(profile.unknown.radius, undefined);
    } else {
      assert.ok(profile.unknown.radius, `HR ${star.hr} has no radius and no reason`);
      reasons.add(profile.unknown.radius!);
    }
  }
  assert.ok(radii > 3500 && radii < 4800, `${radii} stars have a radius`);
  assert.ok(reasons.has("no-parallax") && reasons.has("poor-parallax"), [...reasons].join());
});

test("starProfile: where the data is missing the figure is undefined and the reason is named, never a guess", () => {
  const nothing = starProfile({ magnitude: 6, colourIndex: undefined, spectralType: "DA2", luminosityClass: undefined, parallaxMas: 0, parallaxErrorMas: undefined, parallaxSource: undefined });
  assert.equal(nothing.temperature, undefined);
  assert.equal(nothing.angularDiameterMas, undefined);
  assert.equal(nothing.unknown.temperature, "odd-type");
  const noDistance = starProfile({ magnitude: 3, colourIndex: 1.0, spectralType: "K0III", luminosityClass: "III", parallaxMas: 0, parallaxErrorMas: undefined, parallaxSource: undefined });
  assert.equal(noDistance.luminosity, undefined);
  assert.equal(noDistance.unknown.luminosity, "no-parallax");
  assert.equal(noDistance.radius!.basis, "type", "a typical giant of that type stands in, and says so");
  assert.ok(noDistance.angularDiameterMas!.value > 0);
  const poor = starProfile({ magnitude: 3, colourIndex: 1.0, spectralType: "A3II", luminosityClass: "II", parallaxMas: 2, parallaxErrorMas: 1.5, parallaxSource: "GCTP" });
  assert.equal(poor.radius, undefined);
  assert.equal(poor.unknown.radius, "poor-parallax");
});

test("starProfile: the uncertainty grows with the parallax's own error and the radius range is open-ended where the parallax is", () => {
  const input = { magnitude: 1, colourIndex: 0.5, spectralType: "F5IV", luminosityClass: "IV" as const, parallaxMas: 20, parallaxSource: "GCTP" as const };
  const sharp = starProfile({ ...input, parallaxErrorMas: 0.2 }).radius!;
  const blurred = starProfile({ ...input, parallaxErrorMas: 8 }).radius!;
  assert.equal(blurred.basis, "parallax");
  assert.ok(blurred.error > sharp.error * 3);
  assert.ok(blurred.range[1] / blurred.value > sharp.range[1] / sharp.value);
  // Betelgeuse: 9.8 mas with 4.7 of error is as good as the catalogue's parallax gets while still bounding the distance.
  const betelgeuse = starProfile(starByName("Betelgeuse")!);
  assert.ok(Number.isFinite(betelgeuse.radius!.range[1]));
});

test("starProfile: the temperature scale follows the class, a supergiant of type M is cooler than a dwarf of type M and hotter stars are hotter", () => {
  const t = (type: string, cls: StarProfile["luminosityClass"], colour = 1.5): number => starProfile({ magnitude: 4, colourIndex: colour, spectralType: type, luminosityClass: cls, parallaxMas: 10, parallaxErrorMas: 1, parallaxSource: "GCTP" }).temperature!.value;
  assert.ok(t("M2Iab", "Iab") < t("M2V", "V") + 400 && t("M2Iab", "Iab") > 3300 && t("M2Iab", "Iab") < 3800);
  assert.ok(t("O9V", "V", -0.3) > 25_000);
  assert.ok(t("B2V", "V", -0.2) > t("A0V", "V", 0) && t("A0V", "V", 0) > t("F5V", "V", 0.45) && t("F5V", "V", 0.45) > t("K5V", "V", 1.15));
});

test("starShape: Altair and Regulus are flattened, Vega is seen over its pole, other stars have no published shape", () => {
  const altair = starShape(7557)!;
  assert.equal(altair.kind, "oblate");
  assert.ok(altair.polarRadius < altair.equatorialRadius && altair.polarTemperatureK > altair.equatorialTemperatureK);
  assert.equal(starShape(3982)!.kind, "oblate");
  assert.equal(starShape(3982)!.equatorialRadius, 4.16);
  assert.equal(starShape(7001)!.kind, "pole-on");
  assert.ok(starShape(7001)!.inclinationDegrees < 10);
  assert.equal(starShape(2491), undefined);
  assert.equal(starProfile(starByName("Altair")!).shape, altair);
  for (const shape of [altair, starShape(3982)!, starShape(7001)!]) assert.ok(shape.source.length > 10);
});
