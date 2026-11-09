// The star wheel (a planisphere) for a latitude, to cut out: a disc of the sky round the pole with the date round its edge, and a plate with a window that is the horizon and the hours round its edge. Turn the disc until the date is
// at the time you look and the window shows the stars you can see. Drawn from the star table and the figures with a stereographic chart; the window is a circle of the same chart (the horizon of a latitude is one). Pure: strings.
import { constellations } from "../constellations.ts";
import { figureOf } from "../lines.ts";
import { stars as allStars, type Star } from "../stars.ts";
import { TYPES, n, paragraph, svgOpen, textWidth, type Lang } from "./common.ts";
import { skyForLatitude, sunRightAscension } from "./region.ts";

const RAD = Math.PI / 180;

/**
 * The latitudes a wheel is made for: 20 to 70 degrees from the equator, north or south. A stereographic wheel for a place nearer the equator would need a disc far wider than any page.
 *
 * @example
 * ```ts
 * import { WHEEL_LATITUDES } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * console.log(WHEEL_LATITUDES.min, WHEEL_LATITUDES.max);
 * ```
 */
export const WHEEL_LATITUDES = { min: 20, max: 70 } as const;

interface Plan {
  latitude: number;
  north: boolean;
  /** The sheet's centre and the disc's radius, in millimetres. */
  cx: number;
  cy: number;
  radius: number;
  /** Where the stars stop and the ring of dates or hours begins. */
  inner: number;
  /** Millimetres for one unit of the chart. */
  k: number;
  type: "kid" | "normal";
}

function plan(latitude: number, cx: number, cy: number, radius: number, type: "kid" | "normal"): Plan {
  const phi = Math.min(WHEEL_LATITUDES.max, Math.max(WHEEL_LATITUDES.min, Math.abs(latitude)));
  const ring = type === "kid" ? 12 : 7;
  const inner = radius - ring;
  return { latitude: phi, north: latitude >= 0, cx, cy, radius, inner, k: inner * Math.tan((phi * RAD) / 2), type };
}

/** A place on the sheet from an angle (degrees, clockwise from up in the north's view, the other way in the south's) and a distance from the pole. */
const at = (p: Plan, r: number, alpha: number): [number, number] => [p.cx + (p.north ? 1 : -1) * r * Math.sin(alpha * RAD), p.cy - r * Math.cos(alpha * RAD)];

/** The chart's distance from the pole for a star at a declination. */
const radiusOf = (p: Plan, declination: number): number => p.k * Math.tan((((p.north ? 90 - declination : 90 + declination)) * RAD) / 2);

const starSize = (magnitude: number, type: "kid" | "normal"): number => (type === "kid" ? Math.max(1, Math.min(3.2, 0.9 + (4 - magnitude) * 0.55)) : Math.max(0.25, Math.min(1.2, 0.25 + (5.2 - magnitude) * 0.22)));

const SHORT = {
  en: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
  ja: ["1がつ", "2がつ", "3がつ", "4がつ", "5がつ", "6がつ", "7がつ", "8がつ", "9がつ", "10がつ", "11がつ", "12がつ"],
};

function discMarkup(p: Plan, lang: Lang): string {
  const t = TYPES[p.type];
  const limit = p.type === "kid" ? 3.5 : 5;
  const id = `wheel-clip-${p.north ? "n" : "s"}`;
  const parts: string[] = [`<clipPath id="${id}"><circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.inner)}"/></clipPath>`, `<g clip-path="url(#${id})">`];
  // the equator and the ecliptic
  parts.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.k)}" fill="none" stroke="#000" stroke-width="${n(t.lineMm * 0.25)}" stroke-dasharray="${n(t.lineMm * 1.5)} ${n(t.lineMm * 1.5)}"/>`);
  const ecliptic: [number, number][] = [];
  for (let lambda = 0; lambda <= 360; lambda += 3) {
    const dec = Math.atan(Math.tan(23.439 * RAD) * Math.sin(lambda * RAD)) / RAD;
    const ra = (Math.atan2(Math.cos(23.439 * RAD) * Math.sin(lambda * RAD), Math.cos(lambda * RAD)) / RAD + 360) % 360;
    ecliptic.push(at(p, radiusOf(p, dec), ra));
  }
  parts.push(`<path d="M${ecliptic.map((q) => `${n(q[0])} ${n(q[1])}`).join("L")}Z" fill="none" stroke="#000" stroke-width="${n(t.lineMm * 0.3)}" stroke-dasharray="${n(t.lineMm * 0.4)} ${n(t.lineMm)}"/>`);
  // the figures, then the stars
  const place = (s: Star): [number, number] => at(p, radiusOf(p, s.declination), s.rightAscension);
  const inside = (s: Star): boolean => Math.hypot(...(place(s).map((v, i) => v - (i === 0 ? p.cx : p.cy)) as [number, number])) <= p.inner * 1.02;
  for (const c of constellations()) {
    for (const [a, b] of figureOf(c.abbreviation).segments) if (inside(a) || inside(b)) parts.push(`<line x1="${n(place(a)[0])}" y1="${n(place(a)[1])}" x2="${n(place(b)[0])}" y2="${n(place(b)[1])}" stroke="#000" stroke-opacity="0.55" stroke-width="${n(t.lineMm * (p.type === "kid" ? 0.4 : 0.35))}" stroke-linecap="round"/>`);
  }
  for (const s of allStars()) {
    if (s.magnitude > limit) continue;
    const [x, y] = place(s);
    parts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(starSize(s.magnitude, p.type))}" fill="#000"/>`);
  }
  // the names of the best known constellations
  const names = skyForLatitude(p.north ? p.latitude : -p.latitude).slice(0, p.type === "kid" ? 14 : 40);
  const size = p.type === "kid" ? t.bodyMm : t.smallMm;
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const wanted = p.type === "kid" ? 7 : 30;
  for (const entry of names) {
    if (boxes.length >= wanted) break;
    const figure = figureOf(entry.constellation.abbreviation);
    const mid = figure.stars.reduce((sum, s) => [sum[0] + place(s)[0], sum[1] + place(s)[1]], [0, 0]).map((v) => v / figure.stars.length) as [number, number];
    if (Math.hypot(mid[0] - p.cx, mid[1] - p.cy) > p.inner * 0.92) continue;
    const word = lang === "ja" ? entry.constellation.japanese : entry.constellation.name;
    const w = textWidth(word, size);
    const box = { x: mid[0] - w / 2, y: mid[1] - size, w, h: size * 1.2 };
    if (boxes.some((o) => box.x < o.x + o.w + 1 && box.x + box.w + 1 > o.x && box.y < o.y + o.h && box.y + box.h > o.y)) continue;
    boxes.push(box);
    parts.push(`<text x="${n(mid[0])}" y="${n(mid[1])}" font-size="${n(size)}" font-weight="700" text-anchor="middle" fill="#000" stroke="#fff" stroke-width="${n(size * 0.25)}" paint-order="stroke" data-name="${entry.constellation.abbreviation}">${word}</text>`);
  }
  parts.push("</g>");
  // the ring of dates: the Sun's right ascension for each day shows where it is on the disc that day
  parts.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.inner)}" fill="none" stroke="#000" stroke-width="${n(t.lineMm * 0.3)}"/>`);
  for (let month = 1; month <= 12; month += 1) {
    for (const day of [1, 10, 20]) {
      const alpha = sunRightAscension(month, day);
      const long = day === 1;
      const [x1, y1] = at(p, p.inner, alpha);
      const [x2, y2] = at(p, p.inner + (long ? (p.radius - p.inner) * 0.9 : (p.radius - p.inner) * 0.3), alpha);
      parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="#000" stroke-width="${n(long ? t.lineMm * 0.3 : t.lineMm * 0.15)}"/>`);
    }
    const mid = sunRightAscension(month, 15);
    const [lx, ly] = at(p, p.inner + (p.radius - p.inner) * 0.28, mid);
    const turn = p.north ? mid : -mid;
    const label = lang === "ja" ? SHORT.ja[month - 1]! : SHORT.en[month - 1]!;
    parts.push(`<text x="${n(lx)}" y="${n(ly + (p.type === "kid" ? t.smallMm : t.smallMm) * 0.35)}" font-size="${n(t.smallMm * (p.type === "kid" ? 0.9 : 0.8))}" font-weight="700" text-anchor="middle" fill="#000" transform="rotate(${n(turn)} ${n(lx)} ${n(ly)})" data-month="${month}">${label}</text>`);
  }
  parts.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.radius)}" fill="none" stroke="#000" stroke-width="${n(Math.max(0.4, t.lineMm * 0.35))}" data-cut="disc"/>`);
  parts.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="1.6" fill="#fff" stroke="#000" stroke-width="0.5" data-pin=""/>`);
  return parts.join("");
}

function plateMarkup(p: Plan, lang: Lang): string {
  const t = TYPES[p.type];
  const phi = p.latitude * RAD;
  const centre = (Math.cos(phi) / Math.sin(phi)) * p.k;
  const rho = (1 / Math.sin(phi)) * p.k;
  const wx = p.cx;
  const wy = p.cy - centre;
  const parts: string[] = [];
  parts.push(`<path fill-rule="evenodd" d="M${n(p.cx - p.radius)} ${n(p.cy)}a${n(p.radius)} ${n(p.radius)} 0 1 0 ${n(2 * p.radius)} 0a${n(p.radius)} ${n(p.radius)} 0 1 0 ${n(-2 * p.radius)} 0ZM${n(wx - rho)} ${n(wy)}a${n(rho)} ${n(rho)} 0 1 0 ${n(2 * rho)} 0a${n(rho)} ${n(rho)} 0 1 0 ${n(-2 * rho)} 0Z" fill="#e2e2e2" data-plate=""/>`);
  parts.push(`<circle cx="${n(wx)}" cy="${n(wy)}" r="${n(rho)}" fill="none" stroke="#000" stroke-width="${n(Math.max(0.5, t.lineMm * 0.5))}" stroke-dasharray="${n(t.lineMm * 1.6)} ${n(t.lineMm)}" data-cut="window"/>`);
  parts.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.radius)}" fill="none" stroke="#000" stroke-width="${n(Math.max(0.4, t.lineMm * 0.35))}" data-cut="plate"/>`);
  // the hours: 12 at the top, the later hours to the left in the north's view
  const step = p.type === "kid" ? 2 : 1;
  for (let hour = 0; hour < 24; hour += 1) {
    const alpha = -15 * (hour - 12);
    const [x1, y1] = at(p, p.inner, alpha);
    const [x2, y2] = at(p, p.inner + (p.radius - p.inner) * (hour % step === 0 ? 0.35 : 0.2), alpha);
    parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="#000" stroke-width="${n(t.lineMm * 0.2)}"/>`);
    if (hour % step === 0) {
      const [lx, ly] = at(p, p.inner + (p.radius - p.inner) * 0.78, alpha);
      parts.push(`<text x="${n(lx)}" y="${n(ly + t.smallMm * 0.4)}" font-size="${n(t.smallMm * (p.type === "kid" ? 1.1 : 0.9))}" font-weight="700" text-anchor="middle" fill="#000" data-hour="${hour}">${hour}</text>`);
    }
  }
  parts.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.inner)}" fill="none" stroke="#000" stroke-width="${n(t.lineMm * 0.15)}"/>`);
  // N, E, S, W round the window: the pole end of the window is the north's N (the south's S)
  const names = lang === "ja" ? { n: "きた", e: "ひがし", s: "みなみ", w: "にし" } : { n: "N", e: "E", s: "S", w: "W" };
  const bottom = { x: wx, y: wy + rho };
  const top = { x: wx, y: wy - rho };
  const east = p.north ? 1 : -1;
  const size = p.type === "kid" ? t.bodyMm : t.smallMm;
  const label = (x: number, y: number, word: string, key: string, big = true): string => `<text x="${n(x)}" y="${n(y + (big ? t.nameMm : size) * 0.35)}" font-size="${n(big ? t.nameMm : size)}" font-weight="800" text-anchor="middle" fill="#000" data-direction="${key}">${word}</text>`;
  const ring = p.radius - p.inner;
  // the end of the window nearest the pole is below it (outside, on the plate); the far end touches the ring, so its name goes in the ring
  parts.push(label(bottom.x, bottom.y + t.nameMm * 0.5 + 2, p.north ? names.n : names.s, p.north ? "north" : "south"));
  parts.push(label(top.x, p.cy - p.inner - ring * 0.32, p.north ? names.s : names.n, p.north ? "south" : "north", false));
  const sideway = (word: string): number => p.k + textWidth(word, t.nameMm) / 2 + 3;
  parts.push(label(p.cx + east * sideway(east > 0 ? names.e : names.w), p.cy, east > 0 ? names.e : names.w, east > 0 ? "east" : "west"));
  parts.push(label(p.cx - east * sideway(east > 0 ? names.w : names.e), p.cy, east > 0 ? names.w : names.e, east > 0 ? "west" : "east"));
  parts.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="1.6" fill="#fff" stroke="#000" stroke-width="0.5" data-pin=""/>`);
  return parts.join("");
}

const HOW = {
  en: {
    disc: "Cut out the star wheel along the outside line. The date is on its edge. Names are the best known constellations.",
    plate: "Cut out the plate and then the window. Put the wheel under it, push a pin through both middles (ask a grown-up), and turn the wheel until the date is at the time you look: the stars in the window are in your sky.",
    north: "Face north to start.",
    south: "Face south to start.",
  },
  ja: {
    disc: "ほしの ばんを そとがわの せんで きりとります。ふちに ひづけが あります。なまえは よく しられた ほしざです。",
    plate: "ばんの うえに のせる いたを きって、まども きりぬきます。ふたつの まんなかに ピンを さして (おとなと いっしょに)、ひづけを みる じかんに あわせます。まどの なかの ほしが、いま みえる ほしです。",
    north: "はじめは きたを むいて みます。",
    south: "はじめは みなみを むいて みます。",
  },
} as const;

/** The size a wheel is drawn at for a room: as wide as fits, with room for its words. */
function fit(width: number, height: number, words: number): { cx: number; cy: number; radius: number } {
  const radius = Math.min(width / 2, (height - words) / 2);
  return { cx: width / 2, cy: radius, radius };
}

/**
 * The star disc of a wheel for a latitude as an SVG string measured in millimetres: the stars to magnitude 3.5 (kid) or 5 (normal), the figures, the equator and the ecliptic dashed, the names of the best known constellations and the ring of dates.
 * @param latitude - Degrees north of the equator (negative south); a wheel is made for 20 to 70 degrees, and a latitude outside is moved to the nearest.
 * @param options - `widthMm` and `heightMm` (the room of the page's body), `lang` and `type` (`kid` or `normal`).
 * @returns The `<svg>` markup.
 * @throws RangeError if the latitude is not a number from -90 to 90.
 *
 * @example
 * ```ts
 * import { starWheelDisc } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const disc = starWheelDisc(45, { widthMm: 184.6, heightMm: 200, lang: "en" });
 * console.log(disc.includes('data-cut="disc"'), disc.includes('data-month="12"'));
 * ```
 */
export function starWheelDisc(latitude: number, options: { widthMm: number; heightMm: number; lang?: Lang; type?: "kid" | "normal" }): string {
  return wheelPage(latitude, options, "disc");
}

/**
 * The window plate of a wheel for a latitude as an SVG string measured in millimetres: the horizon as a window, N, E, S and W round it, and the hours round the edge (12 at the top).
 * @param latitude - Degrees north (negative south), moved to 20 to 70 as for the disc.
 * @param options - As for `starWheelDisc`.
 * @returns The `<svg>` markup.
 * @throws RangeError if the latitude is not a number from -90 to 90.
 *
 * @example
 * ```ts
 * import { starWheelPlate } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const plate = starWheelPlate(-34, { widthMm: 184.6, heightMm: 200, lang: "en" });
 * console.log(plate.includes('data-cut="window"'), plate.includes('data-hour="12"'));
 * ```
 */
export function starWheelPlate(latitude: number, options: { widthMm: number; heightMm: number; lang?: Lang; type?: "kid" | "normal" }): string {
  return wheelPage(latitude, options, "plate");
}

function wheelPage(latitude: number, options: { widthMm: number; heightMm: number; lang?: Lang; type?: "kid" | "normal" }, which: "disc" | "plate"): string {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError(`latitude must be a number from -90 to 90, got ${String(latitude)}`);
  const lang = options.lang ?? "en";
  const type = options.type ?? "kid";
  const t = TYPES[type];
  const how = HOW[lang];
  const words = `${how[which]} ${latitude >= 0 ? how.north : how.south}`;
  const block = paragraph(words, 0, 0, options.widthMm, t.bodyMm);
  const box = fit(options.widthMm, options.heightMm, block.height + 4);
  const p = plan(latitude, box.cx, box.cy, box.radius - 0.5, type);
  const say = paragraph(words, 0, options.heightMm - block.height + t.bodyMm, options.widthMm, t.bodyMm, ' data-say=""');
  const label = `${which === "disc" ? "Star wheel" : "Window plate"} ${Math.round(Math.abs(p.latitude))}`;
  return `${svgOpen(options.widthMm, options.heightMm, label, `wheel-${which}-${p.north ? "n" : "s"}${Math.round(p.latitude)}`)}${which === "disc" ? discMarkup(p, lang) : plateMarkup(p, lang)}${say.markup}</svg>`;
}

/**
 * A wheel to cut out of a big poster: the disc and the plate side by side, as one SVG string measured in millimetres, `diameterMm` across each. Give it to kazoku-ui's `tilePoster` to cut it over several pages.
 * @param latitude - Degrees north (negative south).
 * @param options - `diameterMm` (default 400), `lang` and `type`.
 * @returns The `<svg>` markup and its size.
 * @throws RangeError if the latitude is not a number from -90 to 90.
 *
 * @example
 * ```ts
 * import { starWheelPoster } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const poster = starWheelPoster(50, { diameterMm: 400 });
 * console.log(poster.widthMm, poster.heightMm, poster.svg.includes('data-cut="plate"'));
 * ```
 */
export function starWheelPoster(latitude: number, options: { diameterMm?: number; lang?: Lang; type?: "kid" | "normal" } = {}): { svg: string; widthMm: number; heightMm: number } {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError(`latitude must be a number from -90 to 90, got ${String(latitude)}`);
  const d = options.diameterMm ?? 400;
  const lang = options.lang ?? "en";
  const type = options.type ?? "kid";
  const widthMm = 2 * d + 10;
  const heightMm = d + 6;
  const left = plan(latitude, d / 2 + 1, d / 2 + 3, d / 2, type);
  const right = plan(latitude, d + 10 + d / 2 - 1, d / 2 + 3, d / 2, type);
  return { svg: `${svgOpen(widthMm, heightMm, "Star wheel poster", `wheel-poster-${Math.round(left.latitude)}`)}${discMarkup(left, lang)}${plateMarkup(right, lang)}</svg>`, widthMm, heightMm };
}

