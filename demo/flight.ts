// The flight page: fly from the Sun to a star and back. Choose a place and Go; Look at the Sun turns to it from wherever the flight is; Back to the Sun flies home. The address is read as text:
//   ?at=hr-7001        where the camera is: a place's id (sun, hr-7001 Vega, gctp-3278 Proxima Centauri, M31) or a point in parsecs (pc_1.5_-2_0.25); the page keeps it up to date at each stop
//   &lang=ja           the words in Japanese
// Everything drawn is the package's <hoshi-flight> (src/flight-element.ts); this file is the page around it, and calls its `goTo(id)` and `lookAt(id)` as a site would.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import "../src/flight-define.ts";
import { setThreeLoader, type FlightChange, type FlightStatus, type HoshiFlightElement } from "../src/flight-element.ts";
import { flightPlaceById, flightPlaces, type FlightPlace } from "../src/flight-places.ts";
import { starByHr } from "../src/stars.ts";
import { distanceText, fill, FLIGHT_WORDS, lightTimeText, speedText, type FlightLang, type FlightWords } from "./flight-text.ts";
import { frameCredit } from "./frame-credit.ts";

const address = createAddressState({ defaults: { at: "sun" } });
const lang: FlightLang = new URLSearchParams(location.search).get("lang") === "ja" ? "ja" : "en";
const words: FlightWords = FLIGHT_WORDS[lang];
document.documentElement.lang = lang;
frameCredit(lang === "ja");
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

const nameOf = (place: FlightPlace): string => {
  if (place.id === "sun") return words.sun;
  const hr = /^hr-(\d+)$/.exec(place.id);
  const star = hr === null ? undefined : starByHr(Number(hr[1]));
  return (lang === "ja" ? star?.nameJa : undefined) ?? place.name ?? place.id;
};

for (const [id, text] of [["fl-title", words.title], ["fl-to-label", words.to], ["fl-go", words.go], ["fl-sun", words.lookSun], ["fl-home", words.home], ["fl-slower", words.slower], ["fl-faster", words.faster], ["fl-note", words.note]] as const) $(id).textContent = text;

// The Sun, Vega and the package's short list, nearest first.
const places = [flightPlaceById("sun")!, flightPlaceById("hr-7001")!, ...flightPlaces()].sort((a, b) => a.lightYears - b.lightYears);
const select = $<HTMLSelectElement>("fl-to");
for (const place of places) select.append(Object.assign(document.createElement("option"), { value: place.id, textContent: place.id === "sun" ? nameOf(place) : `${nameOf(place)} (${distanceText(place.lightYears / 3.261563777, lang)})` }));

function show(status: FlightStatus): void {
  const resting = status.place;
  const said = (place: FlightPlace): string => (place.id === "sun" ? words.theSun : nameOf(place));
  $("fl-where").textContent = resting !== undefined ? fill(words.at, { name: said(resting) }) : status.target !== undefined ? fill(words.flying, { name: said(status.target) }) : words.between;
  const fromSun = Math.hypot(status.position.x, status.position.y, status.position.z);
  const lines = [fill(words.fromSun, { d: distanceText(fromSun, lang), t: lightTimeText(fromSun, lang) })];
  if (status.target !== undefined && status.remaining !== undefined) lines.push(fill(words.toGo, { d: distanceText(status.remaining, lang), v: speedText(status.speed, lang) }));
  $("fl-readout").textContent = lines.join(" ");
  $("fl-dial").textContent = fill(words.dial, { v: speedText(status.dial, lang) });
  document.documentElement.dataset.at = status.at;
  document.documentElement.dataset.moving = String(status.moving);
  // The address is where the camera stopped, not every step of the way there.
  if (!status.moving && (address.get("at") ?? "sun") !== status.at) address.set("at", status.at === "sun" ? null : status.at);
}

// The page's own cut of three.js, which the other 3D pages share.
setThreeLoader(() => import("./three-subset.ts"));
const flight = document.createElement("hoshi-flight") as HoshiFlightElement;
flight.dataset.testid = "fl-stage";
flight.setAttribute("lang", lang);
flight.setAttribute("at", address.get("at") ?? "sun");
flight.addEventListener("hoshi-flight", (event) => show((event as CustomEvent<FlightChange>).detail));
$("fl-art").append(flight);
show(flight.status);
select.value = flight.status.place?.id ?? "sun";
if (select.value === "sun") select.value = "hr-7001";
$("fl-go").addEventListener("click", () => flight.goTo(select.value));
$("fl-sun").addEventListener("click", () => flight.lookAt("sun"));
$("fl-home").addEventListener("click", () => flight.goTo("sun"));
$("fl-slower").addEventListener("click", () => flight.stepSpeed(-1));
$("fl-faster").addEventListener("click", () => flight.stepSpeed(1));
document.documentElement.dataset.ready = "true";
