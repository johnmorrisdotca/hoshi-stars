// The text that puts the quiz in a page: it is a page that runs, not a drawing of numbers, so it goes in an iframe (`embed-quiz.html`). The address of the frame says what to ask; nothing about the answer is in it.
import { embedSnippet } from "@johnmorrisdotca/kazoku-ui/embed-panel";

declare const __HOSHI_VERSION__: string | undefined;

const PACKAGE = "@johnmorrisdotca/hoshi-stars";
const SITE = "https://johnmorrisdotca.github.io/hoshi-stars/";
const cdn = (): string => `https://cdn.jsdelivr.net/npm/${PACKAGE}@${typeof __HOSHI_VERSION__ === "string" ? __HOSHI_VERSION__ : "latest"}`;

/** What the quiz is as a handful of choices: how it looks, how many constellations, kid mode, which sky, and the language. */
export interface QuizChoice {
  style: "plain" | "lines" | "annotated";
  level: "12" | "30" | "88";
  kid: boolean;
  hemisphere: "all" | "north" | "south";
  /** 1 to 12, or 0 for any month. */
  month: number;
  lang: "en" | "ja";
}

export const QUIZ_DEFAULTS: QuizChoice = { style: "plain", level: "12", kid: false, hemisphere: "all", month: 0, lang: "en" };

/** The choice an address says, with every missing or bad part at its default. */
export function quizChoiceOf(query: URLSearchParams): QuizChoice {
  const pick = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => (allowed.includes(query.get(name) as T) ? (query.get(name) as T) : fallback);
  const hemisphere = pick("hemisphere", ["all", "north", "south"] as const, "all");
  const month = Math.round(Number(query.get("month")) || 0);
  return {
    style: pick("style", ["plain", "lines", "annotated"] as const, "plain"),
    level: pick("level", ["12", "30", "88"] as const, "12"),
    kid: query.get("kid") === "1",
    hemisphere,
    month: hemisphere === "all" || month < 1 || month > 12 ? 0 : month,
    lang: query.get("lang") === "ja" ? "ja" : "en",
  };
}

/** The query of the embed page for a choice: only what differs from the defaults. */
export function quizQuery(choice: QuizChoice): string {
  const query = new URLSearchParams();
  if (choice.style !== "plain") query.set("style", choice.style);
  if (choice.level !== "12") query.set("level", choice.level);
  if (choice.kid) query.set("kid", "1");
  if (choice.hemisphere !== "all") query.set("hemisphere", choice.hemisphere);
  if (choice.hemisphere !== "all" && choice.month > 0) query.set("month", String(choice.month));
  if (choice.lang === "ja") query.set("lang", "ja");
  return query.toString();
}

/** The address of the embed page for a choice: `embed-quiz.html` after `base`, with a query only when something is not a default. */
export const quizFrameAddress = (base: string, choice: QuizChoice): string => `${base}embed-quiz.html${quizQuery(choice) === "" ? "" : `?${quizQuery(choice)}`}`;

/** How tall the frame is for a width, so the chart, the six names, the answer and the score fit: a square chart and two columns of names on a narrow frame, a wide chart and three columns on a wide one. */
export const quizHeightFor = (width: number): number => (width < 600 ? Math.round(width + 360) : Math.round(width * 0.6 + 320));

/** The `iframe` code at the size chosen. `preview` makes the address relative so the demo's own picture works; the copied code names the published demo. */
export function quizFrameCode(choice: QuizChoice, title: string, width: number, preview: boolean): string {
  return embedSnippet("iframe", { package: PACKAGE, cdn: cdn(), tag: "hoshi-quiz", element: "", entries: [], attrs: [], name: "quiz", iframe: { src: quizFrameAddress(preview ? "" : SITE, choice), title, width, height: quizHeightFor(width) } });
}
