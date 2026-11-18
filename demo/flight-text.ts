// The words of the flight page, in English and Japanese, and its figures: a distance in the unit that suits it, the time light takes, a speed in multiples of light's.
import { flightReadout } from "../src/flight.ts";

export type FlightLang = "en" | "ja";

export const FLIGHT_WORDS = {
  en: {
    title: "A flight through the stars",
    to: "Go to",
    go: "Go",
    lookSun: "Look at the Sun",
    home: "Back to the Sun",
    slower: "Slower",
    faster: "Faster",
    dial: "Speed: {v} × the speed of light",
    at: "At {name}.",
    flying: "Flying to {name}.",
    between: "Between the stars.",
    fromSun: "{d} from the Sun. Light takes {t} to come this far.",
    toGo: "{d} to go, at {v} × the speed of light.",
    sun: "Sun",
    theSun: "the Sun",
    km: "km",
    au: "au",
    ly: "light-years",
    seconds: "seconds",
    minutes: "minutes",
    hours: "hours",
    days: "days",
    years: "years",
    note: "Each star is drawn where it would be seen from here, worked out from its measured distance, so a star with no measured distance is left out. Beside the Sun or a bright star you see it as a ball; a nearby star with no radius here stays a point, and galaxies and clusters are not drawn yet.",
  },
  ja: {
    title: "星の間を飛ぶ",
    to: "行き先",
    go: "行く",
    lookSun: "太陽を見る",
    home: "太陽にもどる",
    slower: "おそく",
    faster: "はやく",
    dial: "速さ: 光の速さの {v} 倍",
    at: "{name} にいます。",
    flying: "{name} へ飛んでいます。",
    between: "星の間にいます。",
    fromSun: "太陽から {d}。光でも {t} かかります。",
    toGo: "あと {d}。光の速さの {v} 倍。",
    sun: "太陽",
    theSun: "太陽",
    km: "km",
    au: "天文単位",
    ly: "光年",
    seconds: "秒",
    minutes: "分",
    hours: "時間",
    days: "日",
    years: "年",
    note: "星は、はかった距離から計算して、ここから見える場所にかいています。距離がわからない星はかいていません。太陽や明るい星のそばでは球に見えます。半径がわからない近くの星は点のままで、銀河や星団はまだかいていません。",
  },
} as const;

export type FlightWords = { [K in keyof (typeof FLIGHT_WORDS)["en"]]: string };

export const fill = (text: string, values: Record<string, string>): string => text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

const figure = (value: number, lang: FlightLang): string => new Intl.NumberFormat(lang, { maximumSignificantDigits: 3 }).format(value);

/** A length in parsecs, in kilometres, astronomical units or light-years as `flightReadout` says suits it. */
export function distanceText(parsecs: number, lang: FlightLang): string {
  const words = FLIGHT_WORDS[lang];
  const readout = flightReadout({ x: parsecs, y: 0, z: 0 });
  if (readout.scale === "kilometres") return `${figure(readout.kilometres, lang)} ${words.km}`;
  if (readout.scale === "astronomical-units") return `${figure(readout.astronomicalUnits, lang)} ${words.au}`;
  return `${figure(readout.lightYears, lang)} ${words.ly}`;
}

/** The time light takes to cross a length in parsecs. */
export function lightTimeText(parsecs: number, lang: FlightLang): string {
  const words = FLIGHT_WORDS[lang];
  const seconds = flightReadout({ x: parsecs, y: 0, z: 0 }).lightSeconds;
  if (seconds < 120) return `${figure(seconds, lang)} ${words.seconds}`;
  if (seconds < 7200) return `${figure(seconds / 60, lang)} ${words.minutes}`;
  if (seconds < 172_800) return `${figure(seconds / 3600, lang)} ${words.hours}`;
  if (seconds < 31_557_600) return `${figure(seconds / 86_400, lang)} ${words.days}`;
  return `${figure(seconds / 31_557_600, lang)} ${words.years}`;
}

/** A speed in multiples of light's: `100 million`, `1億`. */
export const speedText = (speed: number, lang: FlightLang): string => new Intl.NumberFormat(lang, { notation: "compact", compactDisplay: "long", maximumSignificantDigits: 2 }).format(speed);
