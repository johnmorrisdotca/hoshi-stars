// The traditional Japanese sky: the 88 constellations under their Japanese names, and the old names and figures of the stars (昴 Subaru, 北斗七星 Hokuto Shichisei, 鼓星 Tsuzumi-boshi), each with its reading.
// Its own entry point (`@johnmorrisdotca/hoshi-stars/cultures/japanese`). Pure: no DOM, no state beyond the parsed rows.
import { defineCulture, type Asterism } from "../culture.ts";
import { JAPANESE_ROWS } from "../data/culture-japanese.ts";
import { iauAsterisms } from "./iau.ts";

/**
 * The Japanese sky as a culture: the 88 constellations by their Japanese names, then the traditional figures. Pass it to `constellations`, `constellation`, `starsIn`, `figures` or `figureOf`.
 *
 * @example
 * ```ts
 * import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
 * import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";
 *
 * const subaru = figureOf("すばる", japanese);
 * console.log(subaru.asterism.name, subaru.asterism.readings.ja, subaru.stars.length);
 * ```
 */
export const japanese = defineCulture("japanese", { en: "Traditional Japanese", ja: "日本の伝統" }, (): Asterism[] => [
  ...iauAsterisms("ja"),
  ...JAPANESE_ROWS.split("\n").map((row): Asterism => {
    const [id, name, reading, romaji, aka, about, chains] = row.split("|") as [string, string, string, string, string, string, string];
    return {
      id,
      name,
      names: { en: romaji, ja: name },
      readings: { ja: reading },
      aka: aka === "" ? [] : aka.split("/"),
      about,
      kind: "asterism",
      group: undefined,
      missing: 0,
      chains: chains.split(";").map((chain) => chain.split("-").map(Number)),
    };
  }),
]);
