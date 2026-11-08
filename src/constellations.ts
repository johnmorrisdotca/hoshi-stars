// The 88 constellations the IAU recognises, with their names in Latin, English and Japanese.
// The constellations tier (`@johnmorrisdotca/hoshi-stars/constellations`): a table of about 2 kB gzipped. Only `starsIn` reaches the bright-star table. Pure: no DOM, no state beyond the parsed table.
import { CONSTELLATION_ROWS } from "./data/constellations.ts";
import { stars, type Star } from "./stars.ts";

/**
 * One of the 88 constellations.
 *
 * @example
 * ```ts
 * import { constellation, type Constellation } from "@johnmorrisdotca/hoshi-stars/constellations";
 *
 * const orion: Constellation = constellation("Ori")!;
 * console.log(orion.name, orion.english, orion.japanese);
 * ```
 */
export interface Constellation {
  /** The IAU three-letter abbreviation, with its real capitals (`CMa`, `CVn`, `PsA`). It is the same text as `Star.constellation`. */
  abbreviation: string;
  /** The Latin name (`Canis Major`, `Boötes`). */
  name: string;
  /** The Latin genitive, the form used in star names (`Canis Majoris` for α Canis Majoris). */
  genitive: string;
  /** The English name without an article (`Great Dog`, `Hunter`). */
  english: string;
  /** The Japanese name in the kana form the National Astronomical Observatory of Japan uses, ending in 座 (`おおいぬ座`, `オリオン座`). */
  japanese: string;
  /** The Japanese name written wholly in hiragana, 座 read as ざ (`おおいぬざ`, `おりおんざ`). The long-vowel mark ー stays. */
  reading: string;
}

const KATAKANA_FIRST = 0x30a1;
const KATAKANA_LAST = 0x30f6;
const KATAKANA_TO_HIRAGANA = 0x60;

function hiragana(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    out += code >= KATAKANA_FIRST && code <= KATAKANA_LAST ? String.fromCodePoint(code - KATAKANA_TO_HIRAGANA) : ch;
  }
  return out;
}

function key(text: string): string {
  return hiragana(text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase());
}

const stored: Constellation[] = [];
const byText = new Map<string, Constellation>();
const ambiguous = new Set<string>();

function load(): void {
  if (stored.length > 0) return;
  for (const row of CONSTELLATION_ROWS.split("\n")) {
    const [abbreviation, name, genitive, english, stem] = row.split("|") as [string, string, string, string, string];
    const item: Constellation = Object.freeze({
      abbreviation,
      name,
      genitive,
      english,
      japanese: `${stem}座`,
      reading: `${hiragana(stem)}ざ`,
    });
    stored.push(item);
    for (const text of [abbreviation, name, genitive, english, item.japanese, stem, item.reading]) {
      const k = key(text);
      const other = byText.get(k);
      if (other !== undefined && other !== item) ambiguous.add(k);
      byText.set(k, item);
    }
  }
  for (const k of ambiguous) byText.delete(k);
}

/**
 * All 88 constellations, alphabetical by Latin name (Andromeda first, Vulpecula last).
 *
 * @returns A fresh array of the shared, frozen constellations.
 *
 * @example
 * ```ts
 * import { constellations } from "@johnmorrisdotca/hoshi-stars/constellations";
 *
 * console.log(constellations().length, constellations().map((c) => c.japanese).slice(0, 3));
 * ```
 */
export function constellations(): Constellation[] {
  load();
  return [...stored];
}

/**
 * A constellation by any of its names, ignoring case and the accent on Boötes: the IAU abbreviation (`CMa`), the Latin name (`Canis Major`), the genitive (`Canis Majoris`), the English name
 * (`Great Dog`), the Japanese name with or without 座 (`おおいぬ座`, `おおいぬ`) in katakana or hiragana, or its hiragana reading (`おおいぬざ`). A text that would name two constellations finds
 * neither.
 *
 * @param text - The name, in any of those forms.
 * @returns The constellation, or `undefined` if the text is none of them.
 * @throws TypeError if `text` is not a string.
 *
 * @example
 * ```ts
 * import { constellation } from "@johnmorrisdotca/hoshi-stars/constellations";
 *
 * console.log(constellation("cma")?.english, constellation("オリオン座")?.abbreviation, constellation("おおぐま座")?.name);
 * ```
 */
export function constellation(text: string): Constellation | undefined {
  if (typeof text !== "string") throw new TypeError(`text must be a string, got ${typeof text}`);
  load();
  return byText.get(key(text));
}

/**
 * The bright stars that lie in a constellation, brightest first: the stars of the Yale Bright Star Catalogue whose `constellation` is that abbreviation. Only stars with a Bayer letter or
 * a Flamsteed number carry a constellation, so the list is the named-or-numbered stars of it.
 *
 * @param text - The constellation, as the IAU abbreviation (`Ori`) or any other name `constellation` accepts.
 * @returns A fresh array of the shared, frozen stars.
 * @throws TypeError if `text` is not a string. RangeError if it is not one of the 88 constellations.
 *
 * @example
 * ```ts
 * import { starsIn } from "@johnmorrisdotca/hoshi-stars/constellations";
 *
 * console.log(starsIn("Ori").slice(0, 3).map((s) => s.name ?? s.designation));
 * ```
 */
export function starsIn(text: string): Star[] {
  const found = constellation(text);
  if (found === undefined) throw new RangeError(`"${text}" is not one of the 88 constellations (use the IAU abbreviation such as "Ori")`);
  return stars().filter((star) => star.constellation === found.abbreviation);
}
