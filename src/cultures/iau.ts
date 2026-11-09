// The 88 IAU constellations as the figures of a sky culture: each with its Latin, English, Japanese and Chinese names and our own stick figure. Shared by the western and Japanese cultures; not an entry point.
import { CONSTELLATION_NAMES_ZH } from "../data/constellation-names-zh.ts";
import { LINE_ROWS } from "../data/lines.ts";
import { constellations } from "../constellations.ts";
import type { Asterism } from "../culture.ts";

/** The 88 constellations as figures. `primary` is the language of `name`: `la` (Orion) or `ja` (オリオン座). */
export function iauAsterisms(primary: "la" | "ja"): Asterism[] {
  const chains = new Map(LINE_ROWS.split("\n").map((row) => {
    const [abbreviation, text] = row.split("|") as [string, string];
    return [abbreviation, text.split(";").map((chain) => chain.split("-").map(Number))] as const;
  }));
  const chinese = new Map(CONSTELLATION_NAMES_ZH.split("\n").map((row) => {
    const [abbreviation, hant, hans, pinyin] = row.split("|") as [string, string, string, string];
    return [abbreviation, { hant, hans, pinyin }] as const;
  }));
  return constellations().map((c) => {
    const zh = chinese.get(c.abbreviation)!;
    return {
      id: c.abbreviation,
      name: primary === "ja" ? c.japanese : c.name,
      names: { la: c.name, en: c.english, ja: c.japanese, "zh-Hans": zh.hans, "zh-Hant": zh.hant },
      readings: { ja: c.reading, zh: zh.pinyin },
      aka: [c.genitive],
      about: "",
      kind: "constellation" as const,
      group: undefined,
      missing: 0,
      chains: chains.get(c.abbreviation)!,
    };
  });
}
