// The Western sky: the 88 IAU constellations with our own figures and their names in Latin, English, Japanese and Chinese (Simplified and Traditional, with pinyin), and the well-known asterisms (the Big Dipper, the Summer Triangle).
// Its own entry point (`@johnmorrisdotca/hoshi-stars/cultures/western`); the constellations and lines tiers stay as small as they were. Pure: no DOM, no state beyond the parsed rows.
import { defineCulture, type Asterism } from "../culture.ts";
import { WESTERN_ASTERISM_ROWS } from "../data/culture-western.ts";
import { iauAsterisms } from "./iau.ts";

/**
 * The Western sky as a culture: the 88 constellations, then the asterisms. Pass it to `constellations`, `constellation`, `starsIn`, `figures` or `figureOf` for names in every language and the asterisms as well.
 *
 * @example
 * ```ts
 * import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
 * import { western } from "@johnmorrisdotca/hoshi-stars/cultures/western";
 *
 * console.log(figureOf("天鹅座", western).asterism.name, figureOf("夏の大三角", western).stars.map((s) => s.name));
 * ```
 */
export const western = defineCulture("western", { en: "Western (IAU 88 and asterisms)", ja: "西洋 (88星座と星の並び)" }, (): Asterism[] => [
  ...iauAsterisms("la"),
  ...WESTERN_ASTERISM_ROWS.split("\n").map((row): Asterism => {
    const [id, en, ja, reading, about, chains] = row.split("|") as [string, string, string, string, string, string];
    return {
      id,
      name: en,
      names: { en, ...(ja === "" ? {} : { ja }) },
      readings: ja === "" ? {} : { ja: reading },
      aka: [],
      about,
      kind: "asterism",
      group: undefined,
      missing: 0,
      chains: chains.split(";").map((chain) => chain.split("-").map(Number)),
    };
  }),
]);
