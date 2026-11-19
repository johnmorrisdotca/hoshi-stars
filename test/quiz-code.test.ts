// The code that puts the quiz in a page: the frame's address says what to ask and carries only what differs from the defaults, never the question.
import assert from "node:assert/strict";
import { test } from "node:test";
import { QUIZ_DEFAULTS, quizChoiceOf, quizFrameAddress, quizFrameCode, quizHeightFor, quizQuery } from "../demo/quiz-code.ts";

test("the defaults make the shortest address", () => {
  assert.equal(quizQuery(QUIZ_DEFAULTS), "");
  assert.equal(quizFrameAddress("", QUIZ_DEFAULTS), "embed-quiz.html");
});

test("only what is not a default is written, and a month waits for a latitude", () => {
  assert.equal(quizQuery({ ...QUIZ_DEFAULTS, style: "lines", level: "88", kid: true }), "style=lines&level=88&kid=1");
  assert.equal(quizQuery({ ...QUIZ_DEFAULTS, latitude: -35, month: 5, lang: "ja" }), "lat=-35&month=5&lang=ja");
  assert.equal(quizQuery({ ...QUIZ_DEFAULTS, latitude: 0, month: 2 }), "lat=0&month=2", "the equator is a latitude, not nothing");
  assert.equal(quizQuery({ ...QUIZ_DEFAULTS, month: 5 }), "", "a month with the whole sky is not written");
  assert.equal(quizFrameAddress("https://example.org/", { ...QUIZ_DEFAULTS, kid: true }), "https://example.org/embed-quiz.html?kid=1");
});

test("the choice an address says: every bad part is the default, and the question is never read", () => {
  const got = quizChoiceOf(new URLSearchParams("style=bold&level=7&kid=yes&hemisphere=west&month=99&q=60&c=Ori"));
  assert.deepEqual(got, QUIZ_DEFAULTS);
  assert.deepEqual(quizChoiceOf(new URLSearchParams("style=annotated&level=30&kid=1&hemisphere=north&month=12&lang=ja")), { style: "annotated", level: "30", kid: true, latitude: 40, month: 12, culture: "western", lang: "ja" });
  assert.equal(quizChoiceOf(new URLSearchParams("month=3")).month, 0);
});

test("the latitude of an address: lat is read in whole degrees, the old hemisphere is 40 or -40, and lat wins", () => {
  const of = (query: string) => quizChoiceOf(new URLSearchParams(query)).latitude;
  assert.equal(of("lat=49"), 49);
  assert.equal(of("lat=-34.6"), -35);
  assert.equal(of("lat=90"), 90);
  assert.equal(of("lat=-90"), -90);
  assert.equal(of("hemisphere=north"), 40);
  assert.equal(of("hemisphere=south"), -40);
  assert.equal(of("hemisphere=north&lat=-20"), -20, "lat wins");
  assert.equal(of("hemisphere=south&lat=0"), 0, "the equator wins over a hemisphere");
  assert.equal(of("lat=91"), null);
  assert.equal(of("lat=abc"), null);
  assert.equal(of("lat=91&hemisphere=south"), -40, "a bad lat is not a lat: the old hemisphere is read");
  assert.equal(of(""), null);
  assert.equal(quizChoiceOf(new URLSearchParams("hemisphere=south&month=5")).month, 5);
  assert.equal(quizQuery(quizChoiceOf(new URLSearchParams("hemisphere=north&month=1"))), "lat=40&month=1", "an old address is written back as lat");
  assert.doesNotMatch(quizQuery({ ...QUIZ_DEFAULTS, latitude: 12 }), /hemisphere/);
});

test("the culture is written when it is not the Western sky", () => {
  assert.equal(quizQuery({ ...QUIZ_DEFAULTS, culture: "chinese", level: "88" }), "level=88&culture=chinese");
  assert.equal(quizChoiceOf(new URLSearchParams("culture=japanese")).culture, "japanese");
  assert.equal(quizChoiceOf(new URLSearchParams("culture=martian")).culture, "western");
});

test("a choice goes round: its query gives the same choice back", () => {
  const choice = { style: "lines", level: "88", kid: true, latitude: -35, month: 7, culture: "chinese", lang: "ja" } as const;
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
