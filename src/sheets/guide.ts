// The constellations for a place, as a sheet: the ones always up there, the best of the evening sky in a month, and the ones that are never seen, each as a small figure with its name. Latitude decides it (`skyForLatitude`).
// Pure: a string of SVG measured in millimetres.
import type { Constellation } from "../constellations.ts";
import { figureOf } from "../lines.ts";
import { project } from "../projection.ts";
import { TYPES, esc, n, paragraph, svgOpen, text, textWidth, wrap, type Lang } from "./common.ts";
import { monthName, skyForLatitude, whyFamous, type RegionEntry } from "./region.ts";

/** One constellation as a small picture: its figure's lines and dots in a square of `size` millimetres at `(x, y)`, with its name under it. */
function thumbnail(c: Constellation, x: number, y: number, size: number, lang: Lang, type: "kid" | "normal"): string {
  const t = TYPES[type];
  const figure = figureOf(c.abbreviation);
  const parts: string[] = [];
  if (figure.stars.length > 0) {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const s of figure.stars) {
      const d = (s.declination * Math.PI) / 180;
      const a = (s.rightAscension * Math.PI) / 180;
      sx += Math.cos(d) * Math.cos(a);
      sy += Math.cos(d) * Math.sin(a);
      sz += Math.sin(d);
    }
    const centre = { rightAscension: ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360, declination: (Math.atan2(sz, Math.hypot(sx, sy)) * 180) / Math.PI };
    const raw = new Map(figure.stars.map((s) => [s, project("stereographic", s, { centre, scale: 1 })!]));
    const xs = [...raw.values()].map((p) => p.x);
    const ys = [...raw.values()].map((p) => p.y);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-6);
    const k = (size - 6) / span;
    const mx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const my = (Math.max(...ys) + Math.min(...ys)) / 2;
    const at = (s: (typeof figure.stars)[number]): [number, number] => [x + size / 2 + (raw.get(s)!.x - mx) * k, y + size / 2 - (raw.get(s)!.y - my) * k];
    for (const [a, b] of figure.segments) parts.push(`<line x1="${n(at(a)[0])}" y1="${n(at(a)[1])}" x2="${n(at(b)[0])}" y2="${n(at(b)[1])}" stroke="#000" stroke-width="${n(type === "kid" ? 1.1 : 0.3)}" stroke-linecap="round"/>`);
    for (const s of figure.stars) parts.push(`<circle cx="${n(at(s)[0])}" cy="${n(at(s)[1])}" r="${n(type === "kid" ? Math.max(1.3, Math.min(2.6, 1.3 + (3.5 - s.magnitude) * 0.4)) : 0.7)}" fill="#000"/>`);
  }
  const word = lang === "ja" ? c.japanese : c.name;
  // the name under the figure: as large as the type says, on two lines if it must, and smaller only for a single long word
  const room = size + 2;
  let font = t.bodyMm;
  let lines = wrap(word, room, font);
  const widest = (): number => Math.max(...lines.map((line) => textWidth(line, font)));
  while (widest() > room && font > t.smallMm) {
    font *= 0.92;
    lines = wrap(word, room, font);
  }
  lines.forEach((line, i) => parts.push(text(x + size / 2, y + size + font * (0.95 + 1.3 * i), font, line, ' text-anchor="middle" data-constellation=""')));
  return `<g data-thumb="${c.abbreviation}">${parts.join("")}</g>`;
}

const SAY = {
  en: {
    always: "Always up here",
    best: (month: string) => `Best in ${month} evenings`,
    never: "Never seen from here",
    none: "None: here every constellation rises and sets.",
    noneBest: "Nothing high enough this month.",
  },
  ja: {
    always: "ここでは いつも みえる ほしざ",
    best: (month: string) => `${month}の よるに みやすい ほしざ`,
    never: "ここからは みえない ほしざ",
    none: "ここでは どの ほしざも のぼって しずみます。",
    noneBest: "この つきは たかく のぼる ほしざが ありません。",
  },
} as const;

/**
 * The sheet "constellations for where you live" as an SVG string measured in millimetres: the constellations always up at a latitude, the best of the evening sky in a month (about 21:00 by the Sun) and the ones never seen, each with its figure and name, and a note on the most famous.
 * @param latitude - Degrees north of the equator (negative south), -90 to 90.
 * @param month - 1 to 12.
 * @param options - `widthMm` and `heightMm` (the room of the page's body), `lang` and `type` (`kid` or `normal`).
 * @returns The `<svg>` markup.
 * @throws RangeError if the latitude is not from -90 to 90 or the month not 1 to 12.
 *
 * @example
 * ```ts
 * import { regionGuideSvg } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const guide = regionGuideSvg(-33.9, 7, { widthMm: 184.6, heightMm: 150, lang: "en" });
 * console.log(guide.includes('data-thumb="Cru"'), guide.includes('data-thumb="UMi"'));
 * ```
 */
export function regionGuideSvg(latitude: number, month: number, options: { widthMm: number; heightMm: number; lang?: Lang; type?: "kid" | "normal" }): string {
  const lang = options.lang ?? "en";
  const type = options.type ?? "kid";
  const t = TYPES[type];
  const say = SAY[lang];
  const all = skyForLatitude(latitude);
  const evening = skyForLatitude(latitude, month);
  const always = all.filter((e) => e.standing === "always").slice(0, 5);
  const best = evening.filter((e) => e.standing === "season");
  const never6 = all.filter((e) => e.standing === "never").slice(0, 6);
  const columns = type === "kid" ? 5 : 6;
  const cell = options.widthMm / columns;
  const head = t.nameMm * 0.75;
  const neverWords = never6.map((e) => (lang === "ja" ? e.constellation.japanese : e.constellation.name)).join(lang === "ja" ? "、" : ", ");
  const neverLines = wrap(neverWords === "" ? "-" : neverWords, options.widthMm - 2.4, t.bodyMm);
  const whyEntry = [...always, ...best][0];
  const why = whyEntry === undefined ? undefined : whyFamous(whyEntry.constellation.abbreviation, lang);
  const lay = (shrink: number, withWhy: boolean, bestRows: number): { parts: string[]; end: number } => {
    const size = (cell - 3) * shrink;
    const rowHeight = size + t.bodyMm * 2.7;
    const parts: string[] = [];
    let y = 0;
    const heading = (words: string): void => {
      parts.push(text(1.2, y + head * 1.05, head, words, ' data-heading=""'));
      y += head + 4;
    };
    const grid = (list: RegionEntry[], rows: number): void => {
      list.slice(0, rows * columns).forEach((e, i) => parts.push(thumbnail(e.constellation, (i % columns) * cell + 1.5 + ((cell - 3) - size) / 2, y + Math.floor(i / columns) * rowHeight, size, lang, type)));
      y += rows * rowHeight;
    };
    heading(say.always);
    if (always.length === 0) {
      parts.push(text(1.2, y + t.bodyMm, t.bodyMm, say.none));
      y += t.bodyMm * 1.5;
    } else grid(always, 1);
    heading(say.best(monthName(month, lang)));
    if (best.length === 0) {
      parts.push(text(1.2, y + t.bodyMm, t.bodyMm, say.noneBest));
      y += t.bodyMm * 1.5;
    } else grid(best, Math.min(bestRows, Math.ceil(best.length / columns)));
    heading(say.never);
    neverLines.forEach((line, i) => parts.push(text(1.2, y + t.bodyMm + i * t.bodyMm * 1.3, t.bodyMm, line)));
    y += neverLines.length * t.bodyMm * 1.3 + 3;
    if (withWhy && why !== undefined) {
      const block = paragraph(why, 1.2, y + t.bodyMm, options.widthMm - 2.4, t.bodyMm, ' data-why=""');
      parts.push(block.markup);
      y += block.height;
    }
    return { parts, end: y };
  };
  // as much as fits: two rows of the evening's best and the note, then fewer, then smaller figures
  let made = lay(0.5, false, 1);
  search: for (const shrink of [1, 0.9, 0.8, 0.7, 0.6, 0.5]) {
    for (const [withWhy, rows] of [[true, 2], [false, 2], [true, 1], [false, 1]] as const) {
      const one = lay(shrink, withWhy, rows);
      if (one.end <= options.heightMm) {
        made = one;
        break search;
      }
    }
  }
  const parts = made.parts;
  const label = lang === "ja" ? "ほしざの ガイド" : "Constellation guide";
  return `${svgOpen(options.widthMm, options.heightMm, esc(label), `guide-${Math.round(latitude)}-${month}`)}${parts.join("")}</svg>`;
}

