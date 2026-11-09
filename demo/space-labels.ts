// Where the labels of the constellation in 3D go. Pure geometry, no DOM: each label is tried beside its star in a fixed order of places and kept at the first place where it overlaps no label already placed, no star and no
// edge of the view; a label that fits nowhere in its full size is tried with only its name, and one that still fits nowhere is left out (the table beside the view has every star).
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One label to place: its star's place on the screen, the size of its label in full and with the name only, and how much it matters (brighter stars first). */
export interface LabelRequest {
  key: string;
  x: number;
  y: number;
  /** The radius of the star's mark: a label stays outside it. */
  radius: number;
  sizes: Array<{ w: number; h: number }>;
  priority: number;
  /** Whether the label may stand away from its star, joined to it by a line, when the places beside it are taken. Left out it may. */
  leader?: boolean;
}

export interface LabelPlace extends Rect {
  /** The index into the request's `sizes` that fitted: 0 is the full label. */
  size: number;
  /** True when the label stands away from its star: a line joins them. */
  leader: boolean;
}

const GAP = 5;
const EDGE = 3;
const PAD = 2;

const overlap = (a: Rect, b: Rect, pad = PAD): boolean => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** Whether a circle of `radius` at (x, y) touches a rectangle. */
const touches = (r: Rect, x: number, y: number, radius: number): boolean => {
  const nearestX = Math.max(r.x, Math.min(x, r.x + r.w));
  const nearestY = Math.max(r.y, Math.min(y, r.y + r.h));
  return Math.hypot(x - nearestX, y - nearestY) < radius;
};

/** The places beside a mark, in order of preference: right, left, above, below, then the corners. */
function candidates(x: number, y: number, radius: number, w: number, h: number): Rect[] {
  const r = radius + GAP;
  const d = radius * 0.7 + GAP;
  return [
    { x: x + r, y: y - h / 2, w, h },
    { x: x - r - w, y: y - h / 2, w, h },
    { x: x - w / 2, y: y - r - h, w, h },
    { x: x - w / 2, y: y + r, w, h },
    { x: x + d, y: y - d - h, w, h },
    { x: x + d, y: y + d, w, h },
    { x: x - d - w, y: y - d - h, w, h },
    { x: x - d - w, y: y + d, w, h },
  ];
}

/** Places away from the mark, up and down in rows with the star's line to them: for a crowd of stars along one line. */
function farCandidates(x: number, y: number, radius: number, w: number, h: number): Rect[] {
  const out: Rect[] = [];
  const r = radius + GAP;
  for (let row = 2; row <= 6; row += 1) {
    const lift = r + (row - 1) * (h + 4);
    for (const left of [x - w / 2, x - 10, x - w + 10]) {
      out.push({ x: left, y: y - lift - h, w, h });
      out.push({ x: left, y: y + lift, w, h });
    }
  }
  return out;
}

/**
 * Place the labels so that none overlaps another, a star's mark or the edge. The most important are placed first.
 *
 * @param requests - The labels wanted.
 * @param width - The view's width in pixels.
 * @param height - The view's height in pixels.
 * @param keepClear - Rectangles that stay empty (the view's own buttons).
 * @returns The place of every label that fitted, by key.
 */
export function placeLabels(requests: readonly LabelRequest[], width: number, height: number, keepClear: readonly Rect[] = []): Map<string, LabelPlace> {
  const placed: Array<Rect & { key: string }> = [];
  const result = new Map<string, LabelPlace>();
  const ordered = [...requests].sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
  for (const request of ordered) {
    let found: LabelPlace | undefined;
    sizes: for (let size = 0; size < request.sizes.length; size += 1) {
      const { w, h } = request.sizes[size]!;
      const near = candidates(request.x, request.y, request.radius, w, h);
      const tries = request.leader === false ? near : [...near, ...farCandidates(request.x, request.y, request.radius, w, h)];
      for (const [index, box] of tries.entries()) {
        if (box.x < EDGE || box.y < EDGE || box.x + box.w > width - EDGE || box.y + box.h > height - EDGE) continue;
        if (placed.some((one) => overlap(box, one))) continue;
        if (keepClear.some((one) => overlap(box, one, 0))) continue;
        // not over any star's mark either (including the ones whose labels come later)
        if (requests.some((other) => touches(box, other.x, other.y, other.key === request.key ? 0 : other.radius))) continue;
        found = { ...box, size, leader: index >= near.length };
        break sizes;
      }
    }
    if (found !== undefined) {
      placed.push({ ...found, key: request.key });
      result.set(request.key, found);
    }
  }
  return result;
}
