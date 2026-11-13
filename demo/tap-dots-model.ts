// The rules of the Tap the dots page, with no DOM and no clock: the order a figure's dots are met in, which dot a tap meant, and what a tap does to the child's progress. The page (`tap-dots.ts`) only draws what these say.
import type { DotsFigure } from "../src/sheets/dots.ts";

/** The dots' places, as the page needs them to tell which was tapped. */
export interface Place {
  x: number;
  y: number;
  /** The radius, in the same units as `x` and `y`. */
  r: number;
}

/** What the child has done so far: how many dots in a row are right, and how many taps were wrong. */
export interface Progress {
  /** The visits joined so far, from 0 to `visits`. */
  done: number;
  wrong: number;
}

/** What one tap did: `right` (the line grew), `wrong` (nothing moved), `finished` (the last dot was right) or `ignored` (the tap was on no dot, or the figure is already finished). */
export type TapResult = "right" | "wrong" | "finished" | "ignored";

/**
 * The dots in the order the pencil meets them, one entry for each visit (a star the lines pass again appears twice), from the lines of the answer: a line that does not start where the one before ended begins a new stroke, so its first dot is met too. The same on every level, even the hard one that prints no numbers.
 *
 * @example
 * ```ts
 * import { dotsFigure } from "../src/sheets/dots.ts";
 * import { visitOrder } from "./tap-dots-model.ts";
 *
 * const order = visitOrder(dotsFigure("Cru", { level: "easy", widthMm: 120, heightMm: 120 }));
 * console.log(order.length);
 * ```
 */
export function visitOrder(figure: Pick<DotsFigure, "lines">): number[] {
  const order: number[] = [];
  for (const [a, b] of figure.lines) {
    if (order.at(-1) !== a) order.push(a);
    order.push(b);
  }
  return order;
}

/** The dot to tap next, as an index into the figure's dots, or `null` when every visit is joined. */
export const nextDot = (order: readonly number[], progress: Progress): number | null => order[progress.done] ?? null;

/** The visit number the child is to find next (1 for the first), or `null` when finished. */
export const nextNumber = (order: readonly number[], progress: Progress): number | null => (progress.done < order.length ? progress.done + 1 : null);

/**
 * The visit each line of the answer ends at (1 for the first dot met): the line joining visit `k - 1` to visit `k`. A line that starts a new stroke ends at the visit after the stroke's first dot.
 *
 * @example
 * ```ts
 * import { lineVisits } from "./tap-dots-model.ts";
 *
 * console.log(lineVisits([[0, 1], [1, 2], [5, 6]]).join(","));
 * ```
 */
export function lineVisits(lines: readonly (readonly [number, number])[]): number[] {
  const out: number[] = [];
  let visit = 0;
  let previous: number | undefined;
  for (const [a, b] of lines) {
    if (previous !== a) visit += 1;
    visit += 1;
    previous = b;
    out.push(visit);
  }
  return out;
}

/** The lines of the answer drawn once `progress.done` visits are joined: those that end at a visit already reached. */
export const drawnLines = (lines: readonly (readonly [number, number])[], progress: Progress): [number, number][] => {
  const ends = lineVisits(lines);
  return lines.filter((_, i) => ends[i]! <= progress.done).map(([a, b]) => [a, b]);
};

/**
 * Which dot a tap at (`x`, `y`) meant: the nearest dot whose reach holds the point, or `null` when none does. The reach of a dot is at least `reach` (the size a finger needs, in the page's units) and at least its own radius, so a small dot is still easy to hit.
 *
 * @example
 * ```ts
 * import { hitDot } from "./tap-dots-model.ts";
 *
 * console.log(hitDot([{ x: 10, y: 10, r: 1 }, { x: 30, y: 10, r: 1 }], 12, 11, 6), hitDot([{ x: 10, y: 10, r: 1 }], 50, 50, 6));
 * ```
 */
export function hitDot(places: readonly Place[], x: number, y: number, reach: number): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  places.forEach((place, i) => {
    const d = Math.hypot(place.x - x, place.y - y);
    if (d <= Math.max(reach, place.r) && d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
}

/**
 * What a tap on `dot` (an index, or `null` for a tap on no dot) does: the right dot joins one more visit, any other dot is wrong and moves nothing, a tap on no dot or after the end is ignored.
 *
 * @example
 * ```ts
 * import { tapDot } from "./tap-dots-model.ts";
 *
 * console.log(tapDot([2, 0, 1], { done: 0, wrong: 0 }, 2), tapDot([2, 0, 1], { done: 0, wrong: 0 }, 1));
 * ```
 */
export function tapDot(order: readonly number[], progress: Progress, dot: number | null): { progress: Progress; result: TapResult } {
  const wanted = nextDot(order, progress);
  if (wanted === null || dot === null) return { progress, result: "ignored" };
  if (dot !== wanted) return { progress: { ...progress, wrong: progress.wrong + 1 }, result: "wrong" };
  const done = progress.done + 1;
  return { progress: { ...progress, done }, result: done === order.length ? "finished" : "right" };
}
