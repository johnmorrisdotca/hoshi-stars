// The constellation quiz: a chart centred on one constellation with no name for it on the chart, and six names to choose from. The style (plain stars, stars and lines, annotated: the lines, the borders and the names of the neighbours) and the level (the bright 12, 30 or all 88) are kept in
// the address (style, level, kid, hemisphere, month), and so is the question (q, the constellation's place in the list of the 88, never its name; a hand-written c=Ori is read too), so a reload or a shared link asks the same one. The chart is the package's own SVG drawn once for each question and nothing moves by itself: nothing is drawn at rest.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { centreOfConstellation, chart, toScreen, type View } from "../src/chart/chart.ts";
import { constellation, constellations, starsIn, type Constellation } from "../src/constellations.ts";
import { neighbouringConstellations } from "../src/nearest.ts";
import { figureOf } from "../src/lines.ts";
import { frameCredit } from "./frame-credit.ts";
import { langNow, lookNow, nameIn, thumbSrc } from "./thumbs.ts";
import { ALL_WORDS } from "../scripts/gallery-words.ts";
import { distractors, shuffled } from "./quiz-pick.ts";
import { HEMISPHERES, MIN_ALTITUDE, seenIn, type Hemisphere } from "./quiz-sky.ts";
import { monthName, say } from "./words.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
/** The embed page (`embed-quiz.html`) is this same script with its controls hidden: the address chooses (style, level, kid, hemisphere, month, lang) and nothing is written back to it. */
const embedded = document.body.dataset["embed"] === "quiz";
if (embedded && new URLSearchParams(location.search).get("lang") === "ja") document.documentElement.lang = "ja";
const real = createAddressState();
const address = { get: (name: string): string | null => real.get(name), set: (name: string, value: string | null): void => (embedded ? undefined : real.set(name, value)), flush: (): void => (embedded ? undefined : real.flush()) };
if (embedded) frameCredit(document.documentElement.lang === "ja");

const STYLES = ["plain", "lines", "annotated"] as const;
type Style = (typeof STYLES)[number];
const STYLE_WORDS: Record<Style, string> = { plain: "plain", lines: "lines", annotated: "annotated" };
const LEVELS = ["12", "30", "88"] as const;
type Level = (typeof LEVELS)[number];
const CHOICES = 6;

const pick = <T extends string>(text: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(text as T) ? (text as T) : fallback);

/** How bright a constellation's figure is: the light of its stars added up (a magnitude 1 star is 2.5 times a magnitude 2). The brightest come first. */
function brightest(): string[] {
  const light = (abbreviation: string): number => {
    const figure = figureOf(abbreviation).stars;
    const stars = figure.length > 0 ? figure : starsIn(abbreviation).filter((star) => star.magnitude < 5);
    return stars.reduce((sum, star) => sum + 10 ** (-0.4 * star.magnitude), 0);
  };
  return constellations().map((c) => ({ abbreviation: c.abbreviation, light: light(c.abbreviation) })).sort((a, b) => b.light - a.light || a.abbreviation.localeCompare(b.abbreviation)).map((c) => c.abbreviation);
}
const ranked = brightest();
/** The hemisphere asked ("all" is the whole sky) and the month (0 is any), kept in the address as `hemisphere` and `month`. */
type Where = Hemisphere | "all";
const WHERE: readonly Where[] = ["all", ...HEMISPHERES];
/** The constellations of the level: those a reader in the hemisphere can see (in the month, or in any month), the brightest first, as many as the level says. */
function poolOf(level: Level): string[] {
  let seen: Set<string> | undefined;
  if (where !== "all") seen = new Set(month > 0 ? seenIn(where, month) : Array.from({ length: 12 }, (_, i) => seenIn(where as Hemisphere, i + 1)).flat());
  return ranked.filter((one) => seen === undefined || seen.has(one)).slice(0, Number(level));
}

let style: Style = pick(address.get("style"), STYLES, "plain");
let level: Level = pick(address.get("level"), LEVELS, "12");
let where: Where = pick(address.get("hemisphere"), WHERE, "all");
let month = where === "all" ? 0 : Math.max(0, Math.min(12, Math.round(Number(address.get("month")) || 0)));
/** Kid mode: big buttons and simpler words, kept in the address (kid=1). */
let kid = address.get("kid") === "1";
let asked = 0;
let right = 0;
let streak = 0;
let best = 0;
/** The constellations missed, to look at again under the question. */
const missed: string[] = [];
let current = "";
let answered = false;
let options: string[] = [];
/** The 88 in their order: the address names the question by its place in it (1 to 88), so the answer's name is not in the address. */
const ORDER = constellations().map((c) => c.abbreviation);
const questionInAddress = (): string | undefined => {
  const place = Number(address.get("q"));
  return Number.isInteger(place) && place >= 1 && place <= ORDER.length ? ORDER[place - 1] : (address.get("c") ?? undefined);
};

/** A word of the page: the kid mode's simpler one (`qz_k_<name>`) where it has one, else the plain one. */
const w = (name: string, values: Record<string, string | number> = {}): string => say(kid && `qz_k_${name}` in ALL_WORDS.en ? `qz_k_${name}` : `qz_${name}`, values);
const named = (c: Constellation): string => nameIn(c, langNow());
/** The question's six names: the answer and five others of the level that are easy to mix up with it (its neighbours, then ones of the same origin: `distractors`), in a random order. */
function choicesFor(answer: string): string[] {
  return shuffled([answer, ...distractors(answer, poolOf(level), CHOICES - 1)]);
}

function ask(abbreviation?: string): void {
  const held = abbreviation === undefined ? undefined : constellation(abbreviation)?.abbreviation;
  const pool = poolOf(level);
  const fresh = pool.filter((one) => one !== current);
  current = held !== undefined && pool.includes(held) ? held : fresh[Math.floor(Math.random() * fresh.length)]!;
  options = choicesFor(current);
  answered = false;
  address.set("q", String(ORDER.indexOf(current) + 1));
  address.set("c", null);
  // written now, not after the address's short delay, so a reload or a copied link right after a question asks the same one
  address.flush();
  render();
}

/** The chart centred on the constellation, as large as its figure allows; no names, ever. */
let drawnKey = "";
function drawSky(): void {
  const box = $("qz-box");
  const width = Math.max(280, Math.round(box.clientWidth));
  const key = `${current}|${style}|${langNow()}|${width}`;
  if (key === drawnKey) return;
  drawnKey = key;
  const height = Math.round(width < 600 ? width : Math.min(480, width * 0.6));
  const centre = centreOfConstellation(current)!;
  const view: View = { projection: "stereographic", ra: centre.rightAscension, dec: centre.declination, zoom: 1 };
  const stars = (figureOf(current).stars.length > 0 ? figureOf(current).stars : starsIn(current).filter((star) => star.magnitude < 5.5)).filter((star) => toScreen(view, width, height, { rightAscension: star.rightAscension, declination: star.declination }) !== undefined);
  let reach = 1;
  for (const star of stars) {
    const at = toScreen(view, width, height, { rightAscension: star.rightAscension, declination: star.declination })!;
    reach = Math.max(reach, Math.hypot(at[0] - width / 2, at[1] - height / 2));
  }
  view.zoom = Math.max(0.5, Math.min(8, ((style === "annotated" ? 0.27 : 0.42) * Math.min(width, height)) / reach));
  const layers = new Set<"lines" | "boundaries">(style === "plain" ? [] : style === "lines" ? ["lines"] : ["lines", "boundaries"]);
  const drawn = chart({ ...view, width, height, magnitude: 5.5, layers, lang: langNow() });
  const svg = $("qz-sky");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  // annotated: the neighbours are named (never the constellation asked)
  let labels = "";
  if (style === "annotated") {
    for (const near of neighbouringConstellations(current)) {
      const at = centreOfConstellation(near.abbreviation);
      const spot = at === undefined ? undefined : toScreen(view, width, height, at);
      if (spot === undefined || spot[0] < 24 || spot[0] > width - 24 || spot[1] < 16 || spot[1] > height - 12) continue;
      labels += `<text x="${spot[0].toFixed(1)}" y="${spot[1].toFixed(1)}" text-anchor="middle" font-size="13" fill="#ffe49a" stroke="#0b1020" stroke-width="3" paint-order="stroke" font-family="system-ui, sans-serif" data-neighbour="${near.abbreviation}">${nameIn(near, langNow()).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
    }
  }
  svg.innerHTML = drawn.svg + labels;
  svg.setAttribute("aria-label", w("sky"));
}

function valueButton(value: string): HTMLButtonElement {
  const button = Object.assign(document.createElement("button"), { type: "button" });
  button.dataset["value"] = value;
  return button;
}

function render(): void {
  document.title = `${w("heading")} - Hoshi Stars`;
  $("qz-root").dataset["kid"] = String(kid);
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-qz]"))) {
    const name = el.dataset["qz"]!;
    el.dataset["say"] = kid && `qz_k_${name}` in ALL_WORDS.en ? `qz_k_${name}` : `qz_${name}`;
    el.textContent = w(name);
  }
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-qz-label]"))) el.setAttribute("aria-label", w(el.dataset["qzLabel"]!));
  for (const button of Array.from($("qz-hemis").querySelectorAll("button"))) {
    button.textContent = w(`h${button.dataset["value"]}`);
    button.setAttribute("aria-pressed", String(button.dataset["value"] === where));
  }
  const months = $<HTMLSelectElement>("qz-month");
  months.replaceChildren(Object.assign(document.createElement("option"), { value: "0", textContent: w("anymonth") }), ...Array.from({ length: 12 }, (_, i) => Object.assign(document.createElement("option"), { value: String(i + 1), textContent: monthName(i + 1) })));
  months.value = String(month);
  months.disabled = where === "all";
  const skyNote = $("qz-skynote");
  skyNote.hidden = where === "all";
  skyNote.textContent = where === "all" ? "" : say("qz_skynote", { place: say(`qz_from_${where}`), when: say(month > 0 ? "qz_when_month" : "qz_when_year"), height: MIN_ALTITUDE });
  const kidButton = $("qz-kid");
  kidButton.textContent = say("qz_kid");
  kidButton.setAttribute("aria-pressed", String(kid));
  const styles = $("qz-styles");
  const levels = $("qz-levels");
  if (styles.children.length === 0) {
    for (const value of STYLES) styles.append(valueButton(value));
    for (const value of LEVELS) levels.append(valueButton(value));
    const hemis = $("qz-hemis");
    for (const value of WHERE) hemis.append(valueButton(value));
    hemis.addEventListener("click", (event) => {
      const value = (event.target as HTMLElement).closest("button")?.dataset["value"] as Where | undefined;
      if (value === undefined || value === where) return;
      where = value;
      if (where === "all") month = 0;
      address.set("hemisphere", where === "all" ? null : where);
      address.set("month", month === 0 ? null : String(month));
      ask();
    });
    $("qz-month").addEventListener("change", (event) => {
      month = Number((event.target as HTMLSelectElement).value);
      address.set("month", month === 0 ? null : String(month));
      ask();
    });
    $("qz-kid").addEventListener("click", () => {
      kid = !kid;
      address.set("kid", kid ? "1" : null);
      render();
      if (answered) $("qz-result").textContent = w($("qz-result").dataset["correct"] === "true" ? "right" : "wrong", { name: named(constellation(current)!) });
    });
    styles.addEventListener("click", (event) => {
      const value = (event.target as HTMLElement).closest("button")?.dataset["value"] as Style | undefined;
      if (value === undefined || value === style) return;
      style = value;
      address.set("style", style === "plain" ? null : style);
      render();
    });
    levels.addEventListener("click", (event) => {
      const value = (event.target as HTMLElement).closest("button")?.dataset["value"] as Level | undefined;
      if (value === undefined || value === level) return;
      level = value;
      address.set("level", level === "12" ? null : level);
      ask();
    });
  }
  for (const button of Array.from(styles.querySelectorAll("button"))) {
    button.textContent = w(STYLE_WORDS[button.dataset["value"] as Style]);
    button.setAttribute("aria-pressed", String(button.dataset["value"] === style));
  }
  for (const button of Array.from(levels.querySelectorAll("button"))) {
    button.textContent = w(`l${button.dataset["value"]}`);
    button.setAttribute("aria-pressed", String(button.dataset["value"] === level));
  }
  drawSky();
  const list = $("qz-choices");
  list.replaceChildren(
    ...options.map((abbreviation) => {
      const c = constellation(abbreviation)!;
      const button = Object.assign(document.createElement("button"), { type: "button", className: "fam-button qz-choice", textContent: named(c) });
      button.dataset["abbr"] = abbreviation;
      button.disabled = answered;
      if (answered) button.dataset["state"] = abbreviation === current ? "right" : "plain";
      button.addEventListener("click", () => answer(abbreviation));
      return button;
    }),
  );
  const right_ = constellation(current)!;
  // the link and its words name the answer, so they are put in only once it is answered
  const open = $<HTMLAnchorElement>("qz-open");
  open.hidden = !answered;
  if (answered) {
    open.href = `constellation.html?c=${current}`;
    open.textContent = w("open", { name: named(right_) });
  } else {
    open.removeAttribute("href");
    open.textContent = "";
  }
  $<HTMLButtonElement>("qz-next").disabled = !answered;
  $("qz-score").textContent = w("score", { right, asked }) + (best >= 2 ? ` ${w("streak", { streak, best })}` : "");
  drawMissed();
  if (!answered) $("qz-result").textContent = "";
  // the page's "Put it in your page" code follows what is chosen (there is none to tell in the embed page)
  document.dispatchEvent(new CustomEvent("qz-change", { detail: { style, level, kid, hemisphere: where, month, lang: langNow() } }));
}

/** The ones missed so far, each with its picture and a link to its page, to look at again. */
function drawMissed(): void {
  const box = $("qz-missed");
  box.hidden = missed.length === 0;
  $("qz-missed-title").hidden = missed.length === 0;
  box.replaceChildren(
    ...missed.map((abbreviation) => {
      const c = constellation(abbreviation)!;
      const link = Object.assign(document.createElement("a"), { className: "qz-miss", href: `constellation.html?c=${abbreviation}` });
      const picture = Object.assign(document.createElement("img"), { src: thumbSrc(abbreviation, 160, lookNow()), width: 80, height: 80, alt: "" });
      link.append(picture, Object.assign(document.createElement("span"), { textContent: named(c) }));
      return link;
    }),
  );
}

function answer(abbreviation: string): void {
  if (answered) return;
  answered = true;
  asked += 1;
  const name = named(constellation(current)!);
  if (abbreviation === current) {
    right += 1;
    streak += 1;
    best = Math.max(best, streak);
  } else {
    streak = 0;
    if (!missed.includes(current)) missed.push(current);
  }
  render();
  $("qz-result").textContent = w(abbreviation === current ? "right" : "wrong", { name });
  $("qz-result").dataset["correct"] = String(abbreviation === current);
  for (const button of Array.from($("qz-choices").querySelectorAll<HTMLButtonElement>("button"))) {
    if (button.dataset["abbr"] === abbreviation && abbreviation !== current) button.dataset["state"] = "wrong";
  }
  $("qz-next").focus();
}

$("qz-next").addEventListener("click", () => {
  ask();
  // Next is disabled again by the new question, so the keyboard goes to the first choice instead of being lost
  $("qz-choices").querySelector("button")?.focus();
});
// the arrow keys move across the six choices (left and right one at a time, up and down by a row), Home and End to the ends
$("qz-choices").addEventListener("keydown", (event) => {
  const keys = Array.from($("qz-choices").querySelectorAll<HTMLButtonElement>("button"));
  const at = keys.indexOf(event.target as HTMLButtonElement);
  if (at < 0 || event.ctrlKey || event.metaKey || event.altKey) return;
  const row = keys.filter((key) => Math.abs(key.getBoundingClientRect().top - keys[0]!.getBoundingClientRect().top) < 2).length;
  const to: Record<string, number> = { ArrowRight: (at + 1) % keys.length, ArrowLeft: (at + keys.length - 1) % keys.length, ArrowDown: at + row < keys.length ? at + row : at, ArrowUp: at - row >= 0 ? at - row : at, Home: 0, End: keys.length - 1 };
  const next = to[event.key];
  if (next === undefined) return;
  event.preventDefault();
  keys[next]!.focus();
});
// 1 to 6 answer with the keyboard (the buttons also take Tab, Enter and Space)
document.addEventListener("keydown", (event) => {
  if (answered || event.ctrlKey || event.metaKey || event.altKey) return;
  if ((event.target as HTMLElement).closest("input, select, textarea") !== null) return;
  const at = Number(event.key) - 1;
  const choice = Number.isInteger(at) && at >= 0 && at < CHOICES ? options[at] : undefined;
  if (choice === undefined) return;
  event.preventDefault();
  answer(choice);
});
document.addEventListener("hoshi-language", () => {
  render();
  if (answered) $("qz-result").textContent = w($("qz-result").dataset["correct"] === "true" ? "right" : "wrong", { name: named(constellation(current)!) });
});
let lastWidth = 0;
new ResizeObserver(() => {
  const width = Math.round($("qz-box").clientWidth);
  if (width === lastWidth) return;
  lastWidth = width;
  if (current !== "") drawSky();
}).observe($("qz-box"));
ask(questionInAddress());
