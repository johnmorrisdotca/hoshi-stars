// The cards of a sky culture: one card for each figure the picker's strip, the gallery and the list show, with its name in the culture's own writing, its reading and English, a picture, and what to search it by.
// The Western sky is the 88 constellations; the Japanese sky is the 88 under their Japanese names and the traditional figures; the Chinese sky is the Three Enclosures and the Twenty-Eight Mansions. One model, so the three pages say the same of a figure.
import { constellations, type Constellation } from "../src/constellations.ts";
import type { AsterismKind, Asterism } from "../src/culture.ts";
import { figures } from "../src/lines.ts";
import { CULTURE_IDS, cultureOf, type CultureId } from "./cultures.ts";
import { fold, inOrder, nameIn, thumbSrc, figureThumbSrc, type Lang, type Look } from "./thumbs.ts";

export interface FigureCard {
  culture: CultureId;
  /** The figure's id: the IAU abbreviation for a constellation (`Ori`), else the figure's own id (`bei3-dou3`, `subaru`). */
  id: string;
  kind: AsterismKind;
  /** The constellation, when the figure is one of the 88 (they use the constellation pictures). */
  constellation?: Constellation;
  /** The figure of the Japanese or Chinese sky. */
  asterism?: Asterism;
  /** How many of its stars the catalogue holds. */
  held: number;
  /** The words a search compares, folded: every name in every writing, the readings and the id. */
  words: readonly string[];
}

/** What a card says: the name, then one small line (the reading and English for a Japanese or Chinese figure, the abbreviation and the other language's name for a Western one), and in its title how many stars are missing. */
export interface Face {
  name: string;
  /** The one small line under the name; the same for a card in the strip, the gallery and the list. Never more than one line: the missing stars go in `label`, the card's title. */
  sub: string;
  /** The reading (pinyin, hiragana), or the English name of a Western constellation's other name; empty for a Western card. */
  reading: string;
  english: string;
  /** At least how many of its stars are fainter than magnitude 6.0 and so not drawn. */
  missing: number;
  /** The words for the missing stars (`3+ fainter stars not shown`), or an empty string where none are. */
  missingText: string;
  /** One text for a screen reader and for the card's title (the tooltip): the name, the line under it and the missing stars. */
  label: string;
}

const MISSING_WORD = { en: (n: number) => `${n}+ fainter stars not shown`, ja: (n: number) => `暗い星${n}個以上は描いていません` } as const;

/** The words a card is searched by, put in one comparable form: no spaces, hyphens, accents, tone marks or case, katakana as hiragana. */
const key = (text: string): string => fold(text).replace(/[\s\-_・·]/g, "");

const made = new Map<string, FigureCard[]>();

function westernCard(c: Constellation): FigureCard {
  return { culture: "western", id: c.abbreviation, kind: "constellation", constellation: c, held: 0, words: [c.name, c.genitive, c.english, c.japanese, c.reading, c.abbreviation].map(key) };
}

/** The cards of a culture, in the order its page shows them: the Western 88 in the page's language's order; the traditional Japanese figures, then the 88 by their Japanese readings; the Chinese mansions, then the asterisms. */
export function cardsOf(id: CultureId, lang: Lang = "en"): readonly FigureCard[] {
  const at = `${id}|${id === "western" ? lang : ""}`;
  let found = made.get(at);
  if (found === undefined) {
    if (id === "western") found = inOrder(lang).map(westernCard);
    else {
      const culture = cultureOf(id)!;
      const byAbbreviation = new Map(constellations().map((c) => [c.abbreviation, c]));
      found = figures(culture).map((figure): FigureCard => {
        const a = figure.asterism;
        const c = a.kind === "constellation" ? byAbbreviation.get(a.id) : undefined;
        return { culture: id, id: a.id, kind: a.kind, ...(c === undefined ? {} : { constellation: c }), asterism: a, held: figure.stars.length, words: [a.id, a.name, ...Object.values(a.names), a.readings.ja ?? "", a.readings.zh ?? "", ...a.aka, a.about].filter((w) => w !== "").map(key) };
      });
      if (id === "japanese") {
        const reading = (card: FigureCard): string => card.asterism!.readings.ja ?? "";
        found.sort((a, b) => Number(a.kind === "constellation") - Number(b.kind === "constellation") || (a.kind === "constellation" ? reading(a).localeCompare(reading(b), "ja") : 0));
      }
    }
    made.set(at, found);
  }
  return found;
}

/** The card of one figure of a culture. */
export const cardOf = (culture: CultureId, id: string): FigureCard | undefined => cardsOf(culture).find((card) => card.id === id);

/** Whether a card answers a search text, by any of its names. */
export function cardAnswers(card: FigureCard, text: string): boolean {
  const q = key(text);
  return q === "" || card.words.some((word) => word.includes(q));
}

/** What a Western constellation's card says in the page's language: its name, then its abbreviation and its name in the other language, which is what its line has always been in the gallery. */
export function westernFace(c: Constellation, lang: Lang): Face {
  const name = nameIn(c, lang);
  const sub = `${c.abbreviation} · ${lang === "ja" ? c.name : c.japanese}`;
  return { name, sub, reading: "", english: "", missing: 0, missingText: "", label: name };
}

/** What a card says in the page's language. */
export function faceOf(card: FigureCard, lang: Lang): Face {
  const a = card.asterism;
  if (a === undefined) return westernFace(card.constellation!, lang);
  // the name stays in the culture's own writing in either language; a constellation of the Japanese sky is by its Japanese name, with its Latin name as the English
  const name = a.kind === "constellation" ? (a.names.ja ?? a.name) : a.name;
  const reading = (card.culture === "chinese" ? a.readings.zh : a.readings.ja) ?? "";
  const english = a.kind === "constellation" ? (a.names.la ?? "") : card.culture === "japanese" ? a.about : (a.names.en ?? "");
  const missing = a.missing;
  const missingText = missing > 0 ? MISSING_WORD[lang](missing) : "";
  return { name, sub: [reading, english].filter((part) => part !== "").join(" · "), reading, english, missing, missingText, label: [name, reading, english, missingText].filter((part) => part !== "").join(lang === "ja" ? "、" : ", ") };
}

/** The picture of a card: a constellation's own, else the figure's (Pages only). */
export const pictureOf = (card: FigureCard, size: 160 | 480, look: Look): string =>
  card.constellation === undefined ? figureThumbSrc(card.culture, card.id, size, look) : thumbSrc(card.constellation.abbreviation, size, look);

/** How a culture's figures divide, for a count: `[number, number]` as the page's words use them (Chinese: mansions and asterisms; Japanese: the 88 and the traditional figures). */
export function mixOf(id: CultureId): readonly [number, number] | undefined {
  if (id === "western") return undefined;
  const cards = cardsOf(id);
  const first = cards.filter((card) => card.kind === (id === "chinese" ? "mansion" : "constellation")).length;
  return [first, cards.length - first];
}

export { CULTURE_IDS };
