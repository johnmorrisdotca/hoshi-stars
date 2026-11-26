// Back or forward on the sky-by-distance page refreshes the copied code after the redraw (MODULES-1031). A write from the page itself does not.
import assert from "node:assert/strict";
import { test } from "node:test";
import { followDistanceAddress } from "../demo/layers-address.ts";

test("back or forward redraws and then refreshes the copied code", () => {
  const order: string[] = [];
  followDistanceAddress("navigation", () => order.push("redraw"), () => order.push("codes"));
  assert.deepEqual(order, ["redraw", "codes"]);
});

test("a write from this page leaves the sky and the copied code alone", () => {
  const order: string[] = [];
  followDistanceAddress("write", () => order.push("redraw"), () => order.push("codes"));
  assert.deepEqual(order, []);
});
