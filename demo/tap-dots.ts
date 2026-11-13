// The Tap the dots page: a connect-the-dots figure on the screen. The child taps 1, 2, 3 in order and the line grows; a wrong tap shakes the picture gently (and says so in words); at the end the constellation shows its name and stars.
// The figure and its numbers are the sheets' own (`dotsFigure`); the rules are `tap-dots-model.ts`. The picture is drawn when something changes and never at rest; with reduced motion nothing shakes or grows.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { WORDS } from "../scripts/page-words.ts";
import { constellations } from "../src/constellations.ts";
import { figureOf } from "../src/lines.ts";
import { DOT_LEVELS, dotsFigure, dotsSubtitle, type DotLevel, type DotsFigure } from "../src/sheets/index.ts";
import { TYPES } from "../src/sheets/common.ts";
import { drawnLines, hitDot, nextNumber, tapDot, visitOrder, type Progress } from "./tap-dots-model.ts";

type Lang = "en" | "ja";
const SIZE = 120;
/** The size a finger needs, in pixels: a tap within this far of a dot's middle meant it. */
const FINGER_PX = 24;
const FAMOUS = ["Cru", "UMa", "Cas", "Ori", "Leo", "Sco", "Cyg", "Lyr", "Aql", "Gem", "Tau", "UMi"];
const SVG = "http://www.w3.org/2000/svg";
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const lang = (): Lang => (document.documentElement.lang === "ja" ? "ja" : "en");
const say = (key: string, values: Record<string, string | number> = {}): string => ((WORDS[lang()] as Record<string, string>)[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

const address = createAddressState({ defaults: {} });
const dottable = constellations().filter((c) => figureOf(c.abbreviation).segments.length > 0);
const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

const state = {
  c: pick(address.get("c"), dottable.map((c) => c.abbreviation), "Cru"),
  level: pick(address.get("level"), DOT_LEVELS, "easy") as DotLevel,
};
let progress: Progress = { done: 0, wrong: 0 };
let message = "";
let figure: DotsFigure;
let order: number[] = [];

const nameOf = (abbreviation: string): string => {
  const c = dottable.find((one) => one.abbreviation === abbreviation)!;
  return lang() === "ja" ? c.japanese : c.name;
};

// ----- the choices: levels and constellations in rows of buttons ---------------------------------------------------------------------------------------------------------------------------------
const rows: (() => void)[] = [];
function buttons(container: string, items: readonly { value: string; text: () => string }[], current: () => string, choose: (value: string) => void): void {
  const box = $(container);
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset["value"] = item.value;
    button.addEventListener("click", () => choose(item.value));
    box.append(button);
  }
  rows.push(() => {
    items.forEach((item, i) => {
      const button = box.children[i] as HTMLButtonElement;
      button.textContent = item.text();
      button.setAttribute("aria-pressed", String(item.value === current()));
    });
  });
}
buttons("#tp-levels", DOT_LEVELS.map((k) => ({ value: k, text: () => say(`kd_${k}`) })), () => state.level, (v) => choose({ level: v as DotLevel }));
buttons("#tp-whiches", FAMOUS.map((a) => ({ value: a, text: () => nameOf(a) })), () => state.c, (v) => choose({ c: v }));
const more = $<HTMLSelectElement>("#tp-more");
function fillMore(): void {
  const names = dottable.map((c) => ({ code: c.abbreviation, name: nameOf(c.abbreviation) })).sort((a, b) => a.name.localeCompare(b.name, lang()));
  more.replaceChildren(new Option("-", ""), ...names.map((c) => new Option(c.name, c.code)));
  more.value = FAMOUS.includes(state.c) ? "" : state.c;
}
more.addEventListener("change", () => more.value !== "" && choose({ c: more.value }));
$("#tp-again").addEventListener("click", () => start());

function choose(change: Partial<typeof state>): void {
  Object.assign(state, change);
  address.set("c", state.c);
  address.set("level", state.level);
  start();
}

/** A new round: the figure of the choice (the hard level's dots are the medium's, with its numbers left off the screen until reached) and no progress. */
function start(): void {
  figure = dotsFigure(state.c, { level: state.level === "hard" ? "medium" : state.level, widthMm: SIZE, heightMm: SIZE, type: "kid" });
  order = visitOrder(figure);
  progress = { done: 0, wrong: 0 };
  message = say(state.level === "hard" ? "td_startHard" : "td_start");
  draw({});
}

// ----- the picture: drawn when something changes -------------------------------------------------------------------------------------------------------------------------------------------------------
function el(name: string, attributes: Record<string, string | number>, text?: string): SVGElement {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
const numbersShown = (numbers: readonly number[]): number[] => (state.level === "hard" ? numbers.filter((n) => n <= progress.done) : [...numbers]);

function draw(what: { grew?: boolean; shake?: boolean }): void {
  const finished = progress.done === order.length;
  const focused = document.activeElement instanceof SVGElement ? document.activeElement.getAttribute("data-index") : null;
  const lines = drawnLines(figure.lines, progress);
  const svg = el("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, role: "group", "aria-label": say("td_board", { name: nameOf(state.c), done: progress.done, total: order.length }), "data-done": progress.done, "data-total": order.length, "data-wrong": progress.wrong });
  lines.forEach(([a, b], i) => {
    const newest = what.grew === true && i === lines.length - 1;
    svg.append(el("line", { x1: figure.dots[a]!.x, y1: figure.dots[a]!.y, x2: figure.dots[b]!.x, y2: figure.dots[b]!.y, stroke: finished ? "#ffd86b" : "#9fc2ff", "stroke-width": 1, "stroke-linecap": "round", pathLength: 1, "data-line": "", ...(newest && !calm ? { class: "tap-grow" } : {}) }));
  });
  const reached = new Set(order.slice(0, progress.done));
  figure.dots.forEach((dot, i) => {
    if (dot.ring) svg.append(el("circle", { cx: dot.x, cy: dot.y, r: dot.r + 2.2, fill: "none", stroke: "#9fb0d8", "stroke-width": 0.6 }));
    const shown = numbersShown(dot.numbers);
    const label = state.level === "hard" ? (shown.length > 0 ? say("td_starNamed", { name: dot.star.name ?? say("td_starHard"), n: shown[0]! }) : say("td_starHard")) : say("td_star", { n: dot.numbers[0]! });
    svg.append(el("circle", { cx: dot.x, cy: dot.y, r: dot.r, fill: reached.has(i) ? "#ffd86b" : "#f4f6ff", tabindex: 0, role: "button", "aria-label": label, "data-dot": dot.star.hr, "data-index": i, "data-reached": reached.has(i) ? "true" : "false", ...(state.level === "hard" ? {} : { "data-numbers": dot.numbers.join(" ") }) }));
  });
  for (const dot of figure.dots) {
    const shown = numbersShown(dot.numbers);
    if (shown.length > 0) svg.append(el("text", { x: dot.label.x, y: dot.label.y, "text-anchor": "middle", "font-size": TYPES.kid.bodyMm, fill: "#e6ecff", "data-number": shown[0]!, "pointer-events": "none" }, shown.join("·")));
  }
  if (what.shake === true && !calm) {
    svg.classList.add("tap-shake");
    svg.addEventListener("animationend", () => svg.classList.remove("tap-shake"), { once: true });
  }
  svg.addEventListener("click", (event) => onClick(svg, event));
  svg.addEventListener("keydown", (event) => {
    const target = event.target as Element;
    // the arrow keys walk from dot to dot (the next and the one before, wrapping; Home and End to the ends), as Tab does
    const all = Array.from(svg.querySelectorAll<SVGElement>("[data-index]"));
    const at = all.indexOf(target as SVGElement);
    const walk = at < 0 ? 0 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (walk !== 0 || (at >= 0 && (event.key === "Home" || event.key === "End"))) {
      event.preventDefault();
      all[event.key === "Home" ? 0 : event.key === "End" ? all.length - 1 : (at + walk + all.length) % all.length]!.focus();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && target.hasAttribute("data-index")) {
      event.preventDefault();
      onTap(Number(target.getAttribute("data-index")));
    }
  });
  $("#tp-board").replaceChildren(svg);
  if (focused !== null) svg.querySelector<SVGElement>(`[data-index="${focused}"]`)?.focus();
  $("#tp-status").textContent = message;
  const result = $("#tp-result");
  result.hidden = !finished;
  if (finished) {
    const c = figure.constellation;
    const names = [...new Set(figure.dots.map((dot) => dot.star.name).filter((n): n is string => n !== null && n !== undefined && n !== ""))];
    $("#tp-name").textContent = say("td_done", { name: nameOf(state.c) });
    $("#tp-sub").textContent = dotsSubtitle(c, lang());
    $("#tp-stars").textContent = names.length === 0 ? "" : say("td_doneStars", { stars: names.join(", ") });
  }
}

function onClick(svg: SVGElement, event: MouseEvent): void {
  const matrix = (svg as unknown as SVGSVGElement).getScreenCTM();
  if (matrix === null) return;
  const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  onTap(hitDot(figure.dots, at.x, at.y, FINGER_PX / matrix.a));
}

function onTap(dot: number | null): void {
  const step = tapDot(order, progress, dot);
  progress = step.progress;
  if (step.result === "ignored") return;
  const n = nextNumber(order, progress);
  const hard = state.level === "hard";
  if (step.result === "wrong") message = say(hard ? "td_wrongHard" : "td_wrong", { n: n ?? 0 });
  else if (step.result === "finished") message = say("td_done", { name: nameOf(state.c) });
  else message = say(hard ? "td_nextHard" : "td_next", { n: n ?? 0, done: progress.done, total: order.length });
  draw({ grew: step.result !== "wrong", shake: step.result === "wrong" });
}

function render(): void {
  fillMore();
  for (const row of rows) row();
  $("#tp-calm").hidden = !calm;
  start();
}
document.addEventListener("hoshi-language", render);
render();
