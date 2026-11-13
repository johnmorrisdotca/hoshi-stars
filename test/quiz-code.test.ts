// The code that puts the quiz in a page: the frame's address says what to ask and carries only what differs from the defaults, never the question.
import assert from "node:assert/strict";
import { test } from "node:test";
import { QUIZ_DEFAULTS, quizChoiceOf, quizFrameAddress, quizFrameCode, quizHeightFor, quizQuery } from "../demo/quiz-code.ts";

test("the defaults make the shortest address", () => {
  assert.equal(quizQuery(QUIZ_DEFAULTS), "");
  assert.equal(quizFrameAddress("", QUIZ_DEFAULTS), "embed-quiz.html");
});

test("only what is not a default is written, and a month waits for a hemisphere", () => {
  assert.equal(quizQuery({ ...QUIZ_DEFAULTS, style: "lines", level: "88", kid: true }), "style=lines&level=88&kid=1");
  assert.equal(quizQuery({ ...QUIZ_DEFAULTS, hemisphere: "south", month: 5, lang: "ja" }), "hemisphere=south&month=5&lang=ja");
  assert.equal(quizQuery({ ...QUIZ_DEFAULTS, month: 5 }), "", "a month with the whole sky is not written");
  assert.equal(quizFrameAddress("https://example.org/", { ...QUIZ_DEFAULTS, kid: true }), "https://example.org/embed-quiz.html?kid=1");
});

test("the choice an address says: every bad part is the default, and the question is never read", () => {
  const got = quizChoiceOf(new URLSearchParams("style=bold&level=7&kid=yes&hemisphere=west&month=99&q=60&c=Ori"));
  assert.deepEqual(got, QUIZ_DEFAULTS);
  assert.deepEqual(quizChoiceOf(new URLSearchParams("style=annotated&level=30&kid=1&hemisphere=north&month=12&lang=ja")), { style: "annotated", level: "30", kid: true, hemisphere: "north", month: 12, culture: "western", lang: "ja" });
  assert.equal(quizChoiceOf(new URLSearchParams("month=3")).month, 0);
});

test("the culture is written when it is not the Western sky", () => {
  assert.equal(quizQuery({ ...QUIZ_DEFAULTS, culture: "chinese", level: "88" }), "level=88&culture=chinese");
  assert.equal(quizChoiceOf(new URLSearchParams("culture=japanese")).culture, "japanese");
  assert.equal(quizChoiceOf(new URLSearchParams("culture=martian")).culture, "western");
});

test("a choice goes round: its query gives the same choice back", () => {
  const choice = { style: "lines", level: "88", kid: true, hemisphere: "south", month: 7, culture: "chinese", lang: "ja" } as const;
  assert.deepEqual(quizChoiceOf(new URLSearchParams(quizQuery(choice))), choice);
});

test("the iframe code names the published page and the height fits the width", () => {
  const code = quizFrameCode({ ...QUIZ_DEFAULTS, kid: true }, "A constellation quiz", 480, false);
  assert.match(code, /johnmorrisdotca\.github\.io\/hoshi-stars\/embed-quiz\.html\?kid=1/);
  assert.match(code, /width="480"/);
  assert.match(code, new RegExp(`height="${quizHeightFor(480)}"`));
  assert.doesNotMatch(quizFrameCode(QUIZ_DEFAULTS, "x", 320, true), /hoshi-stars\//, "the demo's own preview is relative");
  assert.ok(quizHeightFor(640) > quizHeightFor(320) - 200);
});
