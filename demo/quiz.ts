// The constellation quiz: a chart centred on one constellation with no name for it on the chart, and six names to choose from. The style (plain stars, stars and lines, annotated: the lines, the borders and the names of the neighbours) and the level (the bright 12, 30 or all 88) are kept in
// the address (style, level, kid, hemisphere, month), and so is the question (q, the constellation's place in the list of the 88, never its name; a hand-written c=Ori is read too), so a reload or a shared link asks the same one. The chart is the package's own SVG drawn once for each question and nothing moves by itself: nothing is drawn at rest.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { centreOfConstellation, chart, toScreen, type View } from "../src/chart/chart.ts";
import { neighbouringConstellations } from "../src/nearest.ts";
import { frameCredit } from "./frame-credit.ts";
import { figureThumbSrc, langNow, lookNow, nameIn, thumbSrc } from "./thumbs.ts";
import { ALL_WORDS } from "../scripts/gallery-words.ts";
import { CULTURE_IDS, cultureFor, itemNamed, itemsFor, type CultureId, type QuizItem } from "./quiz-items.ts";
import { distractors, nearestTies, shuffled, westernTies, type Ties } from "./quiz-pick.ts";
import { HEMISPHERES, MIN_ALTITUDE, isSeenIn, type Hemisphere } from "./quiz-sky.ts";
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

/** The sky culture asked (`western`, `japanese` or `chinese`, the Chinese being the Twenty-Eight Mansions), kept in the address as `culture`. */
let cultureId: CultureId = pick(address.get("culture"), CULTURE_IDS, "western");
const items = (): readonly QuizItem[] => itemsFor(cultureId);
const itemOf = (id: string): QuizItem => items().find((item) => item.id === id)!;
/** The items brightest first: the light of their stars added up. */
const rankedOf = (): QuizItem[] => [...items()].sort((a, b) => b.light - a.light || a.id.localeCompare(b.id));
/** The hemisphere asked ("all" is the whole sky) and the month (0 is any), kept in the address as `hemisphere` and `month`. */
type Where = Hemisphere | "all";
const WHERE: readonly Where[] = ["all", ...HEMISPHERES];
/** What a level asks of the sky: the items a reader in the hemisphere can see (in the month, or in any month), the brightest first, as many as the level says (`88` is all of them, whatever the sky has). */
const pools = new Map<string, string[]>();
function poolOf(level: Level): string[] {
  const key = `${cultureId}|${where}|${month}|${level}`;
  let found = pools.get(key);
  if (found === undefined) {
    const seen = rankedOf().filter((item) => where === "all" || isSeenIn(item.stars, where, month));
    found = (level === "88" ? seen : seen.slice(0, Number(level))).map((item) => item.id);
    pools.set(key, found);
  }
  return found;
}
/** How many the whole of the sky asked has, for the label of the last level. */
const totalOf = (): number => poolSize("88");
const poolSize = (level: Level): number => poolOf(level).length;
const tiesOf = (): Ties => (cultureId === "western" ? westernTies : nearestTies(items()));

let style: Style = pick(address.get("style"), STYLES, "plain");
let level: Level = pick(address.get("level"), LEVELS, "12");
let where: Where = pick(address.get("hemisphere"), WHERE, "all");
let month = where === "all" ? 0 : Math.max(0, Math.min(12, Math.round(Number(address.get("month")) || 0)));
/** The 30 level is there only while the sky asked has more than 30 (the Chinese mansions are 21: the level is then all of them). */
const levelOk = (value: Level): boolean => value !== "30" || totalOf() > 30;
if (!levelOk(level)) level = "88";
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
/** The question is named in the address by its place in the list of the sky asked (1 to 88 for the Western sky), so the answer's name is not in the address. */
const questionInAddress = (): string | undefined => {
  const place = Number(address.get("q"));
  const hand = address.get("c");
  return Number.isInteger(place) && place >= 1 && place <= items().length ? items()[place - 1]!.id : hand === null ? undefined : itemNamed(cultureId, hand);
};

/** A word of the page: the kid mode's simpler one (`qz_k_<name>`) where it has one, else the plain one. */
const w = (name: string, values: Record<string, string | number> = {}): string => say(kid && `qz_k_${name}` in ALL_WORDS.en ? `qz_k_${name}` : `qz_${name}`, values);
/** The name of an item in the page's language. */
const labelOf = (id: string): string => itemOf(id).label(langNow());
/** The question's six names: the answer and five others of the level that are easy to mix up with it (its neighbours, then ones of the same origin: `distractors`), in a random order. */
function choicesFor(answer: string): string[] {
  return shuffled([answer, ...distractors(answer, poolOf(level), CHOICES - 1, Math.random, tiesOf())]);
}

function ask(abbreviation?: string): void {
  const held = abbreviation === undefined ? undefined : itemNamed(cultureId, abbreviation);
  const pool = poolOf(level);
  const fresh = pool.filter((one) => one !== current);
  current = held !== undefined && pool.includes(held) ? held : fresh[Math.floor(Math.random() * fresh.length)]!;
  options = choicesFor(current);
  answered = false;
  address.set("q", String(items().findIndex((item) => item.id === current) + 1));
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
  const look = cultureId !== "western" && style === "annotated" ? "lines" : style;
  const key = `${cultureId}|${current}|${look}|${langNow()}|${width}`;
  if (key === drawnKey) return;
  drawnKey = key;
  const height = Math.round(width < 600 ? width : Math.min(480, width * 0.6));
  const item = itemOf(current);
  const centre = item.centre;
  const view: View = { projection: "stereographic", ra: centre.rightAscension, dec: centre.declination, zoom: 1 };
  const stars = item.drawStars.filter((star) => toScreen(view, width, height, { rightAscension: star.rightAscension, declination: star.declination }) !== undefined);
  let reach = 1;
  for (const star of stars) {
    const at = toScreen(view, width, height, { rightAscension: star.rightAscension, declination: star.declination })!;
    reach = Math.max(reach, Math.hypot(at[0] - width / 2, at[1] - height / 2));
  }
  view.zoom = Math.max(0.5, Math.min(8, ((look === "annotated" ? 0.27 : 0.42) * Math.min(width, height)) / reach));
  const layers = new Set<"lines" | "boundaries">(look === "plain" ? [] : look === "lines" ? ["lines"] : ["lines", "boundaries"]);
  const drawn = chart({ ...view, width, height, magnitude: 5.5, layers, lang: langNow(), culture: cultureFor(cultureId) });
  const svg = $("qz-sky");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  // annotated: the neighbours are named (never the constellation asked)
  let labels = "";
  if (look === "annotated") {
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

/** The page of a figure: the constellation page, with the culture in its address for a figure of another sky. */
const figureHref = (id: string): string => `constellation.html?c=${id}${cultureId === "western" ? "" : `&culture=${cultureId}`}`;

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
  const styles = $("qz-styles");
  const levels = $("qz-levels");
  if (styles.children.length === 0) {
    for (const value of STYLES) styles.append(valueButton(value));
    for (const value of LEVELS) levels.append(valueButton(value));
    const cultures = $("qz-cultures");
    for (const value of CULTURE_IDS) cultures.append(valueButton(value));
    cultures.addEventListener("click", (event) => {
      const value = (event.target as HTMLElement).closest("button")?.dataset["value"] as CultureId | undefined;
      if (value === undefined || value === cultureId) return;
      cultureId = value;
      if (!levelOk(level)) {
        level = "88";
        address.set("level", "88");
      }
      missed.length = 0;
      address.set("culture", cultureId === "western" ? null : cultureId);
      ask();
    });
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
      if (answered) $("qz-result").textContent = w($("qz-result").dataset["correct"] === "true" ? "right" : "wrong", { name: labelOf(current) });
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
  for (const button of Array.from($("qz-hemis").querySelectorAll("button"))) {
    button.textContent = w(`h${button.dataset["value"]}`);
    button.setAttribute("aria-pressed", String(button.dataset["value"] === where));
  }
  for (const button of Array.from($("qz-cultures").querySelectorAll("button"))) {
    button.textContent = w(`c_${button.dataset["value"]}`);
    button.setAttribute("aria-pressed", String(button.dataset["value"] === cultureId));
  }
  const cultureNote = $("qz-culturenote");
  cultureNote.hidden = cultureId === "western";
  cultureNote.textContent = cultureId === "western" ? "" : say(`qz_cnote_${cultureId}`, { n: items().length });
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
  for (const button of Array.from(styles.querySelectorAll("button"))) {
    button.textContent = w(STYLE_WORDS[button.dataset["value"] as Style]);
    button.hidden = cultureId !== "western" && button.dataset["value"] === "annotated";
    button.setAttribute("aria-pressed", String(button.dataset["value"] === (cultureId !== "western" && style === "annotated" ? "lines" : style)));
  }
  for (const button of Array.from(levels.querySelectorAll("button"))) {
    const value = button.dataset["value"] as Level;
    button.textContent = value === "88" && totalOf() !== 88 ? w("lall", { n: totalOf() }) : w(`l${value}`);
    button.hidden = !levelOk(value);
    button.setAttribute("aria-pressed", String(value === level));
  }
  drawSky();
  const list = $("qz-choices");
  list.replaceChildren(
    ...options.map((abbreviation) => {
      const button = Object.assign(document.createElement("button"), { type: "button", className: "fam-button qz-choice", textContent: labelOf(abbreviation) });
      button.dataset["abbr"] = abbreviation;
      button.disabled = answered;
      if (answered) button.dataset["state"] = abbreviation === current ? "right" : "plain";
      button.addEventListener("click", () => answer(abbreviation));
      return button;
    }),
  );
  // the link and its words name the answer, so they are put in only once it is answered
  const open = $<HTMLAnchorElement>("qz-open");
  open.hidden = !answered;
  if (answered) {
    open.href = figureHref(current);
    open.textContent = w("open", { name: labelOf(current) });
  } else {
    open.removeAttribute("href");
    open.textContent = "";
  }
  $<HTMLButtonElement>("qz-next").disabled = !answered;
  $("qz-score").textContent = w("score", { right, asked }) + (best >= 2 ? ` ${w("streak", { streak, best })}` : "");
  drawMissed();
  if (!answered) $("qz-result").textContent = "";
  // the page's "Put it in your page" code follows what is chosen (there is none to tell in the embed page)
  document.dispatchEvent(new CustomEvent("qz-change", { detail: { style, level, kid, hemisphere: where, month, culture: cultureId, lang: langNow() } }));
}

/** The ones missed so far, each with its picture and a link to its page, to look at again. */
function drawMissed(): void {
  const box = $("qz-missed");
  // a constellation missed before can be asked again: until it is answered its name and picture must not be shown here
  const shown = answered ? missed : missed.filter((one) => one !== current);
  box.hidden = shown.length === 0;
  $("qz-missed-title").hidden = shown.length === 0;
  box.replaceChildren(
    ...shown.map((abbreviation) => {
      const link = Object.assign(document.createElement("a"), { className: "qz-miss", href: figureHref(abbreviation) });
      const picture = Object.assign(document.createElement("img"), { src: cultureId === "western" ? thumbSrc(abbreviation, 160, lookNow()) : figureThumbSrc(cultureId, abbreviation, 160, lookNow()), width: 80, height: 80, alt: "" });
      link.append(picture, Object.assign(document.createElement("span"), { textContent: labelOf(abbreviation) }));
      return link;
    }),
  );
}

function answer(abbreviation: string): void {
  if (answered) return;
  answered = true;
  asked += 1;
  const name = labelOf(current);
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
  if (answered) $("qz-result").textContent = w($("qz-result").dataset["correct"] === "true" ? "right" : "wrong", { name: labelOf(current) });
});
let lastWidth = 0;
new ResizeObserver(() => {
  const width = Math.round($("qz-box").clientWidth);
  if (width === lastWidth) return;
  lastWidth = width;
  if (current !== "") drawSky();
}).observe($("qz-box"));
ask(questionInAddress());
