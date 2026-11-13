// What the quiz asks about: the 88 constellations, or the figures of a sky culture that are big enough to know by sight (at least three stars in the catalogue and two lines). Each is an item with the stars of its figure, the middle of it, how much light
// it gives (for the "bright" levels), a group (to make the wrong names alike) and its name in the reader's language. The Japanese sky is its 88 constellations as Japan names and joins them and its traditional star patterns; the Chinese level is the Twenty-Eight
// Mansions with at least three stars held (21 of 28: 角宿 and a few others hold only one or two of their stars). Names are the data's own: the Japanese sky's Japanese and English names, the Chinese mansions' Traditional characters with the English name
// where the data has one and the pinyin where it has not (a reader of Japanese gets the characters). No name is made up or translated by machine. Pure: no DOM.
import { centreOfConstellation } from "../src/chart/chart.ts";
import type { Asterism, Culture } from "../src/culture.ts";
import { constellationFacts } from "../src/constellation-facts.ts";
import { constellations, starsIn } from "../src/constellations.ts";
import { chinese } from "../src/cultures/chinese.ts";
import { japanese } from "../src/cultures/japanese.ts";
import { figureOf, figures } from "../src/lines.ts";
import type { Star } from "../src/stars.ts";
import { CULTURE_IDS, type CultureId } from "./cultures.ts";

export { CULTURE_IDS, type CultureId };
export type Lang = "en" | "ja";

export interface QuizItem {
  /** The IAU abbreviation (`Ori`) of a Western constellation, else the figure's id (`jiao3-xiu4`). */
  id: string;
  /** The stars that stand for the figure: its own, or the stars of the constellation brighter than magnitude 5 where it has no figure. */
  stars: readonly Star[];
  /** The stars the chart is fitted to: the same, with the fainter ones (to 5.5) for a constellation with no figure. */
  drawStars: readonly Star[];
  /** The middle of the figure, where the chart is centred. */
  centre: { rightAscension: number; declination: number };
  /** The light of its stars added up (a magnitude 1 star is 2.5 times a magnitude 2). */
  light: number;
  /** What makes two items alike: where a constellation was made, a Chinese mansion's quarter, or the kind of a Japanese figure. */
  group: string;
  /** The name to choose, in the reader's language. */
  label: (lang: Lang) => string;
}

const MIN_STARS = 3;
const MIN_LINES = 2;
const lightOf = (stars: readonly Star[]): number => stars.reduce((sum, star) => sum + 10 ** (-0.4 * star.magnitude), 0);
const cultureOfId = (id: CultureId): Culture | undefined => (id === "japanese" ? japanese : id === "chinese" ? chinese : undefined);
const held = new Map<CultureId, readonly QuizItem[]>();

/** The text of a name, for the reader's language: Japanese figures give their name in Japanese or English; Chinese mansions give the Traditional characters, with the English name or else the pinyin beside them for a reader of English. */
function cultureLabel(id: CultureId, asterism: Asterism, lang: Lang): string {
  if (id === "chinese") {
    if (lang === "ja") return asterism.name;
    const beside = asterism.names["en"] ?? asterism.readings.zh;
    return beside === undefined ? asterism.name : `${asterism.name} (${beside})`;
  }
  if (lang === "ja") return asterism.kind === "constellation" || asterism.readings.ja === undefined ? (asterism.names["ja"] ?? asterism.name) : `${asterism.name} (${asterism.readings.ja})`;
  return asterism.names["en"] ?? asterism.name;
}

/** The items of a sky: the 88 for `western`, else the figures of the culture that are big enough to know (`chinese` is the mansions only). In the order of the culture's own list. */
export function itemsFor(id: CultureId): readonly QuizItem[] {
  const found = held.get(id);
  if (found !== undefined) return found;
  const culture = cultureOfId(id);
  let items: QuizItem[];
  if (culture === undefined) {
    items = constellations().map((c) => {
      const figure = figureOf(c.abbreviation).stars;
      const stars = figure.length > 0 ? figure : starsIn(c.abbreviation).filter((star) => star.magnitude < 5);
      return {
        id: c.abbreviation,
        stars,
        drawStars: figure.length > 0 ? figure : starsIn(c.abbreviation).filter((star) => star.magnitude < 5.5),
        centre: centreOfConstellation(c.abbreviation)!,
        light: lightOf(stars),
        group: constellationFacts(c.abbreviation).origin,
        label: (lang) => (lang === "ja" ? c.japanese : c.name),
      };
    });
  } else {
    items = figures(culture)
      .filter((f) => (id === "chinese" ? f.asterism.kind === "mansion" : true) && f.stars.length >= MIN_STARS && f.segments.length >= MIN_LINES)
      .map((f) => ({
        id: f.asterism.id,
        stars: f.stars,
        drawStars: f.stars,
        centre: centreOfConstellation(f.asterism.id, culture)!,
        light: lightOf(f.stars),
        group: f.asterism.group ?? f.asterism.kind,
        label: (lang: Lang) => cultureLabel(id, f.asterism, lang),
      }));
  }
  held.set(id, items);
  return items;
}

/** The sky culture of an id (`undefined` for the Western sky), for the chart. */
export const cultureFor = (id: CultureId): Culture | undefined => cultureOfId(id);

/** The abbreviation or id of an item that a hand-written `c=` names, for a culture: any of its names, or its id. */
export function itemNamed(id: CultureId, text: string): string | undefined {
  const items = itemsFor(id);
  if (items.some((item) => item.id === text)) return text;
  const culture = cultureOfId(id);
  const found = culture === undefined ? constellations().find((c) => c.abbreviation.toLowerCase() === text.toLowerCase() || c.name.toLowerCase() === text.toLowerCase())?.abbreviation : culture.find(text)?.id;
  return found !== undefined && items.some((item) => item.id === found) ? found : undefined;
}
