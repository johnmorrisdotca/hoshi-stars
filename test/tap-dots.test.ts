// The rules of the Tap the dots page: the order the dots are met in, which dot a tap meant, and what a tap does.
import assert from "node:assert/strict";
import { test } from "node:test";
import { constellations } from "../src/constellations.ts";
import { figureOf } from "../src/lines.ts";
import { DOT_LEVELS, dotsFigure } from "../src/sheets/dots.ts";
import { drawnLines, hitDot, lineVisits, nextDot, nextNumber, tapDot, visitOrder, type Progress } from "../demo/tap-dots-model.ts";

const figureFor = (c: string, level: "easy" | "medium" | "hard") => dotsFigure(c, { level, widthMm: 120, heightMm: 120 });

test("the order of the dots matches the printed numbers of every figure and level, and is the same on the hard level", () => {
  for (const c of constellations().filter((one) => figureOf(one.abbreviation).segments.length > 0)) {
    for (const level of ["easy", "medium"] as const) {
      const figure = figureFor(c.abbreviation, level);
      const order = visitOrder(figure);
      assert.equal(order.length, figure.visits, `${c.abbreviation} ${level}`);
      order.forEach((dot, i) => assert.ok(figure.dots[dot]!.numbers.includes(i + 1), `${c.abbreviation} ${level}: visit ${i + 1}`));
    }
    const hard = figureFor(c.abbreviation, "hard");
    assert.equal(visitOrder(hard).length, hard.visits);
    assert.ok(hard.dots.every((dot) => dot.numbers.length === 0));
  }
  assert.deepEqual([...DOT_LEVELS], ["easy", "medium", "hard"]);
});

test("a line that starts where the one before ended continues the stroke, a new stroke meets its first dot", () => {
  assert.deepEqual(visitOrder({ lines: [[0, 1], [1, 2], [5, 6], [6, 7]] }), [0, 1, 2, 5, 6, 7]);
  assert.deepEqual(lineVisits([[0, 1], [1, 2], [5, 6], [6, 7]]), [2, 3, 5, 6]);
  assert.deepEqual(visitOrder({ lines: [] }), []);
});

test("a right tap advances, a wrong tap does not, and the last right tap finishes", () => {
  const order = [3, 1, 2];
  let progress: Progress = { done: 0, wrong: 0 };
  assert.equal(nextDot(order, progress), 3);
  assert.equal(nextNumber(order, progress), 1);
  let step = tapDot(order, progress, 1);
  assert.equal(step.result, "wrong");
  assert.deepEqual(step.progress, { done: 0, wrong: 1 });
  progress = step.progress;
  step = tapDot(order, progress, null);
  assert.equal(step.result, "ignored");
  assert.deepEqual(step.progress, progress);
  step = tapDot(order, progress, 3);
  assert.equal(step.result, "right");
  progress = step.progress;
  assert.deepEqual(progress, { done: 1, wrong: 1 });
  progress = tapDot(order, progress, 1).progress;
  step = tapDot(order, progress, 2);
  assert.equal(step.result, "finished");
  assert.equal(nextDot(order, step.progress), null);
  assert.equal(nextNumber(order, step.progress), null);
  assert.equal(tapDot(order, step.progress, 2).result, "ignored");
});

test("the lines drawn follow the visits joined, and none is drawn across a lifted pencil", () => {
  const lines: [number, number][] = [[0, 1], [1, 2], [5, 6]];
  assert.deepEqual(drawnLines(lines, { done: 0, wrong: 0 }), []);
  assert.deepEqual(drawnLines(lines, { done: 1, wrong: 0 }), []);
  assert.deepEqual(drawnLines(lines, { done: 2, wrong: 0 }), [[0, 1]]);
  assert.deepEqual(drawnLines(lines, { done: 3, wrong: 0 }), [[0, 1], [1, 2]]);
  assert.deepEqual(drawnLines(lines, { done: 4, wrong: 0 }), [[0, 1], [1, 2]]);
  assert.equal(drawnLines(lines, { done: 5, wrong: 0 }).length, 3);
  const orion = figureFor("Ori", "medium");
  assert.equal(drawnLines(orion.lines, { done: orion.visits, wrong: 0 }).length, orion.lines.length);
});

test("a tap meant the nearest dot within a finger's reach, and none when it is far from all", () => {
  const places = [{ x: 10, y: 10, r: 1 }, { x: 14, y: 10, r: 1 }, { x: 60, y: 60, r: 4 }];
  assert.equal(hitDot(places, 11, 10, 6), 0);
  assert.equal(hitDot(places, 13, 10, 6), 1);
  assert.equal(hitDot(places, 40, 40, 6), null);
  assert.equal(hitDot(places, 63, 60, 1), 2);
  assert.equal(hitDot([], 0, 0, 6), null);
});
