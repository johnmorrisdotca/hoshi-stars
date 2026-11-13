// The constellation quiz: a chart centred on one constellation with no name for it on the chart, and six names to choose from. The style (plain stars, stars and lines, annotated: the lines, the borders and the names of the neighbours) and the level (the bright 12, 30 or all 88) are kept in
// the address (style, level), and so is the question (c), so a reload or a shared link asks the same one. The chart is the package's own SVG drawn once for each question and nothing moves by itself: nothing is drawn at rest.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { centreOfConstellation, chart, toScreen, type View } from "../src/chart/chart.ts";
import { constellation, constellations, starsIn, type Constellation } from "../src/constellations.ts";
import { neighbouringConstellations } from "../src/nearest.ts";
import { figureOf } from "../src/lines.ts";
import { langNow, lookNow, nameIn, thumbSrc } from "./thumbs.ts";
import { say } from "./words.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const address = createAddressState();

const STYLES = ["plain", "lines", "annotated"] as const;
type Style = (typeof STYLES)[number];
const STYLE_WORDS: Record<Style, string> = { plain: "qz_plain", lines: "qz_lines", annotated: "qz_annotated" };
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
const poolOf = (level: Level): string[] => ranked.slice(0, Number(level));

let style: Style = pick(address.get("style"), STYLES, "plain");
let level: Level = pick(address.get("level"), LEVELS, "12");
let asked = 0;
let right = 0;
let streak = 0;
let best = 0;
/** The constellations missed, to look at again under the question. */
const missed: string[] = [];
let current = "";
let answered = false;
let options: string[] = [];

const named = (c: Constellation): string => nameIn(c, langNow());
const shuffle = <T>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

/** The question's six names: the answer and five others of the level, in a random order. */
function choicesFor(answer: string): string[] {
  const others = shuffle(poolOf(level).filter((one) => one !== answer)).slice(0, CHOICES - 1);
  return shuffle([answer, ...others]);
}

function ask(abbreviation?: string): void {
  const held = abbreviation === undefined ? undefined : constellation(abbreviation)?.abbreviation;
  const pool = poolOf(level);
  const fresh = pool.filter((one) => one !== current);
  current = held !== undefined && pool.includes(held) ? held : fresh[Math.floor(Math.random() * fresh.length)]!;
  options = choicesFor(current);
  answered = false;
  address.set("c", current);
  render();
}

/** The chart centred on the constellation, as large as its figure allows; no names, ever. */
function drawSky(): void {
  const box = $("qz-box");
  const width = Math.max(280, Math.round(box.clientWidth));
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
  svg.setAttribute("aria-label", say("qz_sky"));
}

function valueButton(value: string): HTMLButtonElement {
  const button = Object.assign(document.createElement("button"), { type: "button" });
  button.dataset["value"] = value;
  return button;
}

function render(): void {
  document.title = `${say("qz_heading")} - Hoshi Stars`;
  const styles = $("qz-styles");
  const levels = $("qz-levels");
  if (styles.children.length === 0) {
    for (const value of STYLES) styles.append(valueButton(value));
    for (const value of LEVELS) levels.append(valueButton(value));
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
    button.textContent = say(STYLE_WORDS[button.dataset["value"] as Style]);
    button.setAttribute("aria-pressed", String(button.dataset["value"] === style));
  }
  for (const button of Array.from(levels.querySelectorAll("button"))) {
    button.textContent = say(`qz_l${button.dataset["value"]}`);
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
  list.setAttribute("aria-label", say("qz_choose"));
  const right_ = constellation(current)!;
  const open = $<HTMLAnchorElement>("qz-open");
  open.hidden = !answered;
  open.href = `constellation.html?c=${current}`;
  open.textContent = say("qz_open", { name: named(right_) });
  $<HTMLButtonElement>("qz-next").disabled = !answered;
  $("qz-score").textContent = say("qz_score", { right, asked }) + (best >= 2 ? ` ${say("qz_streak", { streak, best })}` : "");
  drawMissed();
  if (!answered) $("qz-result").textContent = "";
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
  $("qz-result").textContent = say(abbreviation === current ? "qz_right" : "qz_wrong", { name });
  $("qz-result").dataset["correct"] = String(abbreviation === current);
  for (const button of Array.from($("qz-choices").querySelectorAll<HTMLButtonElement>("button"))) {
    if (button.dataset["abbr"] === abbreviation && abbreviation !== current) button.dataset["state"] = "wrong";
  }
  $("qz-next").focus();
}

$("qz-next").addEventListener("click", () => ask());
document.addEventListener("hoshi-language", () => {
  render();
  if (answered) $("qz-result").textContent = say($("qz-result").dataset["correct"] === "true" ? "qz_right" : "qz_wrong", { name: named(constellation(current)!) });
});
let lastWidth = 0;
new ResizeObserver(() => {
  const width = Math.round($("qz-box").clientWidth);
  if (width === lastWidth) return;
  lastWidth = width;
  if (current !== "") drawSky();
}).observe($("qz-box"));
ask(address.get("c") ?? undefined);
