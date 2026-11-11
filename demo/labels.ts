// Where the chart's names go: each label offers places in order of liking, and takes the first that touches no label already placed and no star or marker that must stay clear.
// One pass over the labels, brightest first, with a grid so a label looks only at its neighbours.

/** A rectangle in chart pixels. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

let pen: CanvasRenderingContext2D | null | undefined;
const measured = new Map<string, TextMetrics>();

/**
 * The room a text takes. From its length and size a letter of Latin text is about 0.6 of the size wide and a Japanese letter the whole size, and a line reaches 0.85 of the size
 * above its baseline and 0.3 below. In a browser the text is also measured in the chart's own font (system-ui), which is the reader's, and the larger of the two is taken: a
 * font that is wider or taller than the estimate (a Linux machine whose only sans-serif is a Chinese font draws a Latin line 1.26 of the size tall) still gets the room it draws in.
 *
 * @param text - The text.
 * @param size - The font size in pixels.
 * @param weight - The font weight, 400 by default.
 * @returns The width and height in pixels, and how far the text reaches above and below its baseline.
 *
 * @example
 * ```ts
 * import { textSize } from "./labels.ts";
 *
 * console.log(textSize("シリウス", 11), textSize("Sirius", 11, 700));
 * ```
 */
export function textSize(text: string, size: number, weight = 400): { w: number; h: number; above: number; below: number } {
  let w = 0;
  for (const ch of text) w += ch.charCodeAt(0) > 0x2e7f ? size : size * 0.6;
  let above = size * 0.85;
  let below = size * 0.3;
  if (pen === undefined) pen = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (pen !== null) {
    const key = `${weight} ${size} ${text}`;
    let metrics = measured.get(key);
    if (metrics === undefined) {
      pen.font = `${weight} ${size}px system-ui, sans-serif`;
      metrics = pen.measureText(text);
      measured.set(key, metrics);
    }
    w = Math.max(w, metrics.width);
    above = Math.max(above, metrics.fontBoundingBoxAscent || 0);
    below = Math.max(below, metrics.fontBoundingBoxDescent || 0);
  }
  return { w: Math.ceil(w), h: Math.ceil(size * 1.2), above, below };
}

/** Whether two boxes share any area. */
export const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

const CELL = 48;

/**
 * Chooses a place for each label so that no two labels touch and none sits on an obstacle. Labels are taken in the order given, so the most important comes first; a label none of whose
 * places is free is left out.
 *
 * @param candidates - The labels, most important first, each with its places in order of liking.
 * @param obstacles - What labels must keep off: the stars and markers.
 * @returns For each label, the index of the place it takes, or `undefined` when it is left out.
 *
 * @example
 * ```ts
 * import { placeLabels } from "./labels.ts";
 *
 * const here = { x0: 0, y0: 0, x1: 40, y1: 12 };
 * const also = { x0: 20, y0: 4, x1: 60, y1: 16 };
 * console.log(placeLabels([[here], [also]], []));
 * ```
 */
export function placeLabels(candidates: ReadonlyArray<readonly Box[]>, obstacles: readonly Box[]): Array<number | undefined> {
  const grid = new Map<number, Box[]>();
  const keys = (box: Box): number[] => {
    const out: number[] = [];
    for (let gx = Math.floor(box.x0 / CELL); gx <= Math.floor(box.x1 / CELL); gx += 1) for (let gy = Math.floor(box.y0 / CELL); gy <= Math.floor(box.y1 / CELL); gy += 1) out.push(gx * 100_003 + gy);
    return out;
  };
  const add = (box: Box): void => {
    for (const key of keys(box)) {
      const cell = grid.get(key);
      if (cell === undefined) grid.set(key, [box]);
      else cell.push(box);
    }
  };
  const free = (box: Box): boolean => keys(box).every((key) => !(grid.get(key) ?? []).some((other) => overlaps(box, other)));
  for (const box of obstacles) add(box);
  return candidates.map((places) => {
    const at = places.findIndex(free);
    if (at < 0) return undefined;
    add(places[at]!);
    return at;
  });
}
