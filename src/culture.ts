// What a sky culture is: a set of named figures made of Bright Star Catalogue stars, each with its names in the languages it is known by.
// The culture tier (types and the lookup only, no star data): each culture is its own entry point (`@johnmorrisdotca/hoshi-stars/cultures/chinese`, `.../japanese`, `.../western`), so a page pays only for the one it imports.
// Pure: no DOM, no state beyond the parsed rows.

/**
 * The languages a name can be in: Latin, English, Japanese, and Chinese in Simplified (`zh-Hans`) and Traditional (`zh-Hant`) characters.
 *
 * @example
 * ```ts
 * import type { NameLanguage } from "@johnmorrisdotca/hoshi-stars/culture";
 *
 * const languages: NameLanguage[] = ["la", "en", "ja", "zh-Hans", "zh-Hant"];
 * console.log(languages.length);
 * ```
 */
export type NameLanguage = "la" | "en" | "ja" | "zh-Hans" | "zh-Hant";

/**
 * What kind of thing a figure is: one of the 88 constellations, a smaller asterism, or one of the Twenty-Eight Mansions of the Chinese sky.
 *
 * @example
 * ```ts
 * import type { AsterismKind } from "@johnmorrisdotca/hoshi-stars/culture";
 *
 * const kinds: AsterismKind[] = ["constellation", "asterism", "mansion"];
 * console.log(kinds);
 * ```
 */
export type AsterismKind = "constellation" | "asterism" | "mansion";

/**
 * One figure of a sky culture: its names, its reading and the stars it joins, as Bright Star Catalogue (HR) numbers. `figures(culture)` and `figureOf(text, culture)` turn it into stars and lines.
 *
 * @example
 * ```ts
 * import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";
 *
 * const dipper = chinese.find("北斗")!;
 * console.log(dipper.name, dipper.readings.zh, dipper.chains.length);
 * ```
 */
export interface Asterism {
  /** A short ASCII key, stable between releases: the IAU abbreviation for a constellation (`Ori`), else a lower-case word (`hokuto-shichisei`, `bei3-dou3`). */
  readonly id: string;
  /** The name in the culture's own writing: the Latin name (`Orion`) for a Western constellation, the English name (`Big Dipper`) for a Western asterism, `昴` for a Japanese one, the Traditional characters (`北斗`) for a Chinese one. */
  readonly name: string;
  /** The name in each language the figure has one in. */
  readonly names: Readonly<Partial<Record<NameLanguage, string>>>;
  /** How the name is read: `ja` in hiragana (`すばる`), `zh` in pinyin with tone marks (`běi dǒu`). */
  readonly readings: Readonly<{ ja?: string; zh?: string }>;
  /** Other names it is called by, accepted by `find` (`六連星` for 昴). Empty for most. */
  readonly aka: readonly string[];
  /** A few English words on what it is (`the Pleiades`, `Orion's belt`), or an empty string. */
  readonly about: string;
  /** Whether it is a constellation, an asterism or a Chinese mansion. */
  readonly kind: AsterismKind;
  /** For a Chinese mansion, the quarter of the sky it belongs to (`azure-dragon`, `black-tortoise`, `white-tiger`, `vermilion-bird`); `undefined` otherwise. */
  readonly group: string | undefined;
  /** For a Chinese asterism, the enclosure (`purple-forbidden`, `supreme-palace`, `heavenly-market`) or the id of the mansion it is part of, where Wikidata states it; absent otherwise. */
  readonly partOf?: string;
  /**
   * At least how many of its stars are not held: fainter than visual magnitude 6.0, which the catalogue does not hold, or (for a figure read from a source that names stars by number) not
   * named with a catalogue number in that source, so we cannot tell which. The figure draws only the stars we have. 0 where all are held or none is known to be missing.
   */
  readonly missing: number;
  /**
   * Each held star's number in the figure, by Bright Star Catalogue number, where the culture numbers its stars: the Chinese sky's names do (角宿一 is star 1 of 角宿, and a mansion's star 1 is its
   * determinative star, 距星). `{ 5056: 1, 5107: 2 }` for 角宿; absent where the culture does not number them, and a star the source gives no number has none.
   */
  readonly numbers?: Readonly<Record<number, number>>;
  /** The stars as HR numbers: chains, each a run of stars joined one to the next; a chain of one is a single star. */
  readonly chains: ReadonlyArray<readonly number[]>;
}

/**
 * A sky culture: a named set of figures. Import one from its own entry point and pass it to `constellations`, `constellation`, `starsIn`, `figures` and `figureOf`.
 *
 * @example
 * ```ts
 * import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";
 *
 * console.log(japanese.id, japanese.names.ja, japanese.asterisms().length);
 * ```
 */
export interface Culture {
  /** A short key for an address or a setting: `western`, `japanese`, `chinese`. */
  readonly id: string;
  /** The culture's name in English and in Japanese. */
  readonly names: Readonly<{ en: string; ja: string }>;
  /** The culture's figures, in a fixed order. Parsed once. */
  asterisms(): readonly Asterism[];
  /** One figure by any of its names (ignoring case, accents, tone marks and katakana against hiragana), its reading or its id; `undefined` where there is none, or where the text names two figures. */
  find(text: string): Asterism | undefined;
}

const KATAKANA_FIRST = 0x30a1;
const KATAKANA_LAST = 0x30f6;
const KATAKANA_TO_HIRAGANA = 0x60;

/** A name as a lookup key: accents and tone marks off, lower case, spaces and hyphens gone, katakana as hiragana. */
function nameKey(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()) {
    const code = ch.codePointAt(0)!;
    if (/[\s\-_・]/.test(ch)) continue;
    out += code >= KATAKANA_FIRST && code <= KATAKANA_LAST ? String.fromCodePoint(code - KATAKANA_TO_HIRAGANA) : ch;
  }
  return out;
}

/**
 * Makes a culture from a function that lists its figures. The figures are made on first use and shared after.
 *
 * @param id - The culture's key.
 * @param names - Its name in English and Japanese.
 * @param make - Lists the figures.
 * @returns The culture.
 *
 * @example
 * ```ts
 * import { defineCulture } from "@johnmorrisdotca/hoshi-stars/culture";
 *
 * const mine = defineCulture("mine", { en: "Mine", ja: "私の" }, () => [
 *   { id: "w", name: "W", names: { en: "The W" }, readings: {}, aka: [], about: "", kind: "asterism", group: undefined, missing: 0, chains: [[21, 168, 264, 403, 542]] },
 * ]);
 * console.log(mine.find("the w")?.chains);
 * ```
 */
export function defineCulture(id: string, names: Culture["names"], make: () => Asterism[]): Culture {
  let list: readonly Asterism[] | undefined;
  let index: Map<string, Asterism> | undefined;
  const asterisms = (): readonly Asterism[] => (list ??= Object.freeze(make().map((one) => Object.freeze(one))));
  return Object.freeze({
    id,
    names: Object.freeze({ ...names }),
    asterisms,
    find(text: string): Asterism | undefined {
      if (typeof text !== "string") throw new TypeError(`text must be a string, got ${typeof text}`);
      if (index === undefined) {
        index = new Map();
        const clash = new Set<string>();
        for (const one of asterisms()) {
          for (const word of [one.id, one.name, ...Object.values(one.names), one.readings.ja, one.readings.zh, ...one.aka]) {
            if (word === undefined || word === "") continue;
            const k = nameKey(word);
            const other = index.get(k);
            if (other !== undefined && other !== one) clash.add(k);
            index.set(k, one);
          }
        }
        for (const k of clash) index.delete(k);
      }
      return index.get(nameKey(text));
    },
  });
}
