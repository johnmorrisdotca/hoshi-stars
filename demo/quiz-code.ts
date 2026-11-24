// The text that puts the quiz in a page: it is a page that runs, not a drawing of numbers, so it goes in an iframe (`embed-quiz.html`). The address of the frame says what to ask; nothing about the answer is in it.
import { embedSnippet } from "@johnmorrisdotca/kazoku-ui/embed-panel";
import { askedLatitude } from "./quiz-sky.ts";

declare const __HOSHI_VERSION__: string | undefined;

const PACKAGE = "@johnmorrisdotca/hoshi-stars";
const SITE = "https://johnmorrisdotca.github.io/hoshi-stars/";
const cdn = (): string => `https://cdn.jsdelivr.net/npm/${PACKAGE}@${typeof __HOSHI_VERSION__ === "string" ? __HOSHI_VERSION__ : "latest"}`;

/** Whether text is a level of some sky: the bright 12, 30 or all, or (Chinese) an enclosure or a tranche of star officials. Whether the sky has it is for the page to say; a level it lacks becomes all. */
const isLevel = (text: string | null): text is string => text !== null && /^(12|30|88|purple-forbidden|heavenly-market|officials-[1-9][0-9]?)$/.test(text);

/** What the quiz is as a handful of choices: how it looks, how many constellations, kid mode, which sky, and the language. */
export interface QuizChoice {
  style: "plain" | "lines" | "annotated";
  level: string;
  kid: boolean;
  /** The latitude asked, a whole number of degrees from -90 to 90 (north positive), or `null` for the whole sky. The reader's own position is never in it: only a latitude typed (or an old `hemisphere`). */
  latitude: number | null;
  /** 1 to 12, or 0 for any month. */
  month: number;
  /** The sky culture: the Western 88, the Japanese sky, or the Chinese mansions. */
  culture: "western" | "japanese" | "chinese";
  lang: "en" | "ja";
}

export const QUIZ_DEFAULTS: QuizChoice = { style: "plain", level: "12", kid: false, latitude: null, month: 0, culture: "western", lang: "en" };

/** The choice an address says, with every missing or bad part at its default. */
export function quizChoiceOf(query: URLSearchParams): QuizChoice {
  const pick = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => (allowed.includes(query.get(name) as T) ? (query.get(name) as T) : fallback);
  const latitude = askedLatitude(query.get("lat"), query.get("hemisphere"));
  const month = Math.round(Number(query.get("month")) || 0);
  return {
    style: pick("style", ["plain", "lines", "annotated"] as const, "plain"),
    level: isLevel(query.get("level")) ? query.get("level")! : "12",
    kid: query.get("kid") === "1",
    latitude,
    month: latitude === null || month < 1 || month > 12 ? 0 : month,
    culture: pick("culture", ["western", "japanese", "chinese"] as const, "western"),
    lang: query.get("lang") === "ja" ? "ja" : "en",
  };
}

/** The query of the embed page for a choice: only what differs from the defaults. */
export function quizQuery(choice: QuizChoice): string {
  const query = new URLSearchParams();
  if (choice.style !== "plain") query.set("style", choice.style);
  if (choice.level !== "12") query.set("level", choice.level);
  if (choice.kid) query.set("kid", "1");
  if (choice.latitude !== null) query.set("lat", String(choice.latitude));
  if (choice.latitude !== null && choice.month > 0) query.set("month", String(choice.month));
  if (choice.culture !== "western") query.set("culture", choice.culture);
  if (choice.lang === "ja") query.set("lang", "ja");
  return query.toString();
}

/** The address of the embed page for a choice: `embed-quiz.html` after `base`, with a query only when something is not a default. */
export const quizFrameAddress = (base: string, choice: QuizChoice): string => `${base}embed-quiz.html${quizQuery(choice) === "" ? "" : `?${quizQuery(choice)}`}`;

/** How tall the frame is for a width, so the chart, the six names, the answer, the score, a miss with its picture and the credit line fit: a square chart and two columns of names on a narrow frame, a wide chart and three columns on a wide one. The credit wraps, so a narrow frame allows more for it. */
export const quizHeightFor = (width: number): number => {
  const chart = width < 600 ? Math.round(width + 480) : Math.round(width * 0.6 + 430);
  const credit = width < 400 ? 120 : width < 600 ? 80 : 64;
  return chart + credit;
};

/** The `iframe` code at the size chosen. `preview` makes the address relative so the demo's own picture works; the copied code names the published demo. */
export function quizFrameCode(choice: QuizChoice, title: string, width: number, preview: boolean): string {
  return embedSnippet("iframe", { package: PACKAGE, cdn: cdn(), tag: "hoshi-quiz", element: "", entries: [], attrs: [], name: "quiz", iframe: { src: quizFrameAddress(preview ? "" : SITE, choice), title, width, height: quizHeightFor(width) } });
}
