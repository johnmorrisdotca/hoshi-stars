// The words of `<hoshi-my-sky>`, in English and Japanese: the compass, the Moon's phases, the planets and the lines of its panel. Plain text with {name} gaps; `say` fills them. No DOM, no clock.
import type { MoonPhaseName } from "./moon.ts";
import type { NakedEyePlanet } from "./planets.ts";

/**
 * The two languages the element speaks: `en` and `ja`.
 *
 * @example
 * ```ts
 * import type { MySkyLanguage } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const language: MySkyLanguage = "ja";
 * console.log(language);
 * ```
 */
export type MySkyLanguage = "en" | "ja";

/**
 * The compass points the horizon marks, from north round through east, every 45 degrees.
 *
 * @example
 * ```ts
 * import { COMPASS } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(COMPASS.join(" ")); // N NE E SE S SW W NW
 * ```
 */
export const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
/**
 * One of the eight compass points: `N`, `NE`, `E`, `SE`, `S`, `SW`, `W` or `NW`.
 *
 * @example
 * ```ts
 * import type { CompassPoint } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const point: CompassPoint = "SW";
 * console.log(point);
 * ```
 */
export type CompassPoint = (typeof COMPASS)[number];

/**
 * The words of the element in one language.
 *
 * @example
 * ```ts
 * import { mySkyWords, type MySkyWords } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const words: MySkyWords = mySkyWords("en");
 * console.log(words.moon, words.compass.N); // Moon N
 * ```
 */
export interface MySkyWords {
  moon: string;
  sun: string;
  planet: Record<NakedEyePlanet, string>;
  phase: Record<MoonPhaseName, string>;
  /** The horizon's letters, short. */
  compass: Record<CompassPoint, string>;
  /** The direction in a sentence. */
  direction: Record<CompassPoint, string>;
  lit: string;
  rises: string;
  sets: string;
  tomorrow: string;
  noRise: string;
  noSet: string;
  moonUp: string;
  moonDown: string;
  planetsUp: string;
  noPlanets: string;
  separator: string;
  daytime: string;
  facingUp: string;
  facingLevel: string;
  facingDown: string;
  label: string;
  panelTitle: string;
  hidePanel: string;
  showPanel: string;
  picked: string;
  pickedMagnitude: string;
  needsPlace: string;
}

const WORDS: Record<MySkyLanguage, MySkyWords> = {
  en: {
    moon: "Moon",
    sun: "Sun",
    planet: { mercury: "Mercury", venus: "Venus", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn" },
    phase: { new: "New Moon", "waxing-crescent": "Waxing crescent", "first-quarter": "First quarter", "waxing-gibbous": "Waxing gibbous", full: "Full Moon", "waning-gibbous": "Waning gibbous", "last-quarter": "Last quarter", "waning-crescent": "Waning crescent" },
    compass: { N: "N", NE: "NE", E: "E", SE: "SE", S: "S", SW: "SW", W: "W", NW: "NW" },
    direction: { N: "north", NE: "north-east", E: "east", SE: "south-east", S: "south", SW: "south-west", W: "west", NW: "north-west" },
    lit: "{n}% lit",
    rises: "Rises {time}",
    sets: "Sets {time}",
    tomorrow: "tomorrow {time}",
    noRise: "No moonrise in the next 24 hours",
    noSet: "No moonset in the next 24 hours",
    moonUp: "The Moon is above the horizon",
    moonDown: "The Moon is below the horizon",
    planetsUp: "Planets up: {list}",
    noPlanets: "No bright planets above the horizon",
    separator: ", ",
    daytime: "It is daytime. The Sun is up, so daylight hides the stars",
    facingUp: "Facing {direction}, looking {n}° up",
    facingLevel: "Facing {direction}, looking at the horizon",
    facingDown: "Facing {direction}, looking {n}° down",
    label: "The sky seen from latitude {lat}, longitude {lon}. Drag to turn round and look up.",
    panelTitle: "Moon and planets",
    hidePanel: "Hide the Moon and planets panel",
    showPanel: "Show the Moon and planets panel",
    picked: "{name}: {altitude}° above the horizon, {direction}{magnitude}",
    pickedMagnitude: ", magnitude {n}",
    needsPlace: "A latitude and a longitude are needed to show a sky",
  },
  ja: {
    moon: "月",
    sun: "太陽",
    planet: { mercury: "水星", venus: "金星", mars: "火星", jupiter: "木星", saturn: "土星" },
    phase: { new: "新月", "waxing-crescent": "三日月", "first-quarter": "上弦の月", "waxing-gibbous": "満ちていく月", full: "満月", "waning-gibbous": "欠けていく月", "last-quarter": "下弦の月", "waning-crescent": "細くなっていく月" },
    compass: { N: "北", NE: "北東", E: "東", SE: "南東", S: "南", SW: "南西", W: "西", NW: "北西" },
    direction: { N: "北", NE: "北東", E: "東", SE: "南東", S: "南", SW: "南西", W: "西", NW: "北西" },
    lit: "月の{n}%が光っています",
    rises: "月の出 {time}",
    sets: "月の入り {time}",
    tomorrow: "明日 {time}",
    noRise: "24時間以内に月の出はありません",
    noSet: "24時間以内に月の入りはありません",
    moonUp: "月は地平線の上にあります",
    moonDown: "月は地平線の下にあります",
    planetsUp: "空に出ている惑星: {list}",
    noPlanets: "空に出ている明るい惑星はありません",
    separator: "、",
    daytime: "昼間です。太陽が出ているので、星は見えません",
    facingUp: "{direction}を向いて、{n}°見上げています",
    facingLevel: "{direction}を向いて、地平線を見ています",
    facingDown: "{direction}を向いて、{n}°見下ろしています",
    label: "緯度{lat}、経度{lon}から見た空です。ドラッグすると、向きを変えて上を見られます。",
    panelTitle: "月と惑星",
    hidePanel: "月と惑星の情報を隠す",
    showPanel: "月と惑星の情報を表示する",
    picked: "{name}: 地平線から{altitude}°、{direction}の方角{magnitude}",
    pickedMagnitude: "、明るさ{n}等",
    needsPlace: "空を表示するには、緯度と経度が必要です",
  },
};

/**
 * The words of the element for a language, for a page that writes its own panel or label.
 *
 * @param language - `en` or `ja`; anything else is English.
 * @returns The table: the compass, the phases, the planets and the sentences with their {gaps}.
 *
 * @example
 * ```ts
 * import { mySkyWords } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(mySkyWords("ja").phase["first-quarter"], mySkyWords("en").planet.jupiter); // 上弦の月 Jupiter
 * ```
 */
export function mySkyWords(language: string): Readonly<MySkyWords> {
  return language === "ja" ? WORDS.ja : WORDS.en;
}

/**
 * Fill the {gaps} of a sentence from a table of values; a gap with no value is left as it is.
 *
 * @param text - A sentence from `mySkyWords`.
 * @param values - What goes in each gap.
 * @returns The sentence.
 *
 * @example
 * ```ts
 * import { mySkyWords, say } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(say(mySkyWords("en").lit, { n: 62 })); // 62% lit
 * ```
 */
export function say(text: string, values: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (values[name] === undefined ? whole : String(values[name])));
}

/**
 * The compass point nearest a heading: N for 337.5 up to 22.5, NE up to 67.5, and so on round.
 *
 * @param heading - Degrees from north through east, any number.
 * @returns `N`, `NE`, `E`, `SE`, `S`, `SW`, `W` or `NW`.
 *
 * @example
 * ```ts
 * import { compassPoint } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(compassPoint(0), compassPoint(100), compassPoint(-45), compassPoint(200)); // N E NW S
 * ```
 */
export function compassPoint(heading: number): CompassPoint {
  return COMPASS[Math.round((((heading % 360) + 360) % 360) / 45) % 8]!;
}
