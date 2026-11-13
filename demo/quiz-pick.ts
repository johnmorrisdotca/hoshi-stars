// The quiz's wrong names: for a question, five other constellations that are easy to mix up with the answer. A random one is often trivially different (a southern bird against a great hunter), so the neighbours in the sky come first (the ones that
// share a border with it), then the ones made by the same people in the same years (`origin`: the ancients' 48, the southern voyagers' 12, La Caille's 14, and so on), then the rest of the level. Pure: the random numbers are passed in.
import { constellationFacts } from "../src/constellation-facts.ts";
import { neighbouringConstellations } from "../src/nearest.ts";

/** What makes two items alike: those next to it in the sky, and the group it belongs to (where it was made, a Chinese mansion's quarter). */
export interface Ties {
  near: (id: string) => ReadonlySet<string>;
  group: (id: string) => string;
}

/** The Western sky's ties: the constellations that share a border, and the constellation facts' origin. */
export const westernTies: Ties = { near: (id) => new Set(neighbouringConstellations(id).map((c) => c.abbreviation)), group: (id) => constellationFacts(id).origin };

/** The ties of a sky culture's figures, which have no borders: the `howMany` nearest by the angle between their middles, and the figure's own group. */
export function nearestTies(items: ReadonlyArray<{ id: string; centre: { rightAscension: number; declination: number }; group: string }>, howMany = 4): Ties {
  const unit = (p: { rightAscension: number; declination: number }): [number, number, number] => {
    const ra = (p.rightAscension * Math.PI) / 180;
    const dec = (p.declination * Math.PI) / 180;
    return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  };
  const places = new Map(items.map((item) => [item.id, unit(item.centre)] as const));
  const groups = new Map(items.map((item) => [item.id, item.group] as const));
  const near = new Map<string, ReadonlySet<string>>();
  return {
    near(id) {
      let found = near.get(id);
      if (found === undefined) {
        const at = places.get(id);
        const by = at === undefined ? [] : [...places].filter(([other]) => other !== id).map(([other, there]) => [other, at[0] * there[0] + at[1] * there[1] + at[2] * there[2]] as const).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        found = new Set(by.slice(0, howMany).map(([other]) => other));
        near.set(id, found);
      }
      return found;
    },
    group: (id) => groups.get(id) ?? "",
  };
}

const NEIGHBOURS = 3;

/** A shuffled copy (Fisher-Yates) with the random numbers given. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The wrong names for a question: up to `count` abbreviations of `pool` other than the answer, a few of its neighbours first (at most three, so the neighbours are not all there is to see), then ones of the same origin, then any others of the pool;
 * the neighbours left over come after the family. Each group is in a random order. Fewer than `count` come back only when the pool has fewer.
 *
 * @param answer - The IAU abbreviation of the constellation asked.
 * @param pool - The abbreviations the level asks (the answer is in it).
 * @param count - How many wrong names to give.
 * @param random - A random number in [0, 1), `Math.random` by default.
 * @param ties - What makes two alike: the Western sky's borders and origins by default, or `nearestTies` for a sky culture.
 * @returns The wrong names, no one twice, never the answer.
 */
export function distractors(answer: string, pool: readonly string[], count: number, random: () => number = Math.random, ties: Ties = westernTies): string[] {
  const inPool = new Set(pool);
  inPool.delete(answer);
  const near = ties.near(answer);
  const origin = ties.group(answer);
  const neighbours = shuffled([...inPool].filter((one) => near.has(one)), random);
  const family = shuffled([...inPool].filter((one) => !near.has(one) && ties.group(one) === origin), random);
  const others = shuffled([...inPool].filter((one) => !near.has(one) && ties.group(one) !== origin), random);
  const first = neighbours.slice(0, NEIGHBOURS);
  return [...first, ...family, ...neighbours.slice(NEIGHBOURS), ...others].slice(0, count);
}
