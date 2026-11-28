// The sky clock: an hour a second, a day a second, and backward.
import assert from "node:assert/strict";
import { test } from "node:test";
import { skyMoment } from "../demo/sky-clock.ts";

const start = Date.UTC(2026, 10, 8, 10);

test("an hour a second, a day a second, and backward", () => {
  assert.equal(skyMoment(start, 1000, 3600), start + 3_600_000);
  assert.equal(skyMoment(start, 1000, 86400), start + 86_400_000);
  assert.equal(skyMoment(start, 1000, -3600), start - 3_600_000);
  assert.equal(skyMoment(start, 0, 3600), start);
});
