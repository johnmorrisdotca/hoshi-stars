// The days of the markers page's slider are the reader's own calendar days, a day with a clock change included.
import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, dayStart, daysBetween, windowOf } from "../demo/markers-days.ts";

test("a day starts at the reader's midnight and a range runs from the start of one day to the last moment of another", () => {
  const noon = new Date(2026, 10, 8, 12, 30).getTime();
  assert.equal(dayStart(noon), new Date(2026, 10, 8).getTime());
  const range = windowOf(noon, 1, 2, 1);
  assert.equal(range.from, new Date(2026, 10, 9).getTime());
  assert.equal(range.to, new Date(2026, 10, 11).getTime() - 1);
  assert.equal(range.fade, 1);
});

test("days are counted on the calendar, across a month and a year end", () => {
  assert.equal(daysBetween(new Date(2026, 10, 28, 23).getTime(), new Date(2026, 11, 2, 1).getTime()), 4);
  assert.equal(addDays(new Date(2026, 11, 31, 9).getTime(), 1), new Date(2027, 0, 1, 9).getTime());
  assert.equal(daysBetween(new Date(2026, 0, 1).getTime(), new Date(2026, 0, 1, 23).getTime()), 0);
});
