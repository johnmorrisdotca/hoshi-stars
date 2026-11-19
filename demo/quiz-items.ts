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
import { middleOf, type Neighbour } from "./quiz-star.ts";
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
  /** What the question is: `figure` (name this figure from its chart, the usual) or `star` (a mansion with only one or two stars held: which mansion holds the ringed star?). */
  ask: "figure" | "star";
  /** For a Chinese figure that is not a mansion: the enclosure Wikidata says it is part of (`purple-forbidden`, `supreme-palace`, `heavenly-market`) or the mansion's id, where it says so. */
  part?: string;
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
    // a reader of Japanese gets the Japanese label Wikidata gives where it has one (虚宿, 参宿), else the Traditional characters
    if (lang === "ja") return asterism.names["ja"] ?? asterism.name;
    const beside = asterism.names["en"] ?? asterism.readings.zh;
    return beside === undefined ? asterism.name : `${asterism.name} (${beside})`;
  }
  if (lang === "ja") return asterism.kind === "constellation" || asterism.readings.ja === undefined ? (asterism.names["ja"] ?? asterism.name) : `${asterism.name} (${asterism.readings.ja})`;
  return asterism.names["en"] ?? asterism.name;
}

/** The items of a sky: the 88 for `western`, else the figures of the culture that are big enough to know (at least three stars and two lines; `chinese` is the 28 mansions first, in the data's order, then the star officials that have a name of their own). In the order of the culture's own list. */
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
        ask: "figure" as const,
        group: constellationFacts(c.abbreviation).origin,
        label: (lang) => (lang === "ja" ? c.japanese : c.name),
      };
    });
  } else {
    const big = figures(culture).filter((f) => f.stars.length >= MIN_STARS && f.segments.length >= MIN_LINES);
    // the old Chinese lists have two 五諸侯, two 柱 and so on: of two figures asked with one name neither can be the right one to choose, so neither is asked
    const twice = new Set(big.map((f) => f.asterism.name).filter((name, i, names) => id === "chinese" && names.indexOf(name) !== i));
    items = big
      .filter((f) => !twice.has(f.asterism.name))
      .map((f) => ({
        id: f.asterism.id,
        stars: f.stars,
        drawStars: f.stars,
        centre: centreOfConstellation(f.asterism.id, culture)!,
        light: lightOf(f.stars),
        ask: "figure" as const,
        group: f.asterism.group ?? f.asterism.partOf ?? f.asterism.kind,
        ...(f.asterism.partOf === undefined ? {} : { part: f.asterism.partOf }),
        label: (lang: Lang) => cultureLabel(id, f.asterism, lang),
      }));
  }
  // the mansions that hold one or two of their stars (角, 氐, 虛, 室, 壁, 婁, 觜) come last, so the places of the others in the list (the question in an address) do not move; they are asked the other way round
  if (id === "chinese") {
    const small = figures(chinese).filter((f) => f.asterism.kind === "mansion" && f.stars.length >= 1 && f.stars.length < MIN_STARS);
    items = [
      ...items,
      ...small.map((f) => ({
        id: f.asterism.id,
        stars: f.stars,
        drawStars: f.stars,
        centre: middleOf(f.stars),
        light: lightOf(f.stars),
        ask: "star" as const,
        group: f.asterism.group ?? f.asterism.kind,
        label: (lang: Lang) => cultureLabel(id, f.asterism, lang),
      })),
    ];
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

/** The ids of the Chinese sky's 28 mansions: the bright 12 and all (21) levels ask these only. */
export const mansionIdsOf = (): ReadonlySet<string> => new Set(chinese.asterisms().filter((a) => a.kind === "mansion").map((a) => a.id));

/** A level of the Chinese sky that is a set of figures and not the brightest so many: the enclosure Wikidata names, or a tranche of the other star officials. */
export interface FigureLevel {
  /** The id kept in the address (`level=purple-forbidden`, `level=officials-2`). */
  id: string;
  /** The enclosure for an enclosure level; `officials` for a tranche. */
  kind: "purple-forbidden" | "heavenly-market" | "officials" | "small-mansions";
  /** Which tranche, from 1, for the officials. */
  tranche: number;
  /** The ids of its figures, in the order of the data's own list for an enclosure and the brightest first for a tranche. */
  ids: readonly string[];
}

/** About how many star officials a tranche holds. */
export const TRANCHE_SIZE = 30;
/** The enclosures that have a level: the ones with enough figures to ask (a level needs six names). The Supreme Palace has two in this data and stays with the other officials. */
export const ENCLOSURE_LEVELS = ["purple-forbidden", "heavenly-market"] as const;
let figureLevels: readonly FigureLevel[] | undefined;

/**
 * The Chinese sky's levels of star officials, apart from the mansions (whose levels are the bright 12 and all). Each figure of the sky other than a mansion is in exactly one: the enclosure level of the enclosure Wikidata says it is part of
 * (the Purple Forbidden and the Heavenly Market), else a tranche of the rest (the Supreme Palace's, the one that is part of a mansion and the ones with no statement), brightest first, in tranches of about 30 of equal size.
 */
export function chineseFigureLevels(): readonly FigureLevel[] {
  if (figureLevels !== undefined) return figureLevels;
  const mansions = mansionIdsOf();
  const officials = itemsFor("chinese").filter((item) => !mansions.has(item.id));
  const small = itemsFor("chinese").filter((item) => item.ask === "star");
  const levels: FigureLevel[] = ENCLOSURE_LEVELS.map((kind) => ({ id: kind, kind, tranche: 0, ids: officials.filter((item) => item.part === kind).map((item) => item.id) }));
  const rest = officials.filter((item) => !(ENCLOSURE_LEVELS as readonly string[]).includes(item.part ?? "")).sort((a, b) => b.light - a.light || a.id.localeCompare(b.id));
  const tranches = Math.max(1, Math.ceil(rest.length / TRANCHE_SIZE));
  for (let t = 0; t < tranches; t += 1) {
    const ids = rest.slice(Math.floor((t * rest.length) / tranches), Math.floor(((t + 1) * rest.length) / tranches)).map((item) => item.id);
    levels.push({ id: `officials-${t + 1}`, kind: "officials", tranche: t + 1, ids });
  }
  levels.unshift({ id: "small-mansions", kind: "small-mansions", tranche: 0, ids: small.map((item) => item.id) });
  figureLevels = levels;
  return levels;
}

/** The level ids a sky offers, in the order of its buttons: the bright 12, 30 and all for the Western and Japanese skies; for the Chinese sky the mansions' bright 12 and all (21), then the small mansions (asked the other way round), the enclosures and the tranches of star officials. */
export function levelIdsFor(id: CultureId): readonly string[] {
  return id === "chinese" ? ["12", "88", ...chineseFigureLevels().map((level) => level.id)] : ["12", "30", "88"];
}

/** The figure level an id names in a sky, or `undefined` (for the bright N levels and for any other sky). */
export const figureLevelOf = (id: CultureId, level: string): FigureLevel | undefined => (id === "chinese" ? chineseFigureLevels().find((one) => one.id === level) : undefined);

let mansionFigures: ReadonlyArray<{ id: string; figure: Neighbour }> | undefined;

/** The other mansions' stars and lines (all 28 but the one asked), for the faint marks round the question of a small mansion. */
export function otherMansions(exceptId: string): readonly Neighbour[] {
  mansionFigures ??= figures(chinese).filter((f) => f.asterism.kind === "mansion").map((f) => ({ id: f.asterism.id, figure: { stars: f.stars, segments: f.segments } }));
  return mansionFigures.filter((m) => m.id !== exceptId).map((m) => m.figure);
}
