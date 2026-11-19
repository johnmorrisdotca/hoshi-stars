// The constellation quiz: a chart centred on one constellation with no name for it on the chart, and six names to choose from. The style (plain stars, stars and lines, annotated: the lines, the borders and the names of the neighbours) and the level (the bright 12, 30 or all 88) are kept in
// the address (style, level, kid, lat, month), and so is the question (q, the constellation's place in the list of the 88, never its name; a hand-written c=Ori is read too), so a reload or a shared link asks the same one. The chart is the package's own SVG drawn once for each question and nothing moves by itself: nothing is drawn at rest.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { centreOfConstellation, chart, toScreen, type View } from "../src/chart/chart.ts";
import { neighbouringConstellations } from "../src/nearest.ts";
import { frameCredit } from "./frame-credit.ts";
import { figureThumbSrc, langNow, lookNow, nameIn, thumbSrc } from "./thumbs.ts";
import { ALL_WORDS } from "../scripts/gallery-words.ts";
import { CULTURE_IDS, cultureFor, figureLevelOf, itemNamed, itemsFor, levelIdsFor, mansionIdsOf, otherMansions, type CultureId, type QuizItem } from "./quiz-items.ts";
import { FIELD_FILL, FIELD_RADIUS, marksSvg } from "./quiz-star.ts";
import { distractors, nearestTies, shuffled, westernTies, type Ties } from "./quiz-pick.ts";
import { MAX_LATITUDE, MIN_ALTITUDE, askedLatitude, isSeenIn, latitudeOf } from "./quiz-sky.ts";
import { monthName, say } from "./words.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
/** The embed page (`embed-quiz.html`) is this same script with its controls hidden: the address chooses (style, level, kid, lat, month, lang) and nothing is written back to it. */
const embedded = document.body.dataset["embed"] === "quiz";
if (embedded && new URLSearchParams(location.search).get("lang") === "ja") document.documentElement.lang = "ja";
const real = createAddressState();
const address = { get: (name: string): string | null => real.get(name), set: (name: string, value: string | null): void => (embedded ? undefined : real.set(name, value)), flush: (): void => (embedded ? undefined : real.flush()) };
if (embedded) frameCredit(document.documentElement.lang === "ja");

const STYLES = ["plain", "lines", "annotated"] as const;
type Style = (typeof STYLES)[number];
const STYLE_WORDS: Record<Style, string> = { plain: "plain", lines: "lines", annotated: "annotated" };
/** A level's id: `12`, `30` or `88` (the brightest so many, or all), or for the Chinese sky `purple-forbidden`, `heavenly-market` or `officials-1`, `officials-2` and so on (`levelIdsFor`). */
type Level = string;
/** The fewest figures a level of a set of figures needs in the sky chosen, so that the question has its six names. */
const MIN_FIGURES = 6;
/** The fewest questions the small mansions level needs: it asks about 7 and has six names from all 28 mansions. */
const MIN_STAR_QUESTIONS = 2;
const CHOICES = 6;

const pick = <T extends string>(text: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(text as T) ? (text as T) : fallback);

/** The sky culture asked (`western`, `japanese` or `chinese`, the Chinese being the Twenty-Eight Mansions), kept in the address as `culture`. */
let cultureId: CultureId = pick(address.get("culture"), CULTURE_IDS, "western");
const items = (): readonly QuizItem[] => itemsFor(cultureId);
const itemOf = (id: string): QuizItem => items().find((item) => item.id === id)!;
/** The items brightest first: the light of their stars added up. */
const rankedOf = (): QuizItem[] => [...items()].sort((a, b) => b.light - a.light || a.id.localeCompare(b.id));
/** The latitude asked (`null` is the whole sky) and the month (0 is any). The latitude is kept in the address as `lat` (a whole number of degrees) when it was typed; the old `hemisphere=north` or `south` is read as 40 or -40. */
let where: number | null = askedLatitude(address.get("lat"), address.get("hemisphere"));
/** Whether the latitude came from "My location": then it is kept in memory only, never in the address (and so not in the embed code), the same as the Tonight and My sky pages. */
let fromPlace = false;
/** What a level asks of the sky: the items a reader in the hemisphere can see (in the month, or in any month), the brightest first, as many as the level says (`88` is all of them, whatever the sky has). */
const pools = new Map<string, string[]>();
function poolOf(level: Level): string[] {
  const key = `${cultureId}|${where}|${month}|${level}`;
  let found = pools.get(key);
  if (found === undefined) {
    const set = figureLevelOf(cultureId, level);
    const seen = rankedOf().filter((item) => (set === undefined || set.ids.includes(item.id)) && (cultureId !== "chinese" || set !== undefined || (mansionIdsOf().has(item.id) && item.ask === "figure")) && (where === null || isSeenIn(item.stars, where, month)));
    found = (set !== undefined || level === "88" ? seen : seen.slice(0, Number(level))).map((item) => item.id);
    pools.set(key, found);
  }
  return found;
}
/** Where the six names of a question come from: the level's own figures, but for the small mansions all 28 mansions that the sky chosen shows (the question is which mansion, and any of them could hold the star). */
function choicePoolOf(level: Level): string[] {
  if (figureLevelOf(cultureId, level)?.kind !== "small-mansions") return poolOf(level);
  return rankedOf().filter((item) => mansionIdsOf().has(item.id) && (where === null || isSeenIn(item.stars, where, month))).map((item) => item.id);
}
/** How many the whole of the sky asked has, for the label of the last level. */
const totalOf = (): number => poolSize("88");
const poolSize = (level: Level): number => poolOf(level).length;
/** What makes two alike: the Western sky's borders, else the nearest in the sky (for the small mansions' question, the nearest of the 28 mansions: the answer is one of them). */
const tiesOf = (): Ties => (cultureId === "western" ? westernTies : figureLevelOf(cultureId, level)?.kind === "small-mansions" ? nearestTies(items().filter((item) => mansionIdsOf().has(item.id))) : nearestTies(items()));

let style: Style = pick(address.get("style"), STYLES, "plain");
let level: Level = address.get("level") ?? "12";
let month = where === null ? 0 : Math.max(0, Math.min(12, Math.round(Number(address.get("month")) || 0)));
/** A level is offered while its sky has it: the 30 only where the sky asked has more than 30 (the Chinese mansions are 21: the level is then all of them), and a level of star officials only while the sky chosen (the hemisphere and month) leaves it six figures. */
const levelOk = (value: Level): boolean => levelIdsFor(cultureId).includes(value) && (figureLevelOf(cultureId, value) === undefined ? value !== "30" || totalOf() > 30 : figureLevelOf(cultureId, value)!.kind === "small-mansions" ? poolSize(value) >= MIN_STAR_QUESTIONS && choicePoolOf(value).length >= MIN_FIGURES : poolSize(value) >= MIN_FIGURES);
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
  return shuffled([answer, ...distractors(answer, choicePoolOf(level), CHOICES - 1, Math.random, tiesOf())]);
}

function ask(abbreviation?: string): void {
  // a sky chosen after the level can leave it too few figures
  if (!levelOk(level)) {
    level = "88";
    address.set("level", "88");
  }
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
  if (item.ask === "star") {
    // a fixed field: the same angle from the middle of the chart for every question, whatever the stars' span (the held stars are one or two)
    const probe = toScreen(view, width, height, { rightAscension: centre.rightAscension, declination: centre.declination + FIELD_RADIUS });
    reach = probe === undefined ? 1 : Math.hypot(probe[0] - width / 2, probe[1] - height / 2);
  }
  for (const star of item.ask === "star" ? [] : stars) {
    const at = toScreen(view, width, height, { rightAscension: star.rightAscension, declination: star.declination })!;
    reach = Math.max(reach, Math.hypot(at[0] - width / 2, at[1] - height / 2));
  }
  view.zoom = item.ask === "star" ? (FIELD_FILL * Math.min(width, height)) / reach : Math.max(0.5, Math.min(8, ((look === "annotated" ? 0.27 : 0.42) * Math.min(width, height)) / reach));
  const layers = new Set<"lines" | "boundaries">(item.ask === "star" || look === "plain" ? [] : look === "lines" ? ["lines"] : ["lines", "boundaries"]);
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
  const marks = item.ask === "star" ? marksSvg(item.stars, otherMansions(current), (point) => toScreen(view, width, height, point), width, height, look !== "plain") : "";
  svg.innerHTML = drawn.svg + labels + marks;
  svg.setAttribute("aria-label", w(item.ask === "star" ? "star_sky" : "sky"));
}

/** The page of a figure: the constellation page, with the culture in its address for a figure of another sky. */
const figureHref = (id: string): string => `constellation.html?c=${id}${cultureId === "western" ? "" : `&culture=${cultureId}`}`;

function valueButton(value: string): HTMLButtonElement {
  const button = Object.assign(document.createElement("button"), { type: "button" });
  button.dataset["value"] = value;
  return button;
}

function render(): void {
  const starQuestion = current !== "" && items().find((item) => item.id === current)?.ask === "star";
  document.title = `${w(starQuestion ? "star_heading" : "heading")} - Hoshi Stars`;
  $("qz-root").dataset["kid"] = String(kid);
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-qz]"))) {
    const name = starQuestion && (el.dataset["qz"] === "heading" || el.dataset["qz"] === "lede") ? `star_${el.dataset["qz"]}` : el.dataset["qz"]!;
    el.dataset["say"] = kid && `qz_k_${name}` in ALL_WORDS.en ? `qz_k_${name}` : `qz_${name}`;
    el.textContent = w(name);
  }
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-qz-label]"))) el.setAttribute("aria-label", w(el.dataset["qzLabel"]!));
  const styles = $("qz-styles");
  const levels = $("qz-levels");
  if (styles.children.length === 0) {
    for (const value of STYLES) styles.append(valueButton(value));
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
    hemis.append(valueButton("all"));
    /** Takes a latitude: typed (kept in the address) or from the device (kept in memory only). */
    const setLatitude = (latitude: number | null, place: boolean): void => {
      where = latitude;
      fromPlace = place && latitude !== null;
      if (where === null) month = 0;
      address.set("hemisphere", null);
      address.set("lat", where === null || fromPlace ? null : String(where));
      address.set("month", month === 0 ? null : String(month));
      ask();
    };
    hemis.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("button") === null || where === null) return;
      $("qz-locnote").textContent = "";
      setLatitude(null, false);
    });
    $<HTMLInputElement>("qz-lat").addEventListener("change", (event) => {
      const field = event.target as HTMLInputElement;
      const typed = field.value.trim() === "" ? null : latitudeOf(field.value);
      if (field.value.trim() !== "" && typed === null) {
        // not a latitude: the one before is kept
        $("qz-locnote").textContent = say("qz_latbad", { max: MAX_LATITUDE });
        field.value = where === null ? "" : String(where);
        return;
      }
      $("qz-locnote").textContent = "";
      setLatitude(typed, false);
    });
    $("qz-here").addEventListener("click", () => {
      const note = $("qz-locnote");
      if (!("geolocation" in navigator)) {
        note.textContent = say("qz_locfail");
        return;
      }
      note.textContent = say("qz_locating");
      // asked for on a press and never on load; only the latitude, rounded to a whole degree, is used, and it is not written anywhere
      navigator.geolocation.getCurrentPosition(
        (here) => {
          const latitude = latitudeOf(String(here.coords.latitude));
          if (latitude === null) {
            note.textContent = say("qz_locfail");
            return;
          }
          note.textContent = say("qz_located", { lat: latitude });
          setLatitude(latitude, true);
        },
        () => {
          note.textContent = say("qz_locfail");
        },
        { maximumAge: 60_000, timeout: 10_000 },
      );
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
    button.textContent = w("hall");
    button.setAttribute("aria-pressed", String(where === null));
  }
  const latField = $<HTMLInputElement>("qz-lat");
  if (document.activeElement !== latField) latField.value = where === null ? "" : String(where);
  latField.setAttribute("aria-label", w("lat"));
  $("qz-here").textContent = w("here");
  for (const button of Array.from($("qz-cultures").querySelectorAll("button"))) {
    button.textContent = w(`c_${button.dataset["value"]}`);
    button.setAttribute("aria-pressed", String(button.dataset["value"] === cultureId));
  }
  const cultureNote = $("qz-culturenote");
  cultureNote.hidden = cultureId === "western";
  cultureNote.textContent = cultureId === "western" ? "" : say(`qz_cnote_${cultureId}`, { n: items().filter((item) => item.ask === "figure").length, m: items().filter((item) => mansionIdsOf().has(item.id) && item.ask === "figure").length });
  const months = $<HTMLSelectElement>("qz-month");
  months.replaceChildren(Object.assign(document.createElement("option"), { value: "0", textContent: w("anymonth") }), ...Array.from({ length: 12 }, (_, i) => Object.assign(document.createElement("option"), { value: String(i + 1), textContent: monthName(i + 1) })));
  months.value = String(month);
  months.disabled = where === null;
  const skyNote = $("qz-skynote");
  skyNote.hidden = where === null;
  skyNote.textContent = where === null ? "" : say("qz_skynote", { place: say(where === 0 ? "qz_from_0" : where > 0 ? "qz_from_n" : "qz_from_s", { lat: Math.abs(where) }), when: say(month > 0 ? "qz_when_month" : "qz_when_year"), height: MIN_ALTITUDE });
  const kidButton = $("qz-kid");
  kidButton.textContent = say("qz_kid");
  kidButton.setAttribute("aria-pressed", String(kid));
  for (const button of Array.from(styles.querySelectorAll("button"))) {
    button.textContent = w(STYLE_WORDS[button.dataset["value"] as Style]);
    button.hidden = cultureId !== "western" && button.dataset["value"] === "annotated";
    button.setAttribute("aria-pressed", String(button.dataset["value"] === (cultureId !== "western" && style === "annotated" ? "lines" : style)));
  }
  // the buttons are the sky's own levels: made again when the culture changes
  const wanted = levelIdsFor(cultureId);
  if (levels.dataset["culture"] !== cultureId) {
    levels.replaceChildren(...wanted.map((value) => valueButton(value)));
    levels.dataset["culture"] = cultureId;
  }
  for (const button of Array.from(levels.querySelectorAll("button"))) {
    const value = button.dataset["value"] as Level;
    const set = figureLevelOf(cultureId, value);
    button.textContent =
      set === undefined ? (value === "88" && totalOf() !== 88 ? w("lall", { n: totalOf() }) : w(`l${value}`)) : set.kind === "officials" ? w("lofficials", { k: set.tranche, n: poolSize(value) }) : w(`l${set.kind}`, { n: poolSize(value) });
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
  document.dispatchEvent(new CustomEvent("qz-change", { detail: { style, level, kid, latitude: fromPlace ? null : where, month, culture: cultureId, lang: langNow() } }));
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
