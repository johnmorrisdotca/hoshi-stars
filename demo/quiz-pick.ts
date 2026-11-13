// The quiz's wrong names: for a question, five other constellations that are easy to mix up with the answer. A random one is often trivially different (a southern bird against a great hunter), so the neighbours in the sky come first (the ones that
// share a border with it), then the ones made by the same people in the same years (`origin`: the ancients' 48, the southern voyagers' 12, La Caille's 14, and so on), then the rest of the level. Pure: the random numbers are passed in.
import { constellationFacts } from "../src/constellation-facts.ts";
import { neighbouringConstellations } from "../src/nearest.ts";

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
 * @returns The wrong names, no one twice, never the answer.
 */
export function distractors(answer: string, pool: readonly string[], count: number, random: () => number = Math.random): string[] {
  const inPool = new Set(pool);
  inPool.delete(answer);
  const near = new Set(neighbouringConstellations(answer).map((c) => c.abbreviation));
  const origin = constellationFacts(answer).origin;
  const neighbours = shuffled([...inPool].filter((one) => near.has(one)), random);
  const family = shuffled([...inPool].filter((one) => !near.has(one) && constellationFacts(one).origin === origin), random);
  const others = shuffled([...inPool].filter((one) => !near.has(one) && constellationFacts(one).origin !== origin), random);
  const first = neighbours.slice(0, NEIGHBOURS);
  return [...first, ...family, ...neighbours.slice(NEIGHBOURS), ...others].slice(0, count);
}
