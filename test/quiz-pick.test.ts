// The quiz's wrong names: five, never the answer, no one twice, the neighbours first and then the same origin; a small pool gives what it has.
import assert from "node:assert/strict";
import { test } from "node:test";
import { distractors, shuffled } from "../demo/quiz-pick.ts";
import { constellationFacts } from "../src/constellation-facts.ts";
import { constellations } from "../src/constellations.ts";
import { neighbouringConstellations } from "../src/nearest.ts";

const ALL = constellations().map((c) => c.abbreviation);
/** A seeded generator, so a run is the same every time. */
const seeded = (seed: number): (() => number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

test("five wrong names for every one of the 88, never the answer and no one twice", () => {
  for (const answer of ALL) {
    const got = distractors(answer, ALL, 5, seeded(answer.charCodeAt(0)));
    assert.equal(got.length, 5, answer);
    assert.equal(new Set(got).size, 5, `${answer} has a name twice`);
    assert.ok(!got.includes(answer), `${answer} is its own wrong name`);
    for (const one of got) assert.ok(ALL.includes(one));
  }
});

test("the neighbours come first (three at most), then the same origin, so the wrong names are the ones easy to mix up", () => {
  for (const answer of ALL) {
    const near = new Set(neighbouringConstellations(answer).map((c) => c.abbreviation));
    const origin = constellationFacts(answer).origin;
    const got = distractors(answer, ALL, 5, seeded(7));
    const first = Math.min(3, near.size);
    const family = ALL.filter((one) => one !== answer && !near.has(one) && constellationFacts(one).origin === origin).length;
    const fromFamily = got.filter((one) => !near.has(one) && constellationFacts(one).origin === origin).length;
    assert.equal(fromFamily, Math.min(5 - first, family), `${answer}: then its family`);
    assert.equal(got.filter((one) => near.has(one)).length, first + Math.min(5 - first - fromFamily, near.size - first), `${answer}: its neighbours lead`);
  }
});

test("Orion's wrong names are mostly the sky around it: Taurus, Gemini, Lepus, Monoceros or Eridanus", () => {
  const near = new Set(["Eri", "Gem", "Lep", "Mon", "Tau"]);
  for (let seed = 1; seed <= 20; seed += 1) assert.ok(distractors("Ori", ALL, 5, seeded(seed)).filter((one) => near.has(one)).length >= 3);
});

test("it only picks from the pool, and a pool of fewer than the count gives what it has", () => {
  const pool = ["Ori", "Tau", "Cru", "UMa"];
  const got = distractors("Ori", pool, 5, seeded(3));
  assert.deepEqual([...got].sort(), ["Cru", "Tau", "UMa"]);
  assert.deepEqual(distractors("Ori", ["Ori"], 5), []);
});

test("it is random: different numbers give different wrong names, and shuffled keeps every item", () => {
  const seen = new Set(Array.from({ length: 12 }, (_, i) => distractors("Cru", ALL, 5, seeded(i + 1)).join()));
  assert.ok(seen.size > 3);
  assert.deepEqual([...shuffled([1, 2, 3, 4, 5], seeded(9))].sort(), [1, 2, 3, 4, 5]);
});
