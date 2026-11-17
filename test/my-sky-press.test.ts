// A press on "my sky": a planet is picked by its dot and by its name before a page's mark beside it, its reach is no smaller than a mark's, and two planets close together write their names apart.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { DrawnBody } from "../src/my-sky/draw.ts";
import { MARK_REACH, nameSpot, PLANET_REACH, pickBody, type Box } from "../src/my-sky/reach.ts";

const overlap = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

test("a press on a planet's dot picks the planet even with a satellite mark nearer to the press", () => {
  const bodies: DrawnBody[] = [
    { kind: "planet", id: "mars", x: 100, y: 100, r: 18, name: { x0: 110, y0: 93, x1: 140, y1: 107 } },
    { kind: "mark", id: "sat", x: 108, y: 100, r: 18 },
  ];
  assert.equal(pickBody(bodies, 106, 100)?.id, "mars");
  assert.equal(pickBody(bodies, 100, 100)?.id, "mars");
});

test("a press on a planet's name picks the planet, even where a mark's reach holds it", () => {
  const bodies: DrawnBody[] = [
    { kind: "planet", id: "jupiter", x: 100, y: 100, r: 18, name: { x0: 110, y0: 93, x1: 150, y1: 107 } },
    { kind: "mark", id: "sat", x: 140, y: 100, r: 18 },
  ];
  assert.equal(pickBody(bodies, 146, 100)?.id, "jupiter");
});

test("a planet reaches as far as a mark does, and a press beyond every reach picks nothing", () => {
  assert.ok(PLANET_REACH >= MARK_REACH);
  const planet: DrawnBody = { kind: "planet", id: "venus", x: 100, y: 100, r: PLANET_REACH };
  const mark: DrawnBody = { kind: "mark", id: "sat", x: 300, y: 100, r: MARK_REACH };
  assert.equal(pickBody([planet], 117, 100)?.id, "venus");
  assert.equal(pickBody([mark], 317, 100)?.id, "sat");
  assert.equal(pickBody([planet, mark], 200, 100), undefined);
  assert.equal(pickBody([{ kind: "target", id: "target", x: 100, y: 100, r: 12 }], 100, 100), undefined);
});

test("a mark away from every planet is still picked, and the nearer of two marks wins", () => {
  const bodies: DrawnBody[] = [
    { kind: "planet", id: "mars", x: 100, y: 100, r: 18 },
    { kind: "mark", id: "far", x: 200, y: 100, r: 18 },
    { kind: "mark", id: "near", x: 190, y: 100, r: 18 },
  ];
  assert.equal(pickBody(bodies, 192, 100)?.id, "near");
});

test("two planets close together write their names apart, and a name never covers another planet's dot", () => {
  const taken: Box[] = [];
  const mars = { x: 100, y: 100 };
  const jupiter = { x: 128, y: 104 };
  taken.push({ x0: mars.x - 3, y0: mars.y - 3, x1: mars.x + 3, y1: mars.y + 3 }, { x0: jupiter.x - 6, y0: jupiter.y - 6, x1: jupiter.x + 6, y1: jupiter.y + 6 });
  const first = nameSpot(taken, mars.x, mars.y, 3, 34);
  const second = nameSpot(taken, jupiter.x, jupiter.y, 6, 44);
  assert.equal(overlap(first.box, second.box), false);
  assert.equal(overlap(first.box, taken[1]!), false);
  assert.equal(overlap(second.box, taken[0]!), false);
});

test("a planet alone writes its name to the right of its dot", () => {
  const spot = nameSpot([], 100, 100, 4, 40);
  assert.equal(spot.align, "left");
  assert.equal(spot.x, 109);
  assert.equal(spot.y, 104);
});
