import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { kidsFrameAddress, type KidsFrame } from "../demo/kids-address.ts";

const sheet: KidsFrame = { kind: "map", level: "easy", which: "Ori", country: "CA", region: "BC", lat: 49.3, month: 11, paper: "letter", type: "kid", form: "pages" };

test("an embedded sheet carries the sheet, the place, the latitude, the month and the paper", () => {
  const url = new URL(kidsFrameAddress(sheet));
  assert.equal(url.pathname, "/hoshi-stars/kids.html");
  assert.equal(url.searchParams.get("kind"), "map");
  assert.equal(url.searchParams.get("c"), "Ori");
  assert.equal(url.searchParams.get("country"), "CA");
  assert.equal(url.searchParams.get("region"), "BC");
  assert.equal(url.searchParams.get("lat"), "49.3");
  assert.equal(url.searchParams.get("month"), "11");
  assert.equal(url.searchParams.get("paper"), "letter");
  assert.equal(url.searchParams.get("type"), "kid");
  const dropped = new URL(kidsFrameAddress({ ...sheet, lat: null, country: "", region: "" }));
  assert.equal(dropped.searchParams.get("lat"), null);
  assert.equal(dropped.searchParams.get("country"), "");
});

test("the sheets page offers the embed panel", () => {
  const html = readFileSync(new URL("../demo/kids.html", import.meta.url), "utf8");
  assert.match(html, /id="embed-panel"/);
});
