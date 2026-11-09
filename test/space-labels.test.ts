// The labels of the constellation in 3D: the first free place beside the star, never over another label, a star or the edge; the name alone when the full label does not fit; nothing when nothing fits.
import assert from "node:assert/strict";
import { test } from "node:test";
import { placeLabels, type LabelRequest } from "../demo/space-labels.ts";

const request = (key: string, x: number, y: number, priority = 1, sizes = [{ w: 80, h: 30 }, { w: 50, h: 14 }]): LabelRequest => ({ key, x, y, radius: 6, sizes, priority });
const overlapping = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("a lone label goes to the right of its star", () => {
  const placed = placeLabels([request("a", 100, 100)], 400, 300);
  const a = placed.get("a")!;
  assert.equal(a.size, 0);
  assert.ok(a.x > 100 && a.y < 100 && a.y + a.h > 100);
});

test("no label overlaps another, a star's mark or the edge, over a crowd of stars", () => {
  const requests: LabelRequest[] = [];
  for (let i = 0; i < 40; i += 1) requests.push(request(`s${i}`, 20 + ((i * 97) % 360), 15 + ((i * 53) % 270), 100 - i));
  const placed = placeLabels(requests, 400, 300);
  const boxes = [...placed.entries()];
  assert.ok(boxes.length > 8, "some of them fit");
  for (const [key, a] of boxes) {
    assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= 400 && a.y + a.h <= 300, key);
    for (const [other, b] of boxes) if (key < other) assert.equal(overlapping(a, b), false, `${key} and ${other}`);
    for (const r of requests) assert.ok(r.key === key || Math.hypot(Math.max(a.x, Math.min(r.x, a.x + a.w)) - r.x, Math.max(a.y, Math.min(r.y, a.y + a.h)) - r.y) >= r.radius, `${key} over the mark of ${r.key}`);
  }
});

test("the more important label keeps its place and the other moves", () => {
  const placed = placeLabels([request("low", 100, 100, 1), request("high", 100, 100.5, 9)], 400, 300);
  assert.equal(placed.get("high")!.x > 100, true);
  assert.equal(placed.has("low") ? overlapping(placed.get("low")!, placed.get("high")!) : false, false);
});

test("a label that does not fit in full is placed with its name alone, and one that fits nowhere is left out", () => {
  const tight = placeLabels([request("a", 30, 150, 1, [{ w: 300, h: 30 }, { w: 40, h: 12 }])], 120, 300);
  assert.equal(tight.get("a")!.size, 1);
  const none = placeLabels([request("a", 30, 150, 1, [{ w: 300, h: 30 }, { w: 200, h: 12 }])], 120, 300);
  assert.equal(none.has("a"), false);
});

test("the view's own buttons are kept clear", () => {
  const clear = [{ x: 110, y: 80, w: 100, h: 60 }];
  const placed = placeLabels([request("a", 100, 100)], 400, 300, clear);
  assert.equal(overlapping(placed.get("a")!, clear[0]!), false);
});

test("a row of stars along one line gets its labels in rows above and below, joined to their stars by a line", () => {
  const requests: LabelRequest[] = [];
  for (let i = 0; i < 9; i += 1) requests.push(request(`s${i}`, 40 + i * 22, 150, 100 - i, [{ w: 90, h: 30 }, { w: 60, h: 14 }]));
  const placed = placeLabels(requests, 400, 300);
  assert.ok(placed.size >= 7, `${placed.size} of 9 fit`);
  assert.ok([...placed.values()].some((one) => one.leader), "some stand away from their star");
  const boxes = [...placed.values()];
  for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) assert.equal(overlapping(a, b), false);
});

test("a label that must stay beside its mark never takes a leader", () => {
  const crowd = [request("a", 100, 100, 9), { ...request("b", 100, 100, 1), leader: false }];
  const placed = placeLabels(crowd, 400, 300);
  assert.ok(!placed.has("b") || !placed.get("b")!.leader);
});
