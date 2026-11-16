// The my sky page: the `<hoshi-my-sky>` element under a few choices, a city or your own location or any latitude and longitude, and the moment (now, live, or a time you give). The place and the moment are in the address
// (a city by name, the numbers when typed); your own location never is. The element's own words, the Moon's panel and the compass, follow the page's language.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import "../src/my-sky/define.ts";
import type { HoshiMySkyElement } from "../src/my-sky/element.ts";
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

const sky = $<HoshiMySkyElement>("#sky");
const latInput = $<HTMLInputElement>("#lat");
const lonInput = $<HTMLInputElement>("#lon");
const momentInput = $<HTMLInputElement>("#moment");

const parsedTime = Date.parse(address.get("t") ?? "");
const state: { place: string; lat: number; lon: number; t: number | null; here: boolean } = { place: address.get("place") ?? "vancouver", lat: 49.28, lon: -123.12, t: Number.isFinite(parsedTime) ? parsedTime : null, here: false };
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

function typed(): void {
  const lat = Number(latInput.value);
  const lon = Number(lonInput.value);
  if (latInput.value === "" || lonInput.value === "" || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) return;
  state.place = "";
  state.here = false;
  state.lat = lat;
  state.lon = lon;
  render();
}
latInput.addEventListener("change", typed);
lonInput.addEventListener("change", typed);
momentInput.addEventListener("change", () => {
  const ms = new Date(momentInput.value).getTime();
  if (Number.isFinite(ms)) {
    state.t = ms;
    render();
  }
});
$("#now").addEventListener("click", () => {
  state.t = null;
  render();
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
    },
    () => {
      $("#where-note").textContent = say("ms_hereFail");
    },
  );
});
document.addEventListener("hoshi-language", () => {
  fillPlaces();
  if ($("#where-note").textContent !== "") $("#where-note").textContent = say("ms_hereNote");
});
render();
