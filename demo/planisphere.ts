// The planisphere page: a star wheel round the pole (the printable wheel's disc, with a ring of the sky's hours added) turned under a plate whose window is the horizon of a latitude and whose outer ring is the clock. Drag the wheel, press the arrow keys or
// pick a date and a time; the window shows the sky and the list names the stars in it. The scene is drawn again only when the hemisphere, the latitude or the language changes; turning the wheel changes one transform and the labels' turns. Nothing runs at rest.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { WORDS } from "../scripts/page-words.ts";
import { starWheelDisc } from "../src/sheets/wheel.ts";
import { discTurn, labelledStars, momentAfterTurn, momentText, namedStarsInWindow, parseMoment, sheetPosition, wheelGeometry, WHEEL_SHEET } from "./planisphere-core.ts";

type Lang = "en" | "ja";
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const lang = (): Lang => (document.documentElement.lang === "ja" ? "ja" : "en");
const say = (key: string, values: Record<string, string | number> = {}): string => ((WORDS[lang()] as Record<string, string>)[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const address = createAddressState({ defaults: { hemi: "n", lat: "45" } });
const { cx, cy, radius } = WHEEL_SHEET;
const RAD = Math.PI / 180;
const LABEL_LIMIT = 24;
/** What a key turns the disc by, in degrees: 15 minutes of the sky's turn. */
const KEY_DEGREES = 3.75;

const clampLatitude = (value: number): number => Math.min(70, Math.max(20, Math.round(value)));
const startLatitude = Number(address.get("lat"));
const startMoment = parseMoment(address.get("date"), address.get("time"));
const state = {
  south: address.get("hemi") === "s",
  latitude: Number.isFinite(startLatitude) && startLatitude >= 20 && startLatitude <= 70 ? Math.round(startLatitude) : 45,
  /** Milliseconds on the wheel's own clock: the Sun's time at the place, read as UTC. Kept exact while dragging, to the minute in the address. */
  ms: startMoment ?? (Math.floor(Date.now() / 86_400_000) * 86_400_000 + 21 * 3_600_000),
};
const signed = (): number => (state.south ? -state.latitude : state.latitude);

// ----- the scene -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
interface Scene {
  disc: SVGGElement;
  labels: { node: SVGTextElement; x: number; y: number }[];
}
let scene: Scene | null = null;

const point = (r: number, angle: number): [number, number] => [cx + r * Math.sin(angle * RAD), cy - r * Math.cos(angle * RAD)];
const f = (v: number): string => (Math.round(v * 100) / 100).toString();
const nameOf = (star: { name: string | undefined; nameJa: string | undefined }): string => (lang() === "ja" ? (star.nameJa ?? star.name) : star.name) ?? "";

/** A flat ring between two radii as a path (the even-odd rule leaves the middle open). */
const annulus = (inner: number, outer: number): string => `M${cx - outer} ${cy}a${outer} ${outer} 0 1 0 ${2 * outer} 0a${outer} ${outer} 0 1 0 ${-2 * outer} 0ZM${cx - inner} ${cy}a${inner} ${inner} 0 1 0 ${2 * inner} 0a${inner} ${inner} 0 1 0 ${-2 * inner} 0Z`;

/** A ring of 24 hours between two radii: a tick and a number each, at the angle `angleOf` gives the hour, clockwise from up. */
function hourRing(inner: number, outer: number, angleOf: (hour: number) => number, cls: string): string {
  const parts: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const a = angleOf(hour);
    const [x1, y1] = point(inner, a);
    const [x2, y2] = point(inner + (outer - inner) * (hour % 6 === 0 ? 0.5 : 0.3), a);
    const [lx, ly] = point(inner + (outer - inner) * 0.72, a);
    parts.push(`<line class="${cls}-tick" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`);
    parts.push(`<text class="${cls}-hour" x="${f(lx)}" y="${f(ly + 1.2)}" text-anchor="middle" transform="rotate(${f(a)} ${f(lx)} ${f(ly)})" data-hour="${hour}">${hour}</text>`);
  }
  return parts.join("");
}

function sceneMarkup(): { markup: string; labels: { hr: number; x: number; y: number; text: string }[] } {
  const g = wheelGeometry(signed());
  const full = starWheelDisc(signed(), { widthMm: WHEEL_SHEET.width, heightMm: 400, lang: lang(), type: "normal" });
  // the printable disc without its words at the foot and its pin: the page says its own
  const body = full.slice(full.indexOf("</title>") + 8, full.lastIndexOf("</svg>")).replace(/<text[^>]*data-say=""[^>]*>[^<]*<\/text>/g, "").replace(/<circle[^>]*data-pin=""[^>]*\/>/g, "");
  const labels = labelledStars().flatMap((star) => {
    const spot = sheetPosition(star, signed(), 0);
    return Math.hypot(spot.x - cx, spot.y - cy) <= WHEEL_SHEET.inner * 0.96 ? [{ hr: star.hr, x: spot.x + 1.5, y: spot.y - 1, text: nameOf(star) }] : [];
  });
  const north = g.north;
  // the sky's hours, evenly spaced, 15 degrees an hour round the pole, on the disc beyond the ring of months
  const raRing = `<path class="wh-ra-back" fill-rule="evenodd" d="${annulus(radius, radius + 7)}"/>${hourRing(radius, radius + 7, (h) => (north ? 15 * h : -15 * h), "wh-ra")}<circle class="wh-ra-edge" cx="${cx}" cy="${cy}" r="${radius + 7}"/>`;
  const names = labels.map((l) => `<text class="wh-name" x="${f(l.x)}" y="${f(l.y)}" data-hr="${l.hr}">${l.text}</text>`).join("");
  const disc = `<g class="wh-disc" id="wh-disc"><circle class="wh-sky" cx="${cx}" cy="${cy}" r="${radius}"/>${body}${raRing}${names}</g>`;
  // the plate: opaque inside the ring of months except for the window (the horizon), and the clock ring outside, 12 at the top and the later hours the way the stars set
  const w = g.window;
  const hole = `M${cx - WHEEL_SHEET.inner} ${cy}a${WHEEL_SHEET.inner} ${WHEEL_SHEET.inner} 0 1 0 ${2 * WHEEL_SHEET.inner} 0a${WHEEL_SHEET.inner} ${WHEEL_SHEET.inner} 0 1 0 ${-2 * WHEEL_SHEET.inner} 0ZM${f(w.x - w.r)} ${f(w.y)}a${f(w.r)} ${f(w.r)} 0 1 0 ${f(2 * w.r)} 0a${f(w.r)} ${f(w.r)} 0 1 0 ${f(-2 * w.r)} 0Z`;
  const clock = `<path class="wh-clock-back" fill-rule="evenodd" d="${annulus(radius + 7, radius + 21)}"/>${hourRing(radius + 7, radius + 21, (h) => (north ? -15 * (h - 12) : 15 * (h - 12)), "wh-clock")}<circle class="wh-ra-edge" cx="${cx}" cy="${cy}" r="${radius + 21}"/>`;
  const dir = (x: number, y: number, key: "N" | "E" | "S" | "W", id: string): string => `<text class="wh-dir" x="${f(x)}" y="${f(y + 1.8)}" text-anchor="middle" data-direction="${id}">${say(`pl_${key}`)}</text>`;
  const east = north ? 1 : -1;
  const inset = 5;
  const directions = dir(w.x, w.y + w.r - inset, north ? "N" : "S", north ? "north" : "south") + dir(w.x, w.y - w.r + inset + 1, north ? "S" : "N", north ? "south" : "north") + dir(w.x + east * (w.r - inset), w.y, "E", "east") + dir(w.x - east * (w.r - inset), w.y, "W", "west");
  const plate = `<g class="wh-plate"><path class="wh-mask" fill-rule="evenodd" d="${hole}"/><circle class="wh-window" cx="${f(w.x)}" cy="${f(w.y)}" r="${f(w.r)}" data-window=""/>${directions}${clock}<circle class="wh-pin" cx="${cx}" cy="${cy}" r="1.6"/></g>`;
  return { markup: `${disc}${plate}`, labels };
}

function buildScene(): void {
  const { markup, labels } = sceneMarkup();
  const size = WHEEL_SHEET.radius + 24;
  $("#pl-wheel").innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx - size} ${cy - size} ${2 * size} ${2 * size}" role="img" aria-label="${say("pl_chartLabel", describe())}" data-testid="pl-svg" font-family="inherit"><title>${say("pl_chartLabel", describe())}</title>${markup}</svg>`;
  const disc = $("#pl-wheel").querySelector<SVGGElement>("#wh-disc")!;
  scene = { disc, labels: labels.map((l) => ({ node: disc.querySelector<SVGTextElement>(`text.wh-name[data-hr="${l.hr}"]`)!, x: l.x, y: l.y })) };
  $("#pl-hemisphere").querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String((button.dataset["value"] === "s") === state.south)));
  turned();
}

function describe(): Record<string, string | number> {
  const text = momentText(state.ms);
  return { date: text.date, time: text.time, latitude: state.latitude, side: say(state.south ? "pl_S" : "pl_N") };
}

// ----- turning --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** The wheel has turned (a moment changed): move the disc, keep each name upright, fill the list, the boxes and the words. The scene is not drawn again. */
function turned(): void {
  if (scene === null) return;
  const turn = discTurn(signed(), state.ms);
  scene.disc.setAttribute("transform", `rotate(${f(turn)} ${cx} ${cy})`);
  for (const l of scene.labels) l.node.setAttribute("transform", `rotate(${f(-turn)} ${f(l.x)} ${f(l.y)})`);
  const inside = namedStarsInWindow(signed(), state.ms);
  const parts = describe();
  const list = $("#pl-list");
  list.replaceChildren(...inside.slice(0, LABEL_LIMIT).map((star) => {
    const item = document.createElement("li");
    item.dataset["hr"] = String(star.hr);
    item.textContent = nameOf(star);
    return item;
  }));
  $("#pl-summary").textContent = inside.length === 0 ? say("pl_summaryNone", parts) : say("pl_summary", { ...parts, n: inside.length, name: nameOf(inside[0]!) });
  $("#pl-summary").dataset["count"] = String(inside.length);
  const text = momentText(state.ms);
  const dateBox = $<HTMLInputElement>("#pl-date");
  const timeBox = $<HTMLInputElement>("#pl-time");
  if (dateBox.value !== text.date) dateBox.value = text.date;
  if (timeBox.value !== text.time) timeBox.value = text.time;
  const latBox = $<HTMLInputElement>("#pl-latitude");
  if (document.activeElement !== latBox) latBox.value = String(state.latitude);
  const wheel = $("#pl-wheel");
  wheel.setAttribute("aria-valuenow", String(Number(text.time.slice(0, 2)) * 60 + Number(text.time.slice(3))));
  wheel.setAttribute("aria-valuetext", `${text.date} ${text.time}`);
  wheel.setAttribute("aria-label", say("pl_chartLabel", parts));
  wheel.dataset["turn"] = f(turn);
}

let frame = 0;
function later(): void {
  if (frame !== 0) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    turned();
  });
}

/** Writes the choices to the address (the moment to the minute); not while a drag is under way. */
function keep(): void {
  const text = momentText(state.ms);
  address.setMany({ hemi: state.south ? "s" : "n", lat: String(state.latitude), date: text.date, time: text.time });
}

function turnBy(degrees: number): void {
  state.ms = momentAfterTurn(signed(), state.ms, degrees);
  turned();
  keep();
}

// ----- the hands ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const wheel = $("#pl-wheel");
let dragging: { id: number; last: number } | null = null;
const angleOf = (event: PointerEvent): number => {
  const box = (wheel.querySelector("svg") ?? wheel).getBoundingClientRect();
  return (Math.atan2(event.clientX - (box.left + box.width / 2), -(event.clientY - (box.top + box.height / 2))) / RAD);
};
wheel.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  dragging = { id: event.pointerId, last: angleOf(event) };
  wheel.setPointerCapture(event.pointerId);
  wheel.focus({ preventScroll: true });
});
wheel.addEventListener("pointermove", (event) => {
  if (dragging === null || event.pointerId !== dragging.id) return;
  const now = angleOf(event);
  const step = ((now - dragging.last + 540) % 360) - 180;
  dragging.last = now;
  state.ms = momentAfterTurn(signed(), state.ms, step);
  later();
});
const release = (event: PointerEvent): void => {
  if (dragging === null || event.pointerId !== dragging.id) return;
  dragging = null;
  turned();
  keep();
};
wheel.addEventListener("pointerup", release);
wheel.addEventListener("pointercancel", release);
wheel.addEventListener("keydown", (event) => {
  const clockwise = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
  if (clockwise !== 0) {
    event.preventDefault();
    turnBy(clockwise * KEY_DEGREES * (event.shiftKey ? 4 : 1));
  } else if (event.key === "PageUp" || event.key === "PageDown") {
    event.preventDefault();
    state.ms += (event.key === "PageUp" ? 1 : -1) * 86_400_000;
    turned();
    keep();
  }
});
$("#pl-earlier").addEventListener("click", () => {
  state.ms -= 3_600_000;
  turned();
  keep();
});
$("#pl-later").addEventListener("click", () => {
  state.ms += 3_600_000;
  turned();
  keep();
});
const setMoment = (): void => {
  const ms = parseMoment($<HTMLInputElement>("#pl-date").value, $<HTMLInputElement>("#pl-time").value);
  if (ms === undefined) return;
  state.ms = ms;
  turned();
  keep();
};
for (const id of ["#pl-date", "#pl-time"]) for (const type of ["input", "change"]) $(id).addEventListener(type, setMoment);
const setLatitude = (final: boolean): void => {
  const box = $<HTMLInputElement>("#pl-latitude");
  const value = Number(box.value);
  if (box.value === "" || !Number.isFinite(value) || (!final && (value < 20 || value > 70))) return;
  state.latitude = clampLatitude(value);
  if (final) box.value = String(state.latitude);
  buildScene();
  keep();
};
$("#pl-latitude").addEventListener("input", () => setLatitude(false));
$("#pl-latitude").addEventListener("change", () => setLatitude(true));
$("#pl-hemisphere").addEventListener("click", (event) => {
  const value = (event.target as HTMLElement).closest("button")?.dataset["value"];
  if (value === undefined) return;
  state.south = value === "s";
  buildScene();
  keep();
});
document.addEventListener("hoshi-language", buildScene);
buildScene();
