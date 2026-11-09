// Which constellations suit a place: from its latitude, the ones that are always up, the ones that are never seen, and the ones in the evening sky each month (about 21:00 by the Sun, the 15th of the month).
// Latitude decides most of it, the month the rest. Pure maths on the figures of `/lines`; no DOM, no clock.
import { constellations, type Constellation } from "../constellations.ts";
import { figureOf } from "../lines.ts";
import type { Lang } from "./common.ts";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/**
 * How a constellation stands at a latitude: `always` above the horizon (circumpolar), `never` seen from there, or `season` (up for part of the night and part of the year).
 *
 * @example
 * ```ts
 * import { type Standing } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const standing: Standing = "always";
 * console.log(standing);
 * ```
 */
export type Standing = "always" | "season" | "never";

/**
 * One constellation as a place sees it.
 *
 * @example
 * ```ts
 * import { skyForLatitude, type RegionEntry } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const best: RegionEntry = skyForLatitude(45)[0];
 * console.log(best.constellation.name, best.standing, Math.round(best.culmination));
 * ```
 */
export interface RegionEntry {
  constellation: Constellation;
  standing: Standing;
  /** How high the middle of its figure climbs at the meridian, in degrees (negative: it never rises). */
  culmination: number;
  /** The month (1 to 12) in which it is highest in the evening sky, about 21:00 by the Sun; 0 when it never rises. */
  bestMonth: number;
  /** How well known it is from here: the brightness of its stars and the size of its figure, less the more it hugs the horizon. Bigger is better known. */
  fame: number;
}

interface Summary {
  constellation: Constellation;
  decMin: number;
  decMax: number;
  centreRa: number;
  centreDec: number;
  fame: number;
}

let summaries: Summary[] | undefined;
function load(): Summary[] {
  if (summaries !== undefined) return summaries;
  summaries = [];
  for (const c of constellations()) {
    const figure = figureOf(c.abbreviation);
    if (figure.stars.length === 0) continue;
    let x = 0;
    let y = 0;
    let z = 0;
    let flux = 0;
    for (const s of figure.stars) {
      x += Math.cos(s.declination * RAD) * Math.cos(s.rightAscension * RAD);
      y += Math.cos(s.declination * RAD) * Math.sin(s.rightAscension * RAD);
      z += Math.sin(s.declination * RAD);
      flux += 10 ** (-0.4 * s.magnitude);
    }
    const decs = figure.stars.map((s) => s.declination);
    const centreDec = Math.atan2(z, Math.hypot(x, y)) * DEG;
    const centreRa = (Math.atan2(y, x) * DEG + 360) % 360;
    let spread = 0;
    for (const a of figure.stars) spread = Math.max(spread, Math.acos(Math.max(-1, Math.min(1, Math.sin(a.declination * RAD) * Math.sin(centreDec * RAD) + Math.cos(a.declination * RAD) * Math.cos(centreDec * RAD) * Math.cos((a.rightAscension - centreRa) * RAD)))) * DEG);
    summaries.push({ constellation: c, decMin: Math.min(...decs), decMax: Math.max(...decs), centreRa, centreDec, fame: Math.sqrt(flux) * (1 + spread / 20) });
  }
  return summaries;
}

/** The Sun's right ascension in degrees on the 15th of a month of 2026 (a mean-Sun formula, good to a fraction of a degree). */
export function sunRightAscension(month: number, day = 15): number {
  const d = (Date.UTC(2026, month - 1, day, 12) - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  const meanLongitude = (280.46 + 0.9856474 * d) % 360;
  const g = (357.528 + 0.9856003 * d) * RAD;
  const lambda = (meanLongitude + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  return ((Math.atan2(Math.cos(23.439 * RAD) * Math.sin(lambda), Math.cos(lambda)) * DEG) + 360) % 360;
}

/** The altitude, in degrees, of a point of the sky at a latitude when the local sidereal time is `lst` degrees. */
export function altitudeAt(latitude: number, declination: number, rightAscension: number, lst: number): number {
  const sine = Math.sin(latitude * RAD) * Math.sin(declination * RAD) + Math.cos(latitude * RAD) * Math.cos(declination * RAD) * Math.cos((lst - rightAscension) * RAD);
  return Math.asin(Math.max(-1, Math.min(1, sine))) * DEG;
}

/**
 * Every constellation as a place at a latitude sees it, best known first: always up (every star of its figure above the horizon all night, all year), never seen (no star of its figure ever rises) or seasonal, with the month it is
 * highest in the evening sky (about 21:00 by the Sun on the 15th) and how high it climbs. Pass a `month` to keep only the ones above 15 degrees in the evening sky of that month and the ones always up.
 * @param latitude - Degrees north of the equator (negative south), -90 to 90.
 * @param month - 1 to 12, to list what is up in that evening; leave it out for all 88.
 * @returns The entries, best known first.
 * @throws RangeError if the latitude is not a number from -90 to 90 or the month is not 1 to 12.
 *
 * @example
 * ```ts
 * import { skyForLatitude } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const sydney = skyForLatitude(-33.9);
 * console.log(sydney.find((one) => one.constellation.abbreviation === "UMi")?.standing, sydney.find((one) => one.constellation.abbreviation === "Cru")?.standing);
 * ```
 */
export function skyForLatitude(latitude: number, month?: number): RegionEntry[] {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError(`latitude must be a number from -90 to 90, got ${String(latitude)}`);
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) throw new RangeError(`month must be 1 to 12, got ${String(month)}`);
  const north = latitude >= 0;
  const out: RegionEntry[] = [];
  const evening = Array.from({ length: 12 }, (_, i) => (sunRightAscension(i + 1) + 135) % 360);
  for (const s of load()) {
    const always = north ? s.decMin > 90 - latitude : s.decMax < -(90 + latitude);
    const never = north ? s.decMax < latitude - 90 : s.decMin > 90 + latitude;
    const standing: Standing = always ? "always" : never ? "never" : "season";
    const culmination = 90 - Math.abs(latitude - s.centreDec);
    let bestMonth = 0;
    if (standing !== "never") {
      let nearest = 361;
      // the evening RA that is near the figure's RA puts it on the meridian; the month it is highest is the one whose evening LST is closest to it
      evening.forEach((lst, i) => {
        const away = Math.abs(((lst - s.centreRa + 540) % 360) - 180);
        if (away < nearest) {
          nearest = away;
          bestMonth = i + 1;
        }
      });
    }
    if (month !== undefined && standing !== "always") {
      if (standing === "never") continue;
      if (altitudeAt(latitude, s.centreDec, s.centreRa, evening[month - 1]!) < 15) continue;
    }
    out.push({ constellation: s.constellation, standing, culmination, bestMonth, fame: s.fame * Math.max(0.05, Math.min(1, (culmination - 10) / 40)) });
  }
  return out.sort((a, b) => b.fame - a.fame);
}

const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ja: ["1がつ", "2がつ", "3がつ", "4がつ", "5がつ", "6がつ", "7がつ", "8がつ", "9がつ", "10がつ", "11がつ", "12がつ"],
} as const;

/**
 * The name of a month.
 * @param month - 1 to 12.
 * @param lang - `en` or `ja` (`1がつ`).
 * @returns The name.
 *
 * @example
 * ```ts
 * import { monthName } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * console.log(monthName(11, "en"), monthName(11, "ja"));
 * ```
 */
export const monthName = (month: number, lang: Lang = "en"): string => MONTHS[lang][month - 1] ?? "";

/**
 * A band of ten degrees of latitude as words: `40° to 50° N` or `きた 40〜50ど`.
 * @param latitude - Degrees north (negative south).
 * @param lang - `en` or `ja`.
 * @returns The band the latitude lies in.
 *
 * @example
 * ```ts
 * import { latitudeBand } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * console.log(latitudeBand(43.7, "en"), latitudeBand(-33.9, "ja"));
 * ```
 */
export function latitudeBand(latitude: number, lang: Lang = "en"): string {
  const low = Math.floor(Math.abs(latitude) / 10) * 10;
  const side = latitude >= 0;
  return lang === "ja" ? `${side ? "きた" : "みなみ"} ${low}〜${low + 10}ど` : `${low}° to ${low + 10}° ${side ? "N" : "S"}`;
}

/** Why a constellation is special where it is seen: a short note, in plain words, for a few famous ones. */
const WHY: Record<string, { en: string; ja: string }> = {
  Cru: { en: "The Southern Cross is on the flags of Australia, New Zealand and Brazil.", ja: "みなみじゅうじ座は、オーストラリア、ニュージーランド、ブラジルの はたに あります。" },
  UMa: { en: "The Big Dipper helps you find the North Star.", ja: "きたしちせいは、ほっきょくせいを みつける ヒントです。" },
  UMi: { en: "The North Star is at the end of its handle.", ja: "ほっきょくせいは、この ほしざの えの さきに あります。" },
  Cas: { en: "Its W shape is easy to spot in the north.", ja: "Wの かたちで、きたの そらで みつけやすい ほしざです。" },
  Ori: { en: "The hunter is seen from almost everywhere on Earth.", ja: "オリオンは、せかいの ほとんどの ばしょから みえます。" },
  Sco: { en: "A bright red star marks the scorpion's heart.", ja: "さそりの むねに、あかい あかるい ほしが あります。" },
  Leo: { en: "The lion's head looks like a backwards question mark.", ja: "ししの あたまは、さかさの はてなマークに にています。" },
  Cyg: { en: "The swan flies along the Milky Way.", ja: "はくちょうは、あまのがわに そって とびます。" },
  Lyr: { en: "Its bright star Vega is a summer jewel.", ja: "あかるい ベガは、なつの たからものです。" },
  CMa: { en: "It has Sirius, the brightest star in the night sky.", ja: "よるの そらで いちばん あかるい シリウスが あります。" },
};

/**
 * A short reason a constellation is worth finding, for the few that have one, else `undefined`.
 * @param abbreviation - The IAU abbreviation (`Cru`).
 * @param lang - `en` or `ja`.
 * @returns A sentence, or `undefined`.
 *
 * @example
 * ```ts
 * import { whyFamous } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * console.log(whyFamous("Cru", "en"));
 * ```
 */
export const whyFamous = (abbreviation: string, lang: Lang = "en"): string | undefined => WHY[abbreviation]?.[lang];
