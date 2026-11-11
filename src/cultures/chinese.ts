// The traditional Chinese sky: the Three Enclosures and the Twenty-Eight Mansions as asterisms (星官) of Bright Star Catalogue stars, with their names in Traditional and Simplified characters and in pinyin (the 88 IAU constellations' Chinese names are in the Western culture).
// Its own entry point (`@johnmorrisdotca/hoshi-stars/cultures/chinese`). Pure: no DOM, no state beyond the parsed rows.
import { defineCulture, type Asterism } from "../culture.ts";
import { CHINESE_ROWS } from "../data/culture-chinese.ts";

/**
 * The traditional Chinese sky as a culture: about 240 asterisms, the 28 mansions first. Each lists the stars of it the Bright Star Catalogue holds; where the asterism has more stars than that (fainter than magnitude 6.0) `missing` says
 * at least how many, and the figure draws only the stars we have. The English name and `partOf` (the enclosure or mansion) are Wikidata's, where it states them. The lines are our own joins of those stars, not the traditional drawing. Pass it to `constellations`, `constellation`, `starsIn`, `figures` or `figureOf`.
 *
 * @example
 * ```ts
 * import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
 * import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";
 *
 * const dipper = figureOf("北斗", chinese);
 * console.log(dipper.asterism.readings.zh, dipper.stars.map((s) => s.name));
 * console.log(chinese.find("華蓋")?.names.en, chinese.find("華蓋")?.partOf); // "Canopy of the Emperor", "purple-forbidden"
 * ```
 */
export const chinese = defineCulture("chinese", { en: "Traditional Chinese (Three Enclosures, Twenty-Eight Mansions)", ja: "中国の伝統 (三垣二十八宿)" }, (): Asterism[] =>
  CHINESE_ROWS.split("\n").map((row): Asterism => {
    const [id, hant, hans, pinyin, english, group, part, missing, chains] = row.split("|") as [string, string, string, string, string, string, string, string, string];
    return {
      id,
      name: hant,
      names: { "zh-Hant": hant, "zh-Hans": hans, ...(english === "" ? {} : { en: english }) },
      readings: { zh: pinyin },
      aka: [],
      about: "",
      kind: group === "" ? "asterism" : "mansion",
      group: group === "" ? undefined : group,
      ...(part === "" ? {} : { partOf: part }),
      missing: Number(missing),
      chains: chains.split(";").map((chain) => chain.split("-").map(Number)),
    };
  }),
);
