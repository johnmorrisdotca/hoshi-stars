// What a figure's own page needs of the three skies: the stars a figure joins, the figures of the other two skies that join the same stars, the figures nearest to it in its own sky, and the way to its page.
// Pure: no DOM, nothing but the package's own tables, so a test can ask it the same things the page does.
import { starsIn } from "../src/constellations.ts";
import { figures } from "../src/lines.ts";
import { neighbouringConstellations } from "../src/nearest.ts";
import type { Star } from "../src/stars.ts";
import { cardOf, cardsOf, type FigureCard } from "./culture-cards.ts";
import { CULTURE_IDS, DEFAULT_CULTURE, cultureOf, type CultureId } from "./cultures.ts";

/** A figure of another sky that joins some of the same stars, with how many it shares and how alike the two are. */
export interface Related {
  card: FigureCard;
  /** How many stars the two figures have in common. */
  shared: number;
  /** The shared stars as a part of all the stars either figure joins (0 to 1): 1 where they join the very same stars. */
  likeness: number;
}

const stored = new Map<CultureId, Map<string, readonly Star[]>>();

/** The stars a figure joins, in the order its lines reach them; empty for a figure the culture does not have. */
export function starsOfFigure(culture: CultureId, id: string): readonly Star[] {
  let table = stored.get(culture);
  if (table === undefined) {
    table = culture === "western" ? new Map(figures().map((f) => [f.constellation.abbreviation, f.stars])) : new Map(figures(cultureOf(culture)!).map((f) => [f.asterism.id, f.stars]));
    stored.set(culture, table);
  }
  return table.get(id) ?? [];
}

const members = new Map<string, readonly Star[]>();

/**
 * The stars a card stands for when two skies are compared: for one of the 88 constellations (in the Western sky or under its Japanese name) every star inside its boundary, because that is what the constellation is, and not
 * only the few its stick figure joins; for any other figure the stars it joins.
 */
export function starsOfCard(card: FigureCard): readonly Star[] {
  if (card.kind !== "constellation") return starsOfFigure(card.culture, card.id);
  let found = members.get(card.id);
  if (found === undefined) members.set(card.id, (found = starsIn(card.id)));
  return found;
}

/**
 * The figures of `other` that have some of the stars of one figure, the one that shares most first, then the one the stars fill most of (the shared stars as a part of the smaller figure), then the smaller figure.
 * Only the figures a card is drawn for count: the 88 of the Western sky, the 88 and the traditional figures of the Japanese, the mansions and asterisms of the Chinese.
 */
export function sameSky(culture: CultureId, id: string, other: CultureId): Related[] {
  const home = cardOf(culture, id);
  if (home === undefined || other === culture) return [];
  const mine = starsOfCard(home);
  const have = new Set(mine.map((star) => star.hr));
  const order = new Map(cardsOf(other).map((card, at) => [card.id, at]));
  const found: Array<Related & { size: number }> = [];
  for (const card of cardsOf(other)) {
    const theirs = starsOfCard(card);
    const shared = theirs.filter((star) => have.has(star.hr)).length;
    if (shared > 0) found.push({ card, shared, likeness: shared / Math.min(mine.length, theirs.length), size: theirs.length });
  }
  return found.sort((a, b) => b.shared - a.shared || b.likeness - a.likeness || a.size - b.size || order.get(a.card.id)! - order.get(b.card.id)!).map(({ card, shared, likeness }) => ({ card, shared, likeness }));
}

/**
 * The figure of another sky that stands for this one, and the one a choice of that sky leads to: a constellation's own name in the other sky where it has one (Orion is オリオン座 in the Japanese sky), else the figure that shares most
 * stars (then the smaller). `undefined` where no figure of that sky has any of the stars.
 */
export function counterpart(culture: CultureId, id: string, other: CultureId): FigureCard | undefined {
  if (other === culture) return cardOf(culture, id);
  const home = cardOf(culture, id);
  if (home?.kind === "constellation") {
    const same = cardOf(other, id);
    if (same !== undefined) return same;
  }
  return sameSky(culture, id, other)[0]?.card;
}

const vectors = new Map<number, readonly [number, number, number]>();
const unit = (star: Star): readonly [number, number, number] => {
  let found = vectors.get(star.hr);
  if (found === undefined) {
    const a = (star.rightAscension * Math.PI) / 180;
    const d = (star.declination * Math.PI) / 180;
    vectors.set(star.hr, (found = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]));
  }
  return found;
};
const dot = (a: readonly [number, number, number], b: readonly [number, number, number]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The middle of a figure's stars, as one point on the sky. */
function middleOf(stars: readonly Star[]): readonly [number, number, number] {
  const sum = stars.reduce<[number, number, number]>((all, star) => {
    const [x, y, z] = unit(star);
    return [all[0] + x, all[1] + y, all[2] + z];
  }, [0, 0, 0]);
  const length = Math.hypot(...sum) || 1;
  return [sum[0] / length, sum[1] / length, sum[2] / length];
}

/**
 * The figures that lie nearest to one in its own sky, as that sky's cards: for the 88 constellations the ones that share a piece of boundary with it (as the Neighbours have always been), for any other figure the ones whose stars come
 * nearest to its stars (the constellation that holds them, at nothing, first), the nearer middle first where two are as near.
 */
export function neighboursOf(culture: CultureId, id: string, count = 6): FigureCard[] {
  const card = cardOf(culture, id);
  if (card === undefined) return [];
  if (card.kind === "constellation") {
    const wanted = new Set(neighbouringConstellations(id).map((c) => c.abbreviation));
    return cardsOf(culture).filter((one) => wanted.has(one.id));
  }
  const mine = starsOfCard(card).map(unit);
  if (mine.length === 0) return [];
  const middle = middleOf(starsOfCard(card));
  const scored: Array<{ one: FigureCard; closest: number; middle: number }> = [];
  for (const one of cardsOf(culture)) {
    const theirs = starsOfCard(one);
    if (one.id === id || theirs.length === 0) continue;
    let best = -1;
    for (const b of theirs.map(unit)) for (const a of mine) best = Math.max(best, dot(a, b));
    scored.push({ one, closest: Math.acos(Math.min(1, best)), middle: Math.acos(Math.max(-1, Math.min(1, dot(middle, middleOf(theirs))))) });
  }
  const tenth = (radians: number): number => Math.round((radians * 1800) / Math.PI);
  return scored.sort((a, b) => tenth(a.closest) - tenth(b.closest) || a.middle - b.middle).slice(0, count).map((one) => one.one);
}

/** The address of a figure's own page. */
export const figureHref = (culture: CultureId, id: string): string => `constellation.html?c=${encodeURIComponent(id)}${culture === DEFAULT_CULTURE ? "" : `&culture=${culture}`}`;

/**
 * The figure an address names: its card, and the sky it is in. An id that is the named sky's own is that figure. A page with no sky named (the Western sky is the one a page opens with) finds an id in whichever sky has it (`c=subaru`),
 * so a link to a figure never needs the sky written; a named sky that does not have the id (`c=Ori&culture=chinese`) opens the figure it has for the same stars, so the choice of a sky and an old link land on a page and not on an error.
 * `undefined` where no sky has the id.
 */
export function figureFor(c: string, named: CultureId): FigureCard | undefined {
  const here = cardOf(named, c);
  if (here !== undefined) return here;
  for (const culture of CULTURE_IDS) {
    const there = cardOf(culture, c);
    if (there !== undefined) return named === DEFAULT_CULTURE ? there : (counterpart(culture, c, named) ?? there);
  }
  return undefined;
}
