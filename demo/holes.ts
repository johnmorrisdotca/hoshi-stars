// What the demo says about a black hole: its mass and distance as words, its place as hours and degrees, and its papers, grouped by paper. Only text; the page puts it on the screen.
import { type BlackHole, type BlackHoleMeasure, type BlackHoleSource } from "../src/black-holes.ts";

type Say = (key: string) => string;
type Language = "en" | "ja";

const LIGHT_YEARS_PER_PARSEC = 3.26156;
const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** A mass in Suns: 21.2, or 4.3 × 10⁶ from ten thousand up. */
export function plainNumber(x: number, lang: Language): string {
  if (x >= 1e4) {
    const exponent = Math.floor(Math.log10(x));
    const mantissa = x / 10 ** exponent;
    return `${new Intl.NumberFormat(lang, { maximumSignificantDigits: 3 }).format(mantissa)} × 10${[...String(exponent)].map((digit) => SUPERSCRIPT[Number(digit)]).join("")}`;
  }
  return new Intl.NumberFormat(lang, { maximumSignificantDigits: 3 }).format(x);
}

/** Light-years for a distance in parsecs: 7,200 below a million, 16.8 million (1680万 in Japanese) above. */
export function lightYearsText(parsecs: number, lang: Language): string {
  const ly = parsecs * LIGHT_YEARS_PER_PARSEC;
  return ly >= 1e6 ? new Intl.NumberFormat(lang, { notation: "compact", compactDisplay: "long", maximumSignificantDigits: 3 }).format(ly) : new Intl.NumberFormat(lang, { maximumSignificantDigits: ly < 1000 ? 3 : 2 }).format(ly);
}

/** A measure as text: `21.2 (19 to 23.4)`, `6.9 to 8.2`, `at least 7.6`; `format` writes one number. */
export function measureText(m: BlackHoleMeasure, format: (x: number) => string, say: Say, space = " "): string {
  if (m.limit !== undefined) return `${say(m.limit === "lower" ? "atLeast" : "atMost")}${space}${format(m.value!)}`;
  const range = m.low !== undefined && m.high !== undefined && format(m.low) !== format(m.high) ? `${format(m.low)}–${format(m.high)}` : undefined;
  if (m.value === undefined) return range ?? "";
  return range === undefined ? format(m.value) : `${format(m.value)} (${range})`;
}

export const massText = (hole: BlackHole, lang: Language, say: Say): string | undefined => (hole.massSuns === undefined ? undefined : `${measureText(hole.massSuns, (x) => plainNumber(x, lang), say, lang === "ja" ? "" : " ")}${lang === "ja" ? "" : " "}${say("suns")}`);

export const distanceText = (hole: BlackHole, lang: Language, say: Say): string | undefined =>
  hole.distanceParsecs === undefined ? undefined : `${measureText(hole.distanceParsecs, (x) => lightYearsText(x, lang), say, lang === "ja" ? "" : " ")}${lang === "ja" ? "" : " "}${say("lightYears")}`;

/** The place as right ascension in hours, minutes and seconds and declination in degrees, arc-minutes and arc-seconds (J2000). */
export function placeText(hole: BlackHole): string {
  const hours = hole.rightAscension / 15;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.round(((hours - h) * 60 - m) * 60);
  const dec = Math.abs(hole.declination);
  const d = Math.floor(dec);
  const dm = Math.floor((dec - d) * 60);
  const ds = Math.round(((dec - d) * 60 - dm) * 60);
  const carry = (a: number, b: number, c: number): [number, number, number] => (c < 60 ? [a, b, c] : b === 59 ? [a + 1, 0, 0] : [a, b + 1, 0]);
  const [rh, rm, rs] = carry(h, m, s);
  const [dd, dmm, dss] = carry(d, dm, ds);
  return `${rh}h ${String(rm).padStart(2, "0")}m ${String(rs).padStart(2, "0")}s, ${hole.declination < 0 ? "−" : "+"}${dd}° ${String(dmm).padStart(2, "0")}′ ${String(dss).padStart(2, "0")}″`;
}

export const kindKey = (hole: BlackHole): string => `hole${hole.kind[0]!.toUpperCase()}${hole.kind.slice(1)}`;
export const foundKey = (hole: BlackHole): string => `found-${hole.foundBy}`;

/** The papers of a black hole, each once, with the facts it gives (`position`, `mass`, `distance`, `companion`, `found`). */
export function papersOf(hole: BlackHole): Array<{ source: BlackHoleSource; facts: string[] }> {
  const out = new Map<string, { source: BlackHoleSource; facts: string[] }>();
  for (const [fact, list] of Object.entries(hole.sources)) {
    for (const source of list) {
      const entry = out.get(source.key) ?? { source, facts: [] as string[] };
      entry.facts.push(fact);
      out.set(source.key, entry);
    }
  }
  return [...out.values()];
}
