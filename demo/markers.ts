// The markers page: your own dated points on <hoshi-chart>, a two-handle slider for the days shown with Play, a card for the marker you choose, and CSV or JSON in and out. The points live in this page
// and nothing is sent anywhere (the page's content security policy allows no connection). Dates and times are shown in the reader's own calendar and zone.
//   ?lang=ja   the page's words in Japanese
import "../src/chart/define.ts";
import type { HoshiChartElement, ChartMarkerDetail } from "../src/chart/element.ts";
import { markerSpan, markersFromCsv, markersToCsv, markerTime, normaliseMarkers, visibleMarkers, type SkyMarker } from "../src/chart/markers.ts";
import { addDays, dayStart, daysBetween, windowOf } from "./markers-days.ts";
import { sampleMarkers } from "./markers-sample.ts";

const ja = new URLSearchParams(location.search).get("lang") === "ja";
document.documentElement.lang = ja ? "ja" : "en";
const locale = ja ? "ja-JP" : "en-CA";
/** The days a marker takes to come in from an edge of the range. */
const FADE_DAYS = 1;
/** The days the Play window opens with when the whole range is shown. */
const PLAY_WINDOW = 3;
const STEP_MS = 700;

const WORDS = {
  en: {
    title: "Your own points on the chart",
    intro: "An observing log and a comet's track, as the sample. Drag the two handles to choose the days shown, press Play to watch them go by, and click or press Enter on a point for its card. Everything stays in this page: nothing is sent anywhere.",
    days: "Days shown",
    from: "First day shown",
    to: "Last day shown",
    play: "Play",
    pause: "Pause",
    tracks: "Join each group with a line",
    count: (shown: number, all: number) => `${shown} of ${all} points shown`,
    cardHint: "Click a point, or Tab to one and press Enter, for its card.",
    when: "When",
    group: "Group",
    place: "Place",
    ra: "RA",
    dec: "Dec",
    importText: "Import CSV or JSON",
    exportCsv: "Export CSV",
    exportJson: "Export JSON",
    sample: "Back to the sample",
    columns: "CSV columns: id, ra, dec, date, label, color, size, group (ra and dec in degrees; date as 2026-11-08 or 2026-11-08T21:30; a date with no time is taken as noon, your time). JSON is a list of the same fields.",
    imported: (n: number, name: string) => `Read ${n} points from ${name}.`,
    none: (name: string) => `No points found in ${name}: it needs ra and dec columns (CSV) or a list with ra and dec (JSON).`,
    unreadable: (name: string) => `Could not read ${name}.`,
    exported: (n: number, name: string) => `Saved ${n} points as ${name}.`,
    sampleBack: "The sample is back.",
    label: "Marker card",
  },
  ja: {
    title: "自分の点を星図に置く",
    intro: "見本は、星を見た日の記録と、彗星の通り道です。2つのつまみを動かして表示する日を選び、再生で日々の移り変わりを見られます。点をクリックするかEnterを押すと、その点のカードが出ます。すべてこのページの中だけで、どこにも送りません。",
    days: "表示する日",
    from: "表示する最初の日",
    to: "表示する最後の日",
    play: "再生",
    pause: "一時停止",
    tracks: "グループごとに線でつなぐ",
    count: (shown: number, all: number) => `${all}点のうち${shown}点を表示`,
    cardHint: "点をクリックするか、Tabで点に移ってEnterを押すと、カードが出ます。",
    when: "日時",
    group: "グループ",
    place: "位置",
    ra: "赤経",
    dec: "赤緯",
    importText: "CSVかJSONを読み込む",
    exportCsv: "CSVで書き出す",
    exportJson: "JSONで書き出す",
    sample: "見本に戻す",
    columns: "CSVの列：id、ra、dec、date、label、color、size、group（raとdecは度。dateは2026-11-08か2026-11-08T21:30の形で、時刻がない日付は、その人の時刻の正午とみなします）。JSONは同じ項目の並びです。",
    imported: (n: number, name: string) => `${name}から${n}点を読み込みました。`,
    none: (name: string) => `${name}に点が見つかりません。CSVならraとdecの列、JSONならraとdecを持つ並びが必要です。`,
    unreadable: (name: string) => `${name}を読めませんでした。`,
    exported: (n: number, name: string) => `${n}点を${name}として保存しました。`,
    sampleBack: "見本に戻しました。",
    label: "点のカード",
  },
} as const;
const say = ja ? WORDS.ja : WORDS.en;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const chart = $<HoshiChartElement>("chart");
const from = $<HTMLInputElement>("from");
const to = $<HTMLInputElement>("to");
const play = $<HTMLButtonElement>("play");
const tracks = $<HTMLInputElement>("tracks");
const card = $("card");
const message = $("message");

const set = (id: string, text: string): void => {
  $(id).textContent = text;
};
set("title", say.title);
set("intro", say.intro);
set("time-label", say.days);
set("tracks-label", say.tracks);
set("import-text", say.importText);
set("export-csv", say.exportCsv);
set("export-json", say.exportJson);
set("sample", say.sample);
set("columns", say.columns);
document.title = ja ? "星 (Hoshi): 自分の点を星図に" : "Hoshi Stars: your own points on the chart";
from.setAttribute("aria-label", say.from);
to.setAttribute("aria-label", say.to);
card.setAttribute("aria-label", say.label);
chart.setAttribute("aria-label", ja ? "自分の点を置いた星図" : "A sky chart with your own points");

let markers: SkyMarker[] = [];
let origin = 0;
let last = 0;
let hasDates = false;
let timer = 0;

const dayText = (index: number): string => new Date(addDays(dayStart(origin), index)).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });

/** A marker's moment as the reader reads it: their own calendar and zone. */
const whenText = (marker: SkyMarker): string => {
  const ms = markerTime(marker.date);
  return ms === undefined ? "" : new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
};

const showCard = (detail?: ChartMarkerDetail): void => {
  card.replaceChildren();
  if (detail === undefined) {
    const hint = document.createElement("p");
    hint.textContent = say.cardHint;
    card.append(hint);
    return;
  }
  const { marker } = detail;
  const title = document.createElement("h2");
  title.textContent = marker.label ?? detail.id;
  const list = document.createElement("dl");
  const row = (name: string, value: string): void => {
    if (value === "") return;
    const dt = document.createElement("dt");
    dt.textContent = name;
    const dd = document.createElement("dd");
    dd.textContent = value;
    list.append(dt, dd);
  };
  row(say.when, whenText(marker));
  row(say.group, marker.group ?? "");
  row(say.place, `${say.ra} ${marker.ra.toFixed(2)}°, ${say.dec} ${marker.dec.toFixed(2)}°`);
  card.append(title, list);
};

function apply(): void {
  const a = Number(from.value);
  const b = Number(to.value);
  set("from-out", hasDates ? dayText(a) : "");
  set("to-out", hasDates ? dayText(b) : "");
  from.setAttribute("aria-valuetext", dayText(a));
  to.setAttribute("aria-valuetext", dayText(b));
  const max = Math.max(1, last);
  const fill = $("fill");
  fill.style.left = `calc(11px + (100% - 22px) * ${a / max})`;
  fill.style.width = `calc((100% - 22px) * ${(b - a) / max})`;
  const range = hasDates ? windowOf(origin, a, b, FADE_DAYS) : undefined;
  chart.timeRange = range;
  set("count", say.count(visibleMarkers(markers, range).length, visibleMarkers(markers).length));
}

function stop(): void {
  window.clearInterval(timer);
  timer = 0;
  play.textContent = say.play;
  play.setAttribute("aria-pressed", "false");
}

function start(): void {
  if (!hasDates || last < 1) return;
  if (Number(from.value) === 0 && Number(to.value) === last) to.value = String(Math.min(last, PLAY_WINDOW - 1));
  play.textContent = say.pause;
  play.setAttribute("aria-pressed", "true");
  apply();
  timer = window.setInterval(() => {
    if (document.hidden) return;
    if (Number(to.value) >= last) return stop();
    from.value = String(Number(from.value) + 1);
    to.value = String(Number(to.value) + 1);
    apply();
  }, STEP_MS);
}

/** Take a list of markers: the slider spans their dates, the whole range is shown, and the chart looks at the middle of them. */
function load(list: SkyMarker[], look: boolean): void {
  stop();
  markers = list;
  chart.markers = markers;
  const span = markerSpan(markers);
  hasDates = span !== undefined;
  origin = span?.from ?? 0;
  last = span === undefined ? 0 : daysBetween(span.from, span.to);
  for (const input of [from, to]) {
    input.max = String(last);
    input.disabled = !hasDates || last === 0;
  }
  from.value = "0";
  to.value = String(last);
  play.disabled = !hasDates || last === 0;
  showCard();
  apply();
  if (look && markers.length > 0) {
    // the middle of the points, on the sphere
    let x = 0;
    let y = 0;
    let z = 0;
    for (const marker of markers) {
      const ra = (marker.ra * Math.PI) / 180;
      const dec = (marker.dec * Math.PI) / 180;
      x += Math.cos(dec) * Math.cos(ra);
      y += Math.cos(dec) * Math.sin(ra);
      z += Math.sin(dec);
    }
    chart.setView({ ra: (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360, dec: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI });
  }
}

from.addEventListener("input", () => {
  if (Number(from.value) > Number(to.value)) to.value = from.value;
  apply();
});
to.addEventListener("input", () => {
  if (Number(to.value) < Number(from.value)) from.value = to.value;
  apply();
});
play.addEventListener("click", () => (timer === 0 ? start() : stop()));
tracks.addEventListener("change", () => {
  chart.tracks = tracks.checked;
});
chart.addEventListener("hoshi-marker", (event) => showCard((event as CustomEvent<ChartMarkerDetail>).detail));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
window.addEventListener("pagehide", stop);

/** A date with no time is a day of the reader's own, not midnight UTC: it is read as noon, their time. */
const localDays = (list: SkyMarker[]): SkyMarker[] => list.map((marker) => (typeof marker.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(marker.date.trim()) ? { ...marker, date: `${marker.date.trim()}T12:00:00` } : marker));

const download = (name: string, type: string, text: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("export-csv").addEventListener("click", () => {
  download("hoshi-markers.csv", "text/csv", markersToCsv(markers));
  message.textContent = say.exported(markers.length, "hoshi-markers.csv");
});
$("export-json").addEventListener("click", () => {
  download("hoshi-markers.json", "application/json", `${JSON.stringify(markers, null, 2)}\n`);
  message.textContent = say.exported(markers.length, "hoshi-markers.json");
});
$("sample").addEventListener("click", () => {
  load(sampleMarkers(ja, new Date().getFullYear()), true);
  message.textContent = say.sampleBack;
});
const picker = $<HTMLInputElement>("import");
picker.addEventListener("change", async () => {
  const file = picker.files?.[0];
  picker.value = "";
  if (file === undefined) return;
  let list: SkyMarker[];
  try {
    const text = await file.text();
    if (text.trim().startsWith("[") || text.trim().startsWith("{")) {
      const json: unknown = JSON.parse(text);
      list = normaliseMarkers(Array.isArray(json) ? json : (json as { markers?: unknown }).markers);
    } else list = markersFromCsv(text);
  } catch {
    message.textContent = say.unreadable(file.name);
    return;
  }
  if (list.length === 0) {
    message.textContent = say.none(file.name);
    return;
  }
  load(localDays(list), true);
  message.textContent = say.imported(list.length, file.name);
});

chart.tracks = tracks.checked;
play.textContent = say.play;
load(sampleMarkers(ja, new Date().getFullYear()), false);
