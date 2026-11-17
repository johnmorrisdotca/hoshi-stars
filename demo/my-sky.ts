// The my sky page: the `<hoshi-my-sky>` element under a few choices, a city or your own location or any latitude and longitude, and the moment (now, live, or a time you give). The place and the moment are in the address
// (a city by name, the numbers when typed); your own location never is. The element's own words, the Moon's panel and the compass, follow the page's language.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { constellation } from "../src/constellations.ts";
import "../src/my-sky/define.ts";
import type { HoshiMySkyElement, MySkyMarkDetail } from "../src/my-sky/element.ts";
import { mySkyWords } from "../src/my-sky/words.ts";
import { starByName } from "../src/stars.ts";
import { WORDS } from "../scripts/page-words.ts";

type Lang = "en" | "ja";
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const lang = (): Lang => (document.documentElement.lang === "ja" ? "ja" : "en");
const say = (key: string): string => (WORDS[lang()] as Record<string, string>)[key] ?? key;
const address = createAddressState({ defaults: {} });

/** The places to start from: a city on each side of the equator and on each side of the date line, and one near the Arctic Circle. */
const PLACES = [
  { id: "vancouver", lat: 49.28, lon: -123.12 },
  { id: "tokyo", lat: 35.68, lon: 139.69 },
  { id: "sydney", lat: -33.87, lon: 151.21 },
  { id: "london", lat: 51.51, lon: -0.13 },
  { id: "capetown", lat: -33.92, lon: 18.42 },
  { id: "reykjavik", lat: 64.15, lon: -21.94 },
] as const;

/** What "See it in my sky" can turn to: a kind, then one of its choices. A star's id is the one the names index gives, a constellation's its abbreviation. Acrux and the Southern Cross never rise in Vancouver and Polaris never sets: the choices show each state. */
const KINDS = ["star", "constellation", "planet", "moon", "sun"] as const;
type Kind = (typeof KINDS)[number];
const STARS = ["sirius", "betelgeuse", "rigel", "vega", "polaris", "arcturus", "antares", "acrux"] as const;
const CONSTELLATIONS = ["Ori", "UMa", "Cas", "Cyg", "Sco", "Cru"] as const;
const PLANETS = ["mercury", "venus", "mars", "jupiter", "saturn"] as const;

/** The three sample marks the page puts on the sky to show `marks`: fixed points, said to be samples. */
const SAMPLE_MARKS = (): Array<{ id: string; azimuth: number; altitude: number; label: string; kind?: string }> => [
  { id: "sample-satellite", azimuth: 200, altitude: 45, label: say("ms_markSatellite"), kind: "satellite" },
  { id: "sample-tower", azimuth: 100, altitude: 8, label: say("ms_markTower") },
  { id: "sample-below", azimuth: 300, altitude: -8, label: say("ms_markBelow") },
];

const sky = $<HoshiMySkyElement>("#sky");
const latInput = $<HTMLInputElement>("#lat");
const lonInput = $<HTMLInputElement>("#lon");
const momentInput = $<HTMLInputElement>("#moment");

const parsedTime = Date.parse(address.get("t") ?? "");
const state: { place: string; lat: number; lon: number; t: number | null; here: boolean; kind: Kind | null; target: string | null; marks: boolean } = { place: address.get("place") ?? "vancouver", lat: 49.28, lon: -123.12, t: Number.isFinite(parsedTime) ? parsedTime : null, here: false, kind: null, target: null, marks: false };
const named = PLACES.find((p) => p.id === state.place);
if (named !== undefined) ({ lat: state.lat, lon: state.lon } = named);
else if (Number.isFinite(Number(address.get("lat"))) && address.get("lat") !== null && Number.isFinite(Number(address.get("lon"))) && address.get("lon") !== null) {
  state.place = "";
  state.lat = Number(address.get("lat"));
  state.lon = Number(address.get("lon"));
} else state.place = "vancouver";

const pad = (n: number): string => String(n).padStart(2, "0");
const localInput = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function fillPlaces(): void {
  $("#places").replaceChildren(
    ...PLACES.map((p) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(state.place === p.id));
      button.dataset.place = p.id;
      button.textContent = say(`ms_${p.id}`);
      button.addEventListener("click", () => {
        state.place = p.id;
        state.lat = p.lat;
        state.lon = p.lon;
        state.here = false;
        render();
{
  const asked = address.get("target");
  state.kind = asked === null ? null : kindOf(asked);
  state.target = state.kind === null ? null : asked;
  fillLook();
  if (state.target !== null) sky.target = state.target;
  fillMarks();
}
      });
      return button;
    }),
  );
}

function render(): void {
  fillPlaces();
  latInput.value = String(state.lat);
  lonInput.value = String(state.lon);
  momentInput.value = state.t === null ? localInput(Date.now()) : localInput(state.t);
  sky.setAttribute("latitude", String(state.lat));
  sky.setAttribute("longitude", String(state.lon));
  if (state.t === null) sky.removeAttribute("time");
  else sky.setAttribute("time", new Date(state.t).toISOString());
  sky.setAttribute("aria-label", say("ms_frame"));
  address.set("place", state.place === "" || state.here ? null : state.place);
  address.set("lat", state.place === "" && !state.here ? String(state.lat) : null);
  address.set("lon", state.place === "" && !state.here ? String(state.lon) : null);
  address.set("t", state.t === null ? null : new Date(state.t).toISOString().slice(0, 16) + "Z");
}

/** The kind a target text belongs to, for the row of choices. */
function kindOf(target: string): Kind | null {
  if (target === "moon" || target === "sun") return target;
  if (target.startsWith("planet:")) return "planet";
  if (target.startsWith("constellation:")) return "constellation";
  return target === "" ? null : "star";
}

/** The name of a choice in the page's language. */
function nameOf(kind: Kind, id: string): string {
  const words = mySkyWords(lang());
  if (kind === "planet") return words.planet[id as keyof typeof words.planet];
  if (kind === "constellation") {
    const found = constellation(id);
    return found === undefined ? id : lang() === "ja" ? found.japanese : found.name;
  }
  const star = starByName(id);
  return star === undefined ? id : lang() === "ja" ? (star.nameJa ?? star.name ?? id) : (star.name ?? id);
}

/** The text the element takes for a choice. */
const targetOf = (kind: Kind, id: string): string => (kind === "planet" ? `planet:${id}` : kind === "constellation" ? `constellation:${id}` : id);

function fillLook(): void {
  $("#kinds").replaceChildren(
    ...KINDS.map((kind) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.kind === kind));
      button.dataset.kind = kind;
      button.textContent = say(`ms_look${kind[0]!.toUpperCase()}${kind.slice(1)}`);
      button.addEventListener("click", () => {
        if (kind === "moon" || kind === "sun") look(kind, kind);
        else {
          // a kind with choices opens its row and looks at its first
          const first = kind === "star" ? STARS[0] : kind === "constellation" ? CONSTELLATIONS[0] : PLANETS[0];
          look(kind, targetOf(kind, first));
        }
      });
      return button;
    }),
  );
  const row = $("#choices-row");
  const ids: readonly string[] = state.kind === "star" ? STARS : state.kind === "constellation" ? CONSTELLATIONS : state.kind === "planet" ? PLANETS : [];
  row.hidden = ids.length === 0;
  $("#choices").replaceChildren(
    ...ids.map((id) => {
      const button = document.createElement("button");
      button.type = "button";
      const target = targetOf(state.kind!, id);
      button.setAttribute("aria-pressed", String(state.target === target));
      button.dataset.target = target;
      button.textContent = nameOf(state.kind!, id);
      button.addEventListener("click", () => look(state.kind!, target));
      return button;
    }),
  );
}

/** Turn the sky to something: the element glides there and rings it; the address keeps it. */
function look(kind: Kind | null, target: string | null): void {
  state.kind = kind;
  state.target = target;
  address.set("target", target);
  fillLook();
  sky.target = target;
}

function fillMarks(): void {
  const button = $("#marks");
  button.setAttribute("aria-pressed", String(state.marks));
  button.textContent = say(state.marks ? "ms_marksHide" : "ms_marksShow");
  sky.marks = state.marks ? SAMPLE_MARKS() : [];
  if (!state.marks) $("#mark-note").textContent = "";
  else if ($("#mark-note").textContent === "") $("#mark-note").textContent = say("ms_markFine");
}

function typed(): void {
  const lat = Number(latInput.value);
  const lon = Number(lonInput.value);
  if (latInput.value === "" || lonInput.value === "" || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) return;
  state.place = "";
  state.here = false;
  state.lat = lat;
  state.lon = lon;
  render();
{
  const asked = address.get("target");
  state.kind = asked === null ? null : kindOf(asked);
  state.target = state.kind === null ? null : asked;
  fillLook();
  if (state.target !== null) sky.target = state.target;
  fillMarks();
}
}
latInput.addEventListener("change", typed);
lonInput.addEventListener("change", typed);
momentInput.addEventListener("change", () => {
  const ms = new Date(momentInput.value).getTime();
  if (Number.isFinite(ms)) {
    state.t = ms;
    render();
{
  const asked = address.get("target");
  state.kind = asked === null ? null : kindOf(asked);
  state.target = state.kind === null ? null : asked;
  fillLook();
  if (state.target !== null) sky.target = state.target;
  fillMarks();
}
  }
});
$("#now").addEventListener("click", () => {
  state.t = null;
  render();
{
  const asked = address.get("target");
  state.kind = asked === null ? null : kindOf(asked);
  state.target = state.kind === null ? null : asked;
  fillLook();
  if (state.target !== null) sky.target = state.target;
  fillMarks();
}
});
$("#reset").addEventListener("click", () => {
  sky.removeAttribute("heading");
  sky.setView({ heading: sky.latitude !== undefined && sky.latitude < 0 ? 0 : 180, pitch: 35, fov: 90 });
});
$("#here").addEventListener("click", () => {
  $("#where-note").textContent = say("ms_hereNote");
  navigator.geolocation?.getCurrentPosition(
    (position) => {
      state.place = "";
      state.here = true;
      state.lat = Math.round(position.coords.latitude * 100) / 100;
      state.lon = Math.round(position.coords.longitude * 100) / 100;
      render();
{
  const asked = address.get("target");
  state.kind = asked === null ? null : kindOf(asked);
  state.target = state.kind === null ? null : asked;
  fillLook();
  if (state.target !== null) sky.target = state.target;
  fillMarks();
}
    },
    () => {
      $("#where-note").textContent = say("ms_hereFail");
    },
  );
});
$("#look-clear").addEventListener("click", () => look(null, null));
$("#marks").addEventListener("click", () => {
  state.marks = !state.marks;
  fillMarks();
});
sky.addEventListener("hoshi-sky-mark", (event) => {
  const { id, label } = (event as CustomEvent<MySkyMarkDetail>).detail;
  $("#mark-note").textContent = say("ms_markPressed").replace("{label}", label).replace("{id}", id);
});
document.addEventListener("hoshi-language", () => {
  fillPlaces();
  fillLook();
  fillMarks();
  if ($("#where-note").textContent !== "") $("#where-note").textContent = say("ms_hereNote");
});
render();
{
  const asked = address.get("target");
  state.kind = asked === null ? null : kindOf(asked);
  state.target = state.kind === null ? null : asked;
  fillLook();
  if (state.target !== null) sky.target = state.target;
  fillMarks();
}
