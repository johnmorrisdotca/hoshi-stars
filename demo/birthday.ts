// The sky on your birthday: pick a day and see which constellation the Sun was really in, on a chart of the stars around it, with the days it went in and came out, and the Sun's whole
// path that year. Real astronomy only. It opens moving (John's rule, MODULES-817): from today the Sun steps on a day at a time, four days a second, with the date running with it. A date
// in the address (date=2026-03-12) holds it there, and a reader's Pause or pick writes one. A reader who prefers reduced motion gets it still, with Play ready. All days are the reader's own.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import type { Constellation } from "../src/constellations.ts";
import { chart, toScreen, type View } from "../src/chart/chart.ts";
import { eclipticPoint, sunOnChart, sunStay, sunYear } from "./sun.ts";
import { langNow, nameIn } from "./thumbs.ts";
import { say } from "./words.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const address = createAddressState();
const DAY = 86_400_000;
const STEP_MS = 250;

/** Noon on a day of the reader's own calendar, so the day's Sun is the middle of their day. */
const noonOf = (y: number, m: number, d: number): number => new Date(y, m - 1, d, 12).getTime();
const dayText = (ms: number): string => {
  const at = new Date(ms);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
};
const fromText = (text: string | null): number | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? "");
  if (match === null) return undefined;
  const ms = noonOf(Number(match[1]), Number(match[2]), Number(match[3]));
  return Number.isNaN(ms) || dayText(ms) !== text ? undefined : ms;
};
const today = (): number => {
  const now = new Date();
  return noonOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
};
const longDate = (ms: number, year = true): string =>
  new Date(ms).toLocaleDateString(langNow() === "ja" ? "ja-JP" : "en-GB", year ? { year: "numeric", month: "long", day: "numeric" } : { month: "long", day: "numeric" });
const named = (c: Constellation): string => nameIn(c, langNow());
const escapeXml = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

let shown = fromText(address.get("date")) ?? today();
let playing = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let inSight = true;

const input = $<HTMLInputElement>("bd-date");
const play = $<HTMLButtonElement>("bd-play");
const svg = $("bd-sky");

function drawSky(stay: ReturnType<typeof sunStay>): void {
  const box = $("bd-box");
  const width = Math.max(280, Math.round(box.clientWidth));
  const height = Math.round(width < 600 ? width : Math.min(520, width * 0.55));
  const sun = sunOnChart(shown);
  const half = width < 600 ? 30 : 40;
  const view: View = { projection: "stereographic", ra: sun.rightAscension, dec: sun.declination, zoom: 1 };
  const edge = toScreen(view, width, height, { rightAscension: sun.rightAscension + half / Math.max(0.2, Math.cos((sun.declination * Math.PI) / 180)), declination: sun.declination });
  view.zoom = edge === undefined ? 3 : Math.max(1, (width / 2 / Math.abs(edge[0] - width / 2)) * 1);
  const at = toScreen(view, width, height, sun)!;
  const lang = langNow();
  const sunWord = say("bd_sun");
  const keepClear = [{ x0: at[0] - 14, y0: at[1] - 34, x1: at[0] + 14 + sunWord.length * 9, y1: at[1] + 14 }];
  const drawn = chart({ ...view, width, height, magnitude: 5, layers: new Set(["lines", "boundaries", "names"]), lang, highlight: stay.constellation.abbreviation, keepClear });
  // the Sun's yearly path among the stars, the ecliptic, from 70 degrees behind it to 70 ahead
  const longitude = Math.atan2(Math.sin((sun.rightAscension * Math.PI) / 180) * Math.cos(0.4090928) + Math.tan((sun.declination * Math.PI) / 180) * Math.sin(0.4090928), Math.cos((sun.rightAscension * Math.PI) / 180)) * (180 / Math.PI);
  let path = "";
  for (let l = longitude - 70; l <= longitude + 70; l += 2) {
    const p = toScreen(view, width, height, eclipticPoint(l));
    if (p !== undefined) path += `${path === "" ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  }
  const ecliptic = `<path d="${path}" fill="none" stroke="#e0b43b" stroke-width="1.5" stroke-dasharray="1 5" stroke-linecap="round" stroke-opacity=".9"/>`;
  const sunMark = `<circle cx="${at[0].toFixed(1)}" cy="${at[1].toFixed(1)}" r="16" fill="#ffd86b" fill-opacity=".18"/><circle cx="${at[0].toFixed(1)}" cy="${at[1].toFixed(1)}" r="8" fill="#ffd86b" data-testid="bd-sun"/>`;
  const sunLabel = `<text x="${(at[0] + 14).toFixed(1)}" y="${(at[1] - 14).toFixed(1)}" font-size="14" font-weight="700" fill="#ffe49a" stroke="#0b1020" stroke-width="3" paint-order="stroke" font-family="system-ui, sans-serif">${escapeXml(sunWord)}</text>`;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.innerHTML = drawn.svg + ecliptic + sunMark + sunLabel;
  svg.setAttribute("aria-label", say("bd_skyLabel", { date: longDate(shown), name: named(stay.constellation) }));
}

let yearFor = "";
function drawYear(stay: ReturnType<typeof sunStay>): void {
  const year = new Date(shown).getFullYear();
  const key = `${year}|${langNow()}`;
  const list = $("bd-year");
  if (key !== yearFor) {
    yearFor = key;
    const entries = sunYear(year).slice(1);
    $("bd-year-title").textContent = say("bd_yearTitle", { year, n: new Set(entries.map((one) => one.constellation.abbreviation)).size });
    list.replaceChildren(
      ...entries.map((one) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "fam-button bd-step";
        button.dataset["c"] = one.constellation.abbreviation;
        button.dataset["entered"] = String(one.entered);
        const name = document.createElement("span");
        name.className = "bd-step-name";
        name.textContent = named(one.constellation);
        const from = document.createElement("span");
        from.className = "bd-step-from";
        from.textContent = say("bd_since", { date: longDate(one.entered, false) });
        button.append(name, from);
        button.addEventListener("click", () => {
          const entered = new Date(one.entered + DAY);
          hold(noonOf(entered.getFullYear(), entered.getMonth() + 1, entered.getDate()));
        });
        return button;
      }),
    );
  }
  list.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const entered = Number(button.dataset["entered"]);
    button.setAttribute("aria-pressed", String(button.dataset["c"] === stay.constellation.abbreviation && entered <= stay.left && entered >= stay.entered - DAY));
  });
}

function render(): void {
  const stay = sunStay(shown);
  if (document.activeElement !== input) input.value = dayText(shown);
  $("bd-answer").textContent = say("bd_answer", { date: longDate(shown), name: named(stay.constellation) });
  $("bd-stay").textContent = say("bd_stay", { name: named(stay.constellation), entered: longDate(stay.entered), left: longDate(stay.left) });
  play.textContent = say(playing ? "bd_pause" : "bd_play");
  play.setAttribute("aria-pressed", String(playing));
  document.title = say("bd_title");
  drawSky(stay);
  drawYear(stay);
}

/** One step on: a day, four times a second, only while it is playing and the page's part with the date and the chart is in sight. */
function schedule(): void {
  if (timer !== undefined || !playing || !inSight || document.hidden) return;
  timer = setTimeout(() => {
    timer = undefined;
    if (!playing || !inSight || document.hidden) return;
    const next = new Date(shown + DAY);
    shown = noonOf(next.getFullYear(), next.getMonth() + 1, next.getDate());
    render();
    schedule();
  }, STEP_MS);
}
function stop(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}
function setPlaying(on: boolean): void {
  playing = on;
  if (on) {
    address.set("date", null);
    schedule();
  } else {
    stop();
    address.set("date", dayText(shown));
  }
  render();
}
/** Show one day, held still. */
function hold(ms: number): void {
  shown = ms;
  setPlaying(false);
}

play.addEventListener("click", () => setPlaying(!playing));
$("bd-today").addEventListener("click", () => {
  shown = today();
  if (playing) render();
  else hold(shown);
});
input.addEventListener("change", () => {
  const ms = fromText(input.value);
  if (ms !== undefined) hold(ms);
});
document.addEventListener("visibilitychange", schedule);
new IntersectionObserver((entries) => {
  inSight = entries.some((entry) => entry.isIntersecting);
  schedule();
}).observe(document.querySelector(".bday")!);
let lastWidth = 0;
new ResizeObserver(() => {
  const width = Math.round($("bd-box").clientWidth);
  if (width === lastWidth) return;
  lastWidth = width;
  render();
}).observe($("bd-box"));
address.subscribe(({ source }) => {
  if (source !== "navigation") return;
  const held = fromText(address.get("date"));
  if (held !== undefined) {
    shown = held;
    playing = false;
    stop();
  }
  render();
});
document.addEventListener("hoshi-language", render);

playing = address.get("date") === null && !matchMedia("(prefers-reduced-motion: reduce)").matches;
render();
schedule();
