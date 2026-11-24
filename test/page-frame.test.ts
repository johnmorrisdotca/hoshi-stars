// The build puts kazoku-ui's page frame into every demo page. The checker's comment is only the marker the build replaces.
import assert from "node:assert/strict";
import { test } from "node:test";
import { frameFile, renderIndex, renderKids } from "../scripts/page.ts";

test("the home page says what it is and credits its data", () => {
  const html = renderIndex();
  assert.match(html, /<kazoku-page-header/);
  assert.match(html, /<kazoku-page-credits/);
  assert.doesNotMatch(html, /<!--frame:/);
});

test("a page that already has Japanese words uses them in the frame", () => {
  assert.match(renderKids(), /印刷するシート/);
});

test("an embed credits its data and a named embed that is not the bare frame still says what it is", () => {
  const bare = frameFile("embed.html", true);
  assert.match(bare, /<kazoku-page-credits/);
  assert.doesNotMatch(bare, /<kazoku-page-header/);
  assert.match(frameFile("embed-layers.html"), /<kazoku-page-header/);
  const quiz = frameFile("embed-quiz.html", true);
  assert.match(quiz, /<kazoku-page-credits[^>]*\sembed[\s>]/);
  assert.doesNotMatch(quiz, /<kazoku-page-header/);
});
