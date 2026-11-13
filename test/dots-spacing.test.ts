// Connect-the-dots sheets are easy to follow: on every sheet of every constellation, at every level, type and paper, no two dots touch, no number touches a dot, a line of the answer or another number, a dot is never
// bigger than a third of the distance to its nearest neighbour (down to a floor that still prints), and the answer's lines are about 1 mm.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGE_NAMES, printableSize } from "@johnmorrisdotca/kazoku-ui/print";
import { constellations } from "../src/constellations.ts";
import { figureOf } from "../src/lines.ts";
import { TYPES, textWidth } from "../src/sheets/common.ts";
import { DOT_LEVELS, DOT_LIMITS, dotsSvg } from "../src/sheets/dots.ts";

const dottable = constellations().filter((c) => figureOf(c.abbreviation).segments.length > 0).map((c) => c.abbreviation);
interface Circle { x: number; y: number; r: number }
interface Rect { x0: number; y0: number; x1: number; y1: number }
const num = (tag: string, name: string): number => Number(new RegExp(`${name}="(-?[\\d.]+)"`).exec(tag)![1]);

function read(svg: string, size: number) {
  const dots = [...svg.matchAll(/<circle [^>]*data-dot="[^"]*"[^>]*\/>/g)].map((m): Circle => ({ x: num(m[0], "cx"), y: num(m[0], "cy"), r: num(m[0], "r") }));
  const rings = [...svg.matchAll(/<circle [^>]*data-ring=""[^>]*\/>/g)].map((m): Circle => ({ x: num(m[0], "cx"), y: num(m[0], "cy"), r: num(m[0], "r") }));
  const lines = [...svg.matchAll(/<line [^>]*data-line=""[^>]*\/>/g)].map((m) => ({ a: { x: num(m[0], "x1"), y: num(m[0], "y1") }, b: { x: num(m[0], "x2"), y: num(m[0], "y2") }, width: num(m[0], "stroke-width") }));
  const labels = [...svg.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)" font-size="([\d.]+)"[^>]*data-number="\d+"[^>]*>([^<]*)<\/text>/g)].map((m): Rect => {
    const w = textWidth(m[4]!, size);
    return { x0: Number(m[1]) - w / 2, x1: Number(m[1]) + w / 2, y0: Number(m[2]) - size * 0.95, y1: Number(m[2]) + size * 0.25 };
  });
  return { dots, rings, lines, labels };
}
const distanceToRect = (p: { x: number; y: number }, r: Rect): number => Math.hypot(p.x - Math.max(r.x0, Math.min(p.x, r.x1)), p.y - Math.max(r.y0, Math.min(p.y, r.y1)));
function segmentToRect(a: { x: number; y: number }, b: { x: number; y: number }, r: Rect): number {
  let best = Infinity;
  for (let k = 0; k <= 200; k += 1) best = Math.min(best, distanceToRect({ x: a.x + ((b.x - a.x) * k) / 200, y: a.y + ((b.y - a.y) * k) / 200 }, r));
  return best;
}
const apart = (a: Rect, b: Rect): boolean => a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0;

for (const type of ["kid", "normal"] as const) {
  test(`${type}: no two dots, numbers or lines touch, and every dot is within a third of its neighbour's distance, at every level and paper`, () => {
    const problems: string[] = [];
    for (const page of PAGE_NAMES) {
      const size = printableSize(page, "portrait");
      const room = { widthMm: size.widthMm, heightMm: size.heightMm - 89 };
      for (const abbreviation of dottable) {
        for (const level of DOT_LEVELS) {
          for (const answer of [false, true]) {
            if (answer && level === "hard") continue;
            const what = `${type} ${page} ${abbreviation} ${level}${answer ? " answer" : ""}`;
            const { dots, rings, lines, labels } = read(dotsSvg(abbreviation, { level, ...room, lang: "en", type, answer }), TYPES[type].bodyMm);
            const limits = DOT_LIMITS[type];
            dots.forEach((a, i) => {
              if (a.r < limits.floor - 1e-6 || a.r > limits.ceiling + 1e-6) problems.push(`${what}: a dot is ${a.r} mm, outside ${limits.floor} to ${limits.ceiling}`);
              const nearest = Math.min(...dots.filter((_, j) => j !== i).map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
              if (a.r > Math.max(limits.floor, nearest / 3) + 0.011) problems.push(`${what}: a dot of ${a.r} mm has a neighbour ${nearest.toFixed(1)} mm away`);
              dots.slice(i + 1).forEach((b) => {
                if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 0.3) problems.push(`${what}: two dots touch`);
              });
            });
            if (level === "hard") continue;
            labels.forEach((l, i) => {
              for (const d of [...dots, ...rings]) if (distanceToRect(d, l) < d.r + 0.1) problems.push(`${what}: a number at ${l.x0.toFixed(1)},${l.y0.toFixed(1)} touches a dot or a ring at ${d.x.toFixed(1)},${d.y.toFixed(1)} r ${d.r.toFixed(1)}`);
              labels.slice(i + 1).forEach((m) => {
                if (!apart(l, m)) problems.push(`${what}: two numbers touch at ${l.x0.toFixed(1)},${l.y0.toFixed(1)}`);
              });
              if (answer) for (const line of lines) if (segmentToRect(line.a, line.b, l) < line.width / 2 + 0.1) problems.push(`${what}: a number at ${l.x0.toFixed(1)},${l.y0.toFixed(1)} touches a line`);
            });
            if (answer) for (const line of lines) if (line.width > 1.0 + 1e-6 || line.width < 0.4) problems.push(`${what}: a line is ${line.width} mm thick`);
          }
        }
      }
    }
    assert.deepEqual(problems.slice(0, 15), [], `${problems.length} problems`);
  });
}
