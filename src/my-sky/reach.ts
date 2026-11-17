// Which drawn thing a press lands on (`pickBody`) and where a planet's name goes so it does not print over another (`nameSpot`). Pure: numbers in, numbers out, so both are tested without a canvas.
import type { DrawnBody } from "./draw.ts";

/** A rectangle in CSS pixels. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** How far from a planet's dot a press still counts, in CSS pixels; never less than `MARK_REACH`. */
export const PLANET_REACH = 18;

/** How far from a page's mark a press still counts, in CSS pixels. */
export const MARK_REACH = 18;

/**
 * The thing a press at (`x`, `y`) lands on. The Sun, the Moon and the planets come first: one whose reach, or whose name, holds the press wins over any mark of the page's, the nearest of them if there are several.
 * Else the nearest mark whose reach holds the press. The ring round the target is never picked.
 *
 * @param bodies - What the last draw returned.
 * @param x - The press, in CSS pixels across.
 * @param y - The press, in CSS pixels down.
 * @returns The body, or `undefined` for the open sky.
 *
 * @example
 * ```ts
 * import { pickBody } from "@johnmorrisdotca/hoshi-stars/my-sky/reach";
 *
 * console.log(pickBody([{ kind: "planet", id: "mars", x: 40, y: 40, r: 18 }], 44, 40)?.id);
 * ```
 */
export function pickBody(bodies: readonly DrawnBody[], x: number, y: number): DrawnBody | undefined {
  let best: DrawnBody | undefined;
  let bestRank = Infinity;
  let near = Infinity;
  for (const body of bodies) {
    if (body.kind === "target") continue;
    const onName = body.name !== undefined && x >= body.name.x0 && x <= body.name.x1 && y >= body.name.y0 && y <= body.name.y1;
    const away = onName ? 0 : Math.hypot(body.x - x, body.y - y);
    if (away > body.r) continue;
    const rank = body.kind === "mark" ? 1 : 0;
    if (rank < bestRank || (rank === bestRank && away < near)) {
      best = body;
      bestRank = rank;
      near = away;
    }
  }
  return best;
}

/** Where a planet's name is written: the point the text starts from and its baseline, the canvas `textAlign` (`left` runs the text to the right of the point, `right` to its left), and the box it fills. */
export interface NameSpot {
  x: number;
  y: number;
  align: "left" | "right";
  box: Box;
}

/**
 * Where to write a planet's name beside its dot: to the right, else the left, else one line down or up on either side, the first place that touches no box in `taken`. When none is free the right is used.
 * The box found is added to `taken`.
 *
 * @param taken - The boxes already used by planets and their names.
 * @param x - The dot's centre across.
 * @param y - The dot's centre down.
 * @param radius - The dot's radius.
 * @param width - The width of the name's text.
 * @returns Where to write the name.
 *
 * @example
 * ```ts
 * import { nameSpot } from "@johnmorrisdotca/hoshi-stars/my-sky/reach";
 *
 * console.log(nameSpot([], 100, 100, 4, 30).align);
 * ```
 */
export function nameSpot(taken: Box[], x: number, y: number, radius: number, width: number): NameSpot {
  const at = (align: "left" | "right", dy: number): NameSpot => {
    const start = align === "left" ? x + radius + 5 : x - radius - 5;
    const baseline = y + 4 + dy;
    const side = align === "left" ? { x0: start, x1: start + width } : { x0: start - width, x1: start };
    return { x: start, y: baseline, align, box: { ...side, y0: baseline - 11, y1: baseline + 3 } };
  };
  const options = [at("left", 0), at("right", 0), at("left", 13), at("right", 13), at("left", -13), at("right", -13)];
  const spot = options.find((o) => !taken.some((t) => o.box.x0 < t.x1 && o.box.x1 > t.x0 && o.box.y0 < t.y1 && o.box.y1 > t.y0)) ?? options[0]!;
  taken.push(spot.box);
  return spot;
}
