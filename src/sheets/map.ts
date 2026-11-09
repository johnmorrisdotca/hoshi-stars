// A sky map for a month: the evening sky (about 21:00 by the Sun on the 15th) over a latitude, as a circle with the horizon at the edge and the zenith in the middle, with the brightest stars and the figures, to print.
// North is at the top and east to the left, as when you lie back and look up; turn the page until the direction you face is at the bottom. Pure maths on the star table and the figures; strings out.
import { constellations } from "../constellations.ts";
import { figureOf } from "../lines.ts";
import { stars as allStars, type Star } from "../stars.ts";
import { TYPES, n, paragraph, svgOpen, textWidth, type Lang } from "./common.ts";
import { monthName, skyForLatitude, sunRightAscension } from "./region.ts";

const RAD = Math.PI / 180;

interface Place {
  x: number;
  y: number;
  altitude: number;
}

/** Where a star is on the map, or `undefined` when it is below the horizon. */
function placeOf(star: Star, latitude: number, lst: number, cx: number, cy: number, radius: number): Place | undefined {
  const h = (lst - star.rightAscension) * RAD;
  const dec = star.declination * RAD;
  const phi = latitude * RAD;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)) / RAD;
  if (altitude < 0) return undefined;
  const south = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const azimuth = south + Math.PI;
  const r = radius * ((90 - altitude) / 90);
  return { x: cx - r * Math.sin(azimuth), y: cy - r * Math.cos(azimuth), altitude };
}

const HOW = {
  en: (month: string, north: boolean) => `The sky at about 9 in the evening in ${month}. North is at the top. Turn the page until the direction you face is at the bottom. ${north ? "Face south to see the stars that are highest." : "Face north to see the stars that are highest."}`,
  ja: (month: string, north: boolean) => `${month}の よる 9じごろの そらです。きたが うえです。むいている ほうこうが したに くるように かみを まわします。${north ? "いちばん たかい ほしは、みなみを むくと みえます。" : "いちばん たかい ほしは、きたを むくと みえます。"}`,
};

/**
 * The evening sky of a month over a latitude as an SVG string measured in millimetres: the stars to magnitude 3.2 (kid) or 4.5 (normal) above the horizon, the figures, the names of the best known constellations that are up, N, E, S and W
 * round the horizon, and the words that say how to hold it. It is the sky at about 21:00 by the Sun on the 15th of the month, the same all along a line of latitude.
 * @param latitude - Degrees north of the equator (negative south), -90 to 90.
 * @param month - 1 to 12.
 * @param options - `widthMm` and `heightMm` (the room of the page's body), `lang` and `type` (`kid` or `normal`).
 * @returns The `<svg>` markup.
 * @throws RangeError if the latitude is not from -90 to 90 or the month not 1 to 12.
 *
 * @example
 * ```ts
 * import { skyMapSvg } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const map = skyMapSvg(45, 11, { widthMm: 184.6, heightMm: 200, lang: "en" });
 * console.log(map.includes("November"), map.includes('data-horizon=""'));
 * ```
 */
export function skyMapSvg(latitude: number, month: number, options: { widthMm: number; heightMm: number; lang?: Lang; type?: "kid" | "normal" }): string {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError(`latitude must be a number from -90 to 90, got ${String(latitude)}`);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(`month must be 1 to 12, got ${String(month)}`);
  const lang = options.lang ?? "en";
  const type = options.type ?? "kid";
  const t = TYPES[type];
  const north = latitude >= 0;
  const block = paragraph(HOW[lang](monthName(month, lang), north), 0, 0, options.widthMm, t.bodyMm);
  const letter = t.nameMm;
  const words = lang === "ja" ? { e: "ひがし", w: "にし" } : { e: "E", w: "W" };
  const side = Math.max(textWidth(words.e, letter), textWidth(words.w, letter)) + 4;
  const radius = Math.min(options.widthMm / 2 - side, (options.heightMm - block.height - 6) / 2 - letter * 1.25);
  const cx = options.widthMm / 2;
  const cy = letter * 1.25 + 1 + radius;
  const lst = (sunRightAscension(month, 15) + 135) % 360;
  const limit = type === "kid" ? 3.2 : 4.5;
  const parts: string[] = [`<clipPath id="map-clip"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(radius)}"/></clipPath><g clip-path="url(#map-clip)">`];
  const size = (m: number): number => (type === "kid" ? Math.max(1, Math.min(3.4, 1 + (3.6 - m) * 0.7)) : Math.max(0.3, Math.min(1.4, 0.3 + (4.8 - m) * 0.25)));
  const place = new Map<Star, Place>();
  for (const s of allStars()) {
    const here = placeOf(s, latitude, lst, cx, cy, radius);
    if (here !== undefined) place.set(s, here);
  }
  for (const c of constellations()) {
    for (const [a, b] of figureOf(c.abbreviation).segments) {
      const pa = place.get(a);
      const pb = place.get(b);
      if (pa === undefined || pb === undefined) continue;
      parts.push(`<line x1="${n(pa.x)}" y1="${n(pa.y)}" x2="${n(pb.x)}" y2="${n(pb.y)}" stroke="#000" stroke-opacity="0.55" stroke-width="${n(t.lineMm * (type === "kid" ? 0.4 : 0.35))}" stroke-linecap="round"/>`);
    }
  }
  for (const [s, here] of place) if (s.magnitude <= limit) parts.push(`<circle cx="${n(here.x)}" cy="${n(here.y)}" r="${n(size(s.magnitude))}" fill="#000"/>`);
  const wanted = type === "kid" ? 8 : 28;
  const font = type === "kid" ? t.bodyMm : t.smallMm;
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  for (const entry of skyForLatitude(latitude, month)) {
    if (boxes.length >= wanted) break;
    const figure = figureOf(entry.constellation.abbreviation);
    const seen = figure.stars.map((s) => place.get(s)).filter((q): q is Place => q !== undefined);
    if (seen.length < Math.ceil(figure.stars.length / 2)) continue;
    const mid = { x: seen.reduce((sum, q) => sum + q.x, 0) / seen.length, y: seen.reduce((sum, q) => sum + q.y, 0) / seen.length };
    const word = lang === "ja" ? entry.constellation.japanese : entry.constellation.name;
    const w = textWidth(word, font);
    const box = { x: mid.x - w / 2, y: mid.y - font, w, h: font * 1.2 };
    if (box.x < cx - radius || box.x + w > cx + radius || boxes.some((o) => box.x < o.x + o.w + 1 && box.x + box.w + 1 > o.x && box.y < o.y + o.h && box.y + box.h > o.y)) continue;
    boxes.push(box);
    parts.push(`<text x="${n(mid.x)}" y="${n(mid.y)}" font-size="${n(font)}" font-weight="700" text-anchor="middle" fill="#000" stroke="#fff" stroke-width="${n(font * 0.25)}" paint-order="stroke" data-name="${entry.constellation.abbreviation}">${word}</text>`);
  }
  parts.push("</g>");
  parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(radius)}" fill="none" stroke="#000" stroke-width="${n(Math.max(0.5, t.lineMm))}" data-horizon=""/>`);
  parts.push(`<path d="M${n(cx - 3)} ${n(cy)}h6M${n(cx)} ${n(cy - 3)}v6" stroke="#000" stroke-width="0.5" data-zenith=""/>`);
  const names = lang === "ja" ? { n: "きた", e: "ひがし", s: "みなみ", w: "にし" } : { n: "N", e: "E", s: "S", w: "W" };
  const word = (x: number, y: number, body: string, key: string): string => `<text x="${n(x)}" y="${n(y + letter * 0.35)}" font-size="${n(letter)}" font-weight="800" text-anchor="middle" fill="#000" data-direction="${key}">${body}</text>`;
  parts.push(word(cx, cy - radius - letter * 0.55, names.n, "north"), word(cx, cy + radius + letter * 0.55, names.s, "south"));
  parts.push(word(cx - radius - textWidth(names.e, letter) / 2 - 3, cy, names.e, "east"), word(cx + radius + textWidth(names.w, letter) / 2 + 3, cy, names.w, "west"));
  const say = paragraph(HOW[lang](monthName(month, lang), north), 0, options.heightMm - block.height + t.bodyMm, options.widthMm, t.bodyMm, ' data-say=""');
  return `${svgOpen(options.widthMm, options.heightMm, `${monthName(month, lang)}`, `sky-${Math.round(latitude)}-${month}`)}${parts.join("")}${say.markup}</svg>`;
}
