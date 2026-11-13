// The life of a star page, step one: a Hertzsprung-Russell diagram of the graded stars (A and B), drawn once for each choice of axes, filter or language and never at rest. The axes switch between colour
// and brightness (B-V against absolute magnitude, which the catalogue and the parallax give) and temperature and luminosity (which `starProfile` works out); the same stars, in two shapes. A click, or
// Enter on a dot, picks a star: its card says what is known and links to it on the sky map. Below, the two lives of a star (like the Sun, and massive) each stage with the example of our own data you can pick.
// The address keeps the axes, the filter and the pick. No tracks are drawn: our data holds stars as they are today, and no figures from elsewhere are used.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { starGrade } from "../src/accuracy.ts";
import { starProfile, type ProfileInput } from "../src/profile.ts";
import { absoluteMagnitude, starByHr, starColour, starDistance, stars, type Star } from "../src/stars.ts";
import { WORDS } from "../scripts/page-words.ts";
import { AXES, hrPoints, place, scaleOf, SHOWS, SUN, type Axes, type HrPoint, type Show } from "./hr-points.ts";

type Lang = "en" | "ja";
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const lang = (): Lang => (document.documentElement.lang === "ja" ? "ja" : "en");
const say = (key: string, values: Record<string, string | number> = {}): string => ((WORDS[lang()] as Record<string, string>)[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const address = createAddressState({ defaults: {} });

/** The Sun is picked as hr 0: it is not a catalogue star. */
const SUN_HR = 0;
const axesParam = address.get("axes");
const showParam = address.get("show");
const starParam = address.get("star");
const state: { axes: Axes; show: Show; pick: number | null } = {
  axes: (AXES as readonly string[]).includes(axesParam ?? "") ? (axesParam as Axes) : "colour",
  show: (SHOWS as readonly string[]).includes(showParam ?? "") ? (showParam as Show) : "graded",
  pick: starParam === "sun" ? SUN_HR : Number.isInteger(Number(starParam)) && Number(starParam) > 0 ? Number(starParam) : null,
};

const nameOf = (star: Star): string => (lang() === "ja" ? (star.nameJa ?? star.name) : star.name) ?? star.designation ?? `HR ${star.hr}`;
const SVG = "http://www.w3.org/2000/svg";
function el(name: string, attributes: Record<string, string | number>, text?: string): SVGElement {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

// ----- the diagram ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const W = 700;
const H = 520;
const LEFT = 62;
const RIGHT = 14;
const TOP = 14;
const BOTTOM = 52;
let points: HrPoint[] = [];
let ordered: HrPoint[] = [];
let cursor = 0;
let ring: SVGElement | undefined;
let frame: { sx: (x: number) => number; sy: (y: number) => number } | undefined;

/** The stars named on the diagram so a reader can find them: the Sun, the two the tickets name for a Sun-like life, and the supergiant. */
const LABELLED = [5459, 1457, 2061, 2491];

const dotColour = (hr: number): string => {
  if (hr === SUN_HR) return "#fff4e0";
  const star = starByHr(hr)!;
  return starProfile(star).colour ?? starColour(star);
};

function drawChart(): void {
  points = hrPoints(state.axes, state.show);
  const sun = place(SUN, state.axes);
  const all = sun === undefined ? points : [...points, { hr: SUN_HR, ...sun }];
  const xs = scaleOf(state.axes, "x", all.map((p) => p.x));
  const ys = scaleOf(state.axes, "y", all.map((p) => p.y));
  // hot is on the left in both views; a brighter star is higher: absolute magnitude runs the other way up
  const sx = (x: number): number => LEFT + ((W - LEFT - RIGHT) * (state.axes === "colour" ? x - xs.min : xs.max - x)) / (xs.max - xs.min);
  const sy = (y: number): number => (state.axes === "colour" ? TOP + ((H - TOP - BOTTOM) * (y - ys.min)) / (ys.max - ys.min) : TOP + ((H - TOP - BOTTOM) * (ys.max - y)) / (ys.max - ys.min));
  frame = { sx, sy };
  const names = state.axes === "colour" ? { x: say("hr_xColour"), y: say("hr_yColour") } : { x: say("hr_xPhysical"), y: say("hr_yPhysical") };
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": say("hr_chartLabel", { n: points.length, x: names.x, y: names.y }) });
  svg.append(el("rect", { width: W, height: H, fill: "#070b17" }));
  const grid = el("g", { stroke: "#9fb4d8", "stroke-opacity": 0.2, "stroke-width": 1 });
  const labels = el("g", { fill: "#c9d6ee", "font-size": 12 });
  for (const tick of xs.ticks) {
    grid.append(el("line", { x1: sx(tick.value).toFixed(1), x2: sx(tick.value).toFixed(1), y1: TOP, y2: H - BOTTOM }));
    labels.append(el("text", { x: sx(tick.value).toFixed(1), y: H - BOTTOM + 16, "text-anchor": "middle" }, tick.label));
  }
  for (const tick of ys.ticks) {
    grid.append(el("line", { x1: LEFT, x2: W - RIGHT, y1: sy(tick.value).toFixed(1), y2: sy(tick.value).toFixed(1) }));
    labels.append(el("text", { x: LEFT - 6, y: (sy(tick.value) + 4).toFixed(1), "text-anchor": "end" }, tick.label));
  }
  svg.append(grid, labels);
  svg.append(el("text", { x: (LEFT + W - RIGHT) / 2, y: H - 8, "text-anchor": "middle", fill: "#e6edf9", "font-size": 13 }, names.x));
  svg.append(el("text", { transform: `translate(14 ${(TOP + H - BOTTOM) / 2}) rotate(-90)`, "text-anchor": "middle", fill: "#e6edf9", "font-size": 13 }, names.y));
  ordered = [...points].sort((a, b) => sx(a.x) - sx(b.x) || sy(a.y) - sy(b.y));
  cursor = Math.max(0, ordered.findIndex((p) => p.hr === state.pick));
  const group = el("g", { "data-testid": "hr-dots", role: "group", tabindex: 0, "aria-label": say("hr_chartLabel", { n: points.length, x: names.x, y: names.y }) });
  for (const point of ordered) {
    const star = starByHr(point.hr)!;
    const dot = el("circle", { cx: sx(point.x).toFixed(1), cy: sy(point.y).toFixed(1), r: 3.4, fill: dotColour(point.hr), "fill-opacity": 0.9, "data-hr": point.hr, tabindex: -1, role: "button", "aria-label": `${nameOf(star)}` });
    group.append(dot);
  }
  svg.append(group);
  // the named examples: a ring and a label, and the Sun as a diamond
  const marks = el("g", { "pointer-events": "none", "font-size": 12, fill: "#fff", "paint-order": "stroke", stroke: "#070b17", "stroke-width": 3, "stroke-linejoin": "round" });
  const mark = (hr: number, text: string): void => {
    const at = hr === SUN_HR ? sun : points.find((p) => p.hr === hr);
    if (at === undefined) return;
    marks.append(el("text", { x: (sx(at.x) + 8).toFixed(1), y: (sy(at.y) - 6).toFixed(1) }, text));
  };
  mark(SUN_HR, say("hr_sun"));
  for (const hr of LABELLED) mark(hr, nameOf(starByHr(hr)!));
  svg.append(marks);
  if (sun !== undefined) {
    const x = sx(sun.x);
    const y = sy(sun.y);
    const diamond = el("path", { d: `M${x} ${y - 6} L${x + 6} ${y} L${x} ${y + 6} L${x - 6} ${y} Z`, fill: "#fff4e0", stroke: "#ffd86b", "stroke-width": 1.5, "data-hr": SUN_HR, "data-testid": "hr-sun", tabindex: -1, role: "button", "aria-label": say("hr_sun") });
    svg.append(diamond);
    diamond.addEventListener("click", (event) => {
      event.stopPropagation();
      choose(SUN_HR);
    });
  }
  ring = el("circle", { r: 9, fill: "none", stroke: "#ffd86b", "stroke-width": 2.5, "pointer-events": "none", "data-testid": "hr-ring", display: "none" });
  svg.append(ring);
  // A dot is a few pixels across on a phone, so a tap picks the nearest dot within a fingertip's reach (about 10 pixels), not only the one exactly under it.
  svg.addEventListener("click", (event) => {
    const direct = Number((event.target as Element).getAttribute("data-hr"));
    if (Number.isInteger(direct) && direct > 0) {
      choose(direct);
      return;
    }
    const box = svg.getBoundingClientRect();
    if (box.width === 0 || (event.target as Element).closest("a, button") !== null) return;
    const scale = W / box.width;
    const px = (event.clientX - box.left) * scale;
    const py = (event.clientY - box.top) * scale;
    const reach = 10 * scale;
    let best: HrPoint | undefined;
    let bestDistance = reach;
    for (const point of ordered) {
      const distance = Math.hypot(sx(point.x) - px, sy(point.y) - py);
      if (distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    if (best !== undefined) choose(best.hr);
  });
  group.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step !== 0) {
      event.preventDefault();
      cursor = Math.max(0, Math.min(ordered.length - 1, (event.target === group ? cursor - step : cursor) + step));
      group.querySelector<SVGElement>(`circle[data-hr="${ordered[cursor]!.hr}"]`)?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      cursor = event.key === "Home" ? 0 : ordered.length - 1;
      group.querySelector<SVGElement>(`circle[data-hr="${ordered[cursor]!.hr}"]`)?.focus();
    } else if ((event.key === "Enter" || event.key === " ") && event.target !== group) {
      event.preventDefault();
      choose(Number((event.target as Element).getAttribute("data-hr")));
    }
  });
  $("#hr-chart").replaceChildren(svg);
  $("#hr-count").textContent = say("hr_count", { n: points.length, basis: say(state.axes === "colour" ? "hr_basisColour" : "hr_basisPhysical") });
  $("#hr-count").dataset["n"] = String(points.length);
  moveRing();
}

/** The ring round the picked dot, moved without drawing the chart again. */
function moveRing(): void {
  if (ring === undefined || frame === undefined) return;
  const at = state.pick === null ? undefined : state.pick === SUN_HR ? place(SUN, state.axes) : points.find((p) => p.hr === state.pick);
  if (at === undefined) {
    ring.setAttribute("display", "none");
    return;
  }
  ring.setAttribute("cx", frame.sx(at.x).toFixed(1));
  ring.setAttribute("cy", frame.sy(at.y).toFixed(1));
  ring.removeAttribute("display");
}

// ----- the card ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const mapAddress = (key: string, ra: number, dec: number, zoom: number): string => `index.html?pick=${key}&ra=${ra.toFixed(2)}&dec=${dec.toFixed(2)}&zoom=${zoom}&lang=${lang()}`;

function fact(list: HTMLElement, label: string, value: string): void {
  const dt = document.createElement("dt");
  dt.textContent = say(label);
  const dd = document.createElement("dd");
  dd.textContent = value;
  list.append(dt, dd);
}
const kelvin = (value: number): string => `${Math.round(value / 10) * 10} K`;
const solar = (value: number): string => (value >= 100 ? Math.round(value).toLocaleString("en") : value >= 1 ? value.toFixed(1) : value.toPrecision(2));

function drawCard(): void {
  const host = $("#hr-card");
  if (state.pick === null) {
    host.replaceChildren(Object.assign(document.createElement("p"), { className: "fam-fine", textContent: say("hr_pick") }));
    return;
  }
  const star = state.pick === SUN_HR ? undefined : starByHr(state.pick);
  if (state.pick !== SUN_HR && star === undefined) {
    host.replaceChildren();
    return;
  }
  const input: ProfileInput = star ?? SUN;
  const title = document.createElement("h2");
  title.textContent = star === undefined ? say("hr_sun") : nameOf(star);
  title.dataset["hr"] = String(state.pick);
  const list = document.createElement("dl");
  const profile = starProfile(input);
  fact(list, "hr_type", input.spectralType);
  if (input.colourIndex !== undefined) fact(list, "hr_bv", input.colourIndex.toFixed(2));
  const magnitude = absoluteMagnitude(input);
  if (magnitude !== undefined) fact(list, "hr_abs", magnitude.toFixed(1));
  if (profile.temperature !== undefined) fact(list, "hr_temp", kelvin(profile.temperature.value));
  if (profile.luminosity !== undefined) fact(list, "hr_lum", `${solar(profile.luminosity.value)} ×☉`);
  if (star !== undefined) {
    fact(list, "hr_grade", starGrade(star));
    const distance = starDistance(star);
    if (distance !== undefined) fact(list, "hr_distance", say("hr_ly", { n: Math.round(distance.lightYears * 10) / 10 }));
  }
  const parts: HTMLElement[] = [title, list];
  if (star === undefined) parts.push(Object.assign(document.createElement("p"), { className: "fam-fine", textContent: say("hr_reference") }));
  else if (place(star, state.axes) === undefined) parts.push(Object.assign(document.createElement("p"), { className: "fam-fine", textContent: say("hr_noPlace", { name: nameOf(star), missing: say(state.axes === "colour" ? "hr_missingColour" : "hr_missingPhysical") }) }));
  else if (!points.some((p) => p.hr === star.hr)) parts.push(Object.assign(document.createElement("p"), { className: "fam-fine", textContent: say("hr_notDrawn", { name: nameOf(star) }) }));
  const link = document.createElement("a");
  link.className = "fam-button";
  link.dataset["testid"] = "hr-map";
  link.textContent = say("hr_map");
  link.href = star === undefined ? `index.html?pick=S:sun&lang=${lang()}` : mapAddress(`S:${star.hr}`, star.rightAscension, star.declination, 6);
  parts.push(link);
  host.replaceChildren(...parts);
}

// ----- the two lives -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
interface Stage {
  key: string;
  /** A star of ours the diagram can pick: its catalogue number (0 is the Sun). */
  hr?: number[];
  /** A deep-sky object of ours the sky map opens: its id, and the words of its example. */
  deep?: { id: string; ra: number; dec: number; words: string };
  /** The words of the example, where it is not the star's name. */
  words?: string;
}
const AVERAGE: Stage[] = [
  { key: "nebula" },
  { key: "ttauri", words: "hr_ex_ttauri" },
  { key: "main", hr: [5459, SUN_HR], words: "hr_ex_main" },
  { key: "subgiant" },
  { key: "giant", hr: [1457] },
  { key: "planetary", deep: { id: "M57", ra: 283.4, dec: 33.03, words: "hr_ex_m57" } },
  { key: "dwarf", hr: [2491], words: "hr_ex_dwarf" },
];
const MASSIVE: Stage[] = [
  { key: "supergiant", hr: [2061] },
  { key: "supernova", deep: { id: "M1", ra: 83.63, dec: 22.01, words: "hr_ex_m1" } },
  { key: "neutron", deep: { id: "M1", ra: 83.63, dec: 22.01, words: "hr_ex_m1" } },
];

function drawLives(): void {
  const column = (title: string, list: Stage[]): HTMLElement => {
    const holder = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = title;
    const ol = document.createElement("ol");
    for (const stage of list) {
      const item = document.createElement("li");
      item.className = "hr-stage";
      item.dataset["stage"] = stage.key;
      const name = document.createElement("strong");
      name.textContent = say(`hr_stage_${stage.key}`);
      item.append(name);
      const note = document.createElement("span");
      note.className = "fam-fine";
      note.textContent = say(stage.words ?? stage.deep?.words ?? (stage.hr === undefined ? "hr_ex_none" : "hr_ex_star"), { name: stage.hr?.map((hr) => (hr === SUN_HR ? say("hr_sun") : nameOf(starByHr(hr)!))).join(", ") ?? "" });
      item.append(note);
      for (const hr of stage.hr ?? []) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "fam-button";
        button.dataset["pick"] = String(hr);
        button.textContent = hr === SUN_HR ? say("hr_sun") : nameOf(starByHr(hr)!);
        button.addEventListener("click", () => choose(hr));
        item.append(button);
      }
      if (stage.deep !== undefined) {
        const link = document.createElement("a");
        link.className = "fam-button";
        link.dataset["deep"] = stage.deep.id;
        link.textContent = say("hr_map");
        link.href = mapAddress(`D:${stage.deep.id}`, stage.deep.ra, stage.deep.dec, 8);
        item.append(link);
      }
      ol.append(item);
    }
    holder.append(heading, ol);
    return holder;
  };
  $("#hr-lives").replaceChildren(column(say("hr_average"), AVERAGE), column(say("hr_massive"), MASSIVE));
}

// ----- the page ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function drawControls(): void {
  const segment = <T extends string>(host: string, values: readonly T[], current: T, word: (value: T) => string, change: (value: T) => void): void => {
    $(host).replaceChildren(...values.map((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = say(word(value));
      button.dataset["value"] = value;
      button.setAttribute("aria-pressed", String(value === current));
      button.addEventListener("click", () => change(value));
      return button;
    }));
  };
  segment("#axes", AXES, state.axes, (v) => (v === "colour" ? "hr_axColour" : "hr_axPhysical"), (axes) => {
    state.axes = axes;
    address.set("axes", axes === "colour" ? null : axes);
    redraw();
  });
  segment("#shows", SHOWS, state.show, (v) => (v === "graded" ? "hr_showGraded" : v === "a" ? "hr_showA" : "hr_showNamed"), (show) => {
    state.show = show;
    address.set("show", show === "graded" ? null : show);
    redraw();
  });
  const names = stars({ minGrade: "B" }).filter((star) => star.name !== undefined).flatMap((star) => [star.name!, ...(star.nameJa === undefined ? [] : [star.nameJa])]);
  $("#hr-names").replaceChildren(...names.map((name) => Object.assign(document.createElement("option"), { value: name })));
}

function choose(hr: number | null): void {
  state.pick = hr;
  address.set("star", hr === null ? null : hr === SUN_HR ? "sun" : String(hr));
  moveRing();
  drawCard();
}

function redraw(): void {
  drawControls();
  drawChart();
  drawCard();
  drawLives();
}

/** Finds the star named in the box; says so when there is none. */
function findByName(input: HTMLInputElement): void {
  const text = input.value.trim().toLowerCase();
  if (text === "") return;
  const found = stars({ minGrade: "B" }).find((star) => [star.name, star.nameJa, star.designation].some((n) => n?.toLowerCase() === text));
  $("#hr-found").textContent = found === undefined ? say("hr_findNone") : "";
  if (found !== undefined) choose(found.hr);
}
const findBox = $<HTMLInputElement>("#hr-find");
findBox.addEventListener("change", () => findByName(findBox));
// Safari does not fire `change` when Enter is pressed in a box that is not in a form, so Enter finds the star itself.
findBox.addEventListener("keydown", (event) => {
  if (event.key === "Enter") findByName(findBox);
});
document.addEventListener("hoshi-language", redraw);
redraw();
