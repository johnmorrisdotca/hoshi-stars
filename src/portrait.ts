// A star drawn from its numbers: a disc in the colour of its temperature, darker toward the edge as its atmosphere makes it, with a generic texture and its measured shape where it has one; and the star
// beside the Sun (with Earth's orbit for the big ones). SVG text, our own drawing, no image copied from anywhere. The `/portrait` entry point. Pure: no DOM, no clock, no randomness
// (the texture is placed by a fixed generator seeded by the star's number), no state.
import { blackBodyColour } from "./colour.ts";
import type { StarProfile } from "./profile.ts";

/**
 * The look a star is drawn with: `"supergiant"` has a few huge convection cells, `"giant"` a dozen large ones, `"sun-like"` fine granulation, `"red-dwarf"` finer cells in a deeper red, `"hot"` a smooth disc (hot stars carry their
 * energy by radiation and show no granulation we know of), and `"fast-rotator"` a smooth, flattened and gravity-darkened disc, drawn only for the stars with a measured shape.
 *
 * @example
 * ```ts
 * import type { PortraitLook } from "@johnmorrisdotca/hoshi-stars/portrait";
 *
 * const look: PortraitLook = "sun-like";
 * console.log(look);
 * ```
 */
export type PortraitLook = "supergiant" | "giant" | "sun-like" | "red-dwarf" | "hot" | "fast-rotator";

/**
 * How a portrait or a comparison is drawn.
 *
 * @example
 * ```ts
 * import type { PortraitOptions } from "@johnmorrisdotca/hoshi-stars/portrait";
 *
 * const options: PortraitOptions = { size: 320, lang: "ja", name: "ベテルギウス" };
 * console.log(options.size);
 * ```
 */
export interface PortraitOptions {
  /** The width in pixels (the picture scales, so this only sets its default size). Default 240 for a portrait and 360 for a comparison. */
  size?: number;
  /** The language of the words in the picture: `"en"` (default) or `"ja"`. */
  lang?: "en" | "ja";
  /** The star's name, used in the picture's title and, in the comparison, as the star's label. */
  name?: string;
  /** Draw the dark sky behind (`"space"`, the default) or leave the picture transparent (`"none"`). */
  background?: "space" | "none";
  /** Print the lines "drawn from its numbers, not a photo" and "a generic look, not this star's surface" under the portrait. Default true. */
  captions?: boolean;
}

const TEXT = {
  en: {
    drawn: "Drawn from its numbers, not a photo.",
    generic: "A generic look, not this star's surface.",
    smooth: "A generic look: its surface is not shown.",
    measured: "Its flattened shape is measured.",
    sun: "Sun",
    earth: "Earth's orbit",
    mars: "Mars's orbit",
    jupiter: "Jupiter's orbit",
    times: "{n} times the Sun's radius",
    timesLess: "{n} of the Sun's radius",
    dot: "The dot in the middle is the Sun, to scale.",
    titlePortrait: "{name}, drawn from its numbers",
    titleCompare: "{name} next to the Sun",
  },
  ja: {
    drawn: "数値から描いた絵で、写真ではありません。",
    generic: "模様は一般的で、実際の表面ではありません。",
    smooth: "一般的な見た目で、表面は描いていません。",
    measured: "つぶれた形は測定されたものです。",
    sun: "太陽",
    earth: "地球の軌道",
    mars: "火星の軌道",
    jupiter: "木星の軌道",
    times: "太陽の半径の{n}倍",
    timesLess: "太陽の半径の{n}",
    dot: "中心の点が、同じ縮尺の太陽です。",
    titlePortrait: "{name}（数値から描いた絵）",
    titleCompare: "{name}と太陽の大きさくらべ",
  },
} as const;

const escape = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fill = (text: string, values: Record<string, string>): string => text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
const num = (value: number): string => (Math.round(value * 100) / 100).toString();

/** A small fixed generator (mulberry32): the same star always gets the same texture. */
function generator(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The look a profile is drawn with, or `undefined` where it has no temperature to draw.
 *
 * @param profile - A star's profile.
 * @returns The look, or `undefined` where the profile has no temperature.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";
 * import { portraitLook } from "@johnmorrisdotca/hoshi-stars/portrait";
 *
 * console.log(portraitLook(starProfile(starByName("Betelgeuse")!)), portraitLook(starProfile(starByName("Sirius")!)));
 * ```
 */
export function portraitLook(profile: StarProfile): PortraitLook | undefined {
  const T = profile.temperature?.value;
  if (T === undefined) return undefined;
  if (profile.shape !== undefined) return "fast-rotator";
  if (T >= 7500) return "hot";
  const cls = profile.luminosityClass;
  if (cls === "Ia" || cls === "Iab" || cls === "Ib" || cls === "I") return "supergiant";
  if (cls === "II" || cls === "III" || (profile.radius !== undefined && profile.radius.value > 4)) return "giant";
  return T < 4000 ? "red-dwarf" : "sun-like";
}

/** The intensity of a limb-darkened disc at a radius `r` (0 centre, 1 edge) for a linear coefficient `u`. */
const intensity = (u: number, r: number): number => 1 - u * (1 - Math.sqrt(Math.max(0, 1 - r * r)));

/** The stops of a radial gradient that darkens the disc toward its edge: black with the alpha the limb darkening takes away. */
function limbStops(u: number, extra: (r: number) => number = () => 0): string {
  let out = "";
  for (let i = 0; i <= 10; i++) {
    const r = i / 10;
    const alpha = 1 - intensity(u, r) * (1 - extra(r));
    out += `<stop offset="${num(r * 100)}%" stop-color="#000" stop-opacity="${num(Math.min(0.95, alpha))}"/>`;
  }
  return out;
}

/**
 * The texture: convection cells on a jittered hexagonal grid inside the unit disc, each a bright cell on a darker background (the dark lanes where cooler gas sinks), flattened toward the edge as a sphere
 * flattens them. The grid is as coarse as the star's cells are large: a few for a supergiant, many for a Sun-like star.
 */
function cells(look: PortraitLook, seed: number, radius: number, cx: number, cy: number): string {
  const spec: Partial<Record<PortraitLook, { spacing: number; light: number }>> = {
    supergiant: { spacing: 0.56, light: 0.3 },
    giant: { spacing: 0.3, light: 0.27 },
    "sun-like": { spacing: 0.115, light: 0.28 },
    "red-dwarf": { spacing: 0.16, light: 0.24 },
  };
  const one = spec[look];
  if (one === undefined) return "";
  const random = generator(seed);
  const step = one.spacing * radius;
  const rows = Math.ceil((2 * radius) / (step * 0.866)) + 2;
  let out = "";
  for (let row = -rows / 2; row <= rows / 2; row++) {
    for (let col = -rows / 2; col <= rows / 2; col++) {
      const jitterX = (random() - 0.5) * step * 0.4;
      const jitterY = (random() - 0.5) * step * 0.4;
      const grow = 0.92 + random() * 0.2;
      const bright = 0.55 + random() * 0.45;
      const dx = (col + (Math.round(row) % 2 === 0 ? 0 : 0.5)) * step + jitterX;
      const dy = row * step * 0.866 + jitterY;
      const r = Math.hypot(dx, dy) / radius;
      if (r > 1.04) continue;
      const mu = Math.sqrt(Math.max(0.03, 1 - Math.min(r, 1) ** 2));
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const x = cx + dx;
      const y = cy + dy;
      const size = step * 0.58 * grow;
      out += `<ellipse cx="${num(x)}" cy="${num(y)}" rx="${num(Math.max(size * mu, size * 0.2))}" ry="${num(size)}" transform="rotate(${num(angle)} ${num(x)} ${num(y)})" fill="#fff" fill-opacity="${num(one.light * bright)}"/>`;
    }
  }
  return out;
}

/**
 * A star drawn from its numbers as SVG text: a disc in the colour of its temperature, darker toward the edge by its limb-darkening coefficient, with a generic surface texture of the right kind of
 * cells for its type, and, for Altair and Regulus, the flattened and gravity-darkened shape that interferometers measured, and for Vega the round face of a star seen over its pole. The picture says, in its
 * own words, that it is drawn from numbers and that the texture is generic. Nothing in it is a photograph or an artist's guess at one star's markings.
 *
 * @param profile - A star's profile from `starProfile`.
 * @param options - Size, language, name, background and captions.
 * @returns An SVG document as a string, or `undefined` where the profile has no temperature to draw.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";
 * import { starPortrait } from "@johnmorrisdotca/hoshi-stars/portrait";
 *
 * const svg = starPortrait(starProfile(starByName("Betelgeuse")!), { name: "Betelgeuse", size: 320 });
 * console.log(svg?.slice(0, 40));
 * ```
 */
export function starPortrait(profile: StarProfile, options: PortraitOptions = {}): string | undefined {
  const look = portraitLook(profile);
  if (look === undefined || profile.colour === undefined || profile.limbDarkening === undefined) return undefined;
  const words = TEXT[options.lang === "ja" ? "ja" : "en"];
  const size = options.size ?? 240;
  const captions = options.captions !== false;
  const height = captions ? Math.round(size * 1.2) : size;
  const cx = size / 2;
  const cy = captions ? size * 0.46 : size / 2;
  const radius = size * 0.34;
  const id = `hs-${profile.hr ?? "star"}-${look}`;
  const name = options.name ?? (profile.hr === undefined ? "Star" : `HR ${profile.hr}`);
  const u = profile.limbDarkening;
  const shape = profile.shape;
  const base = profile.colour;

  // The silhouette: a circle, or the ellipse an oblate star shows at its inclination (the axis drawn upright).
  const rx = radius;
  let ry = radius;
  if (shape !== undefined && shape.kind === "oblate") {
    const i = (shape.inclinationDegrees * Math.PI) / 180;
    ry = radius * (Math.sqrt(shape.polarRadius ** 2 * Math.sin(i) ** 2 + shape.equatorialRadius ** 2 * Math.cos(i) ** 2) / shape.equatorialRadius);
  }
  const defs: string[] = [];
  const body: string[] = [];
  if (options.background !== "none") body.push(`<rect width="${size}" height="${height}" rx="${num(size * 0.04)}" fill="#0b1020"/>`);
  defs.push(`<radialGradient id="${id}-glow" cx="50%" cy="50%" r="50%"><stop offset="${num((radius / (radius * 1.9)) * 100)}%" stop-color="${base}" stop-opacity=".35"/><stop offset="100%" stop-color="${base}" stop-opacity="0"/></radialGradient>`);
  body.push(`<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(radius * 1.9)}" fill="url(#${id}-glow)"/>`);

  let fillRef = base;
  let darkening = limbStops(u);
  if (shape !== undefined) {
    const polar = blackBodyColour(shape.polarTemperatureK);
    const equator = blackBodyColour(shape.equatorialTemperatureK);
    const dim = Math.min(0.55, 1 - (shape.equatorialTemperatureK / shape.polarTemperatureK) ** 4);
    if (shape.kind === "oblate") {
      defs.push(`<linearGradient id="${id}-axis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${polar}"/><stop offset=".5" stop-color="${equator}"/><stop offset="1" stop-color="${polar}"/></linearGradient>`);
      defs.push(`<linearGradient id="${id}-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#000" stop-opacity="${num(dim)}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`);
      fillRef = `url(#${id}-axis)`;
    } else {
      // Seen over the pole: the hot pole is the middle of the disc and the cooler equator is its rim.
      defs.push(`<radialGradient id="${id}-axis" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${polar}"/><stop offset="1" stop-color="${equator}"/></radialGradient>`);
      fillRef = `url(#${id}-axis)`;
      darkening = limbStops(u, (r) => dim * r * r * 0.9);
    }
  }
  defs.push(`<radialGradient id="${id}-limb" cx="50%" cy="50%" r="50%">${darkening}</radialGradient>`);
  defs.push(`<clipPath id="${id}-clip"><ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}"/></clipPath>`);
  body.push(`<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}" fill="${fillRef}"/>`);
  if (shape !== undefined && shape.kind === "oblate") body.push(`<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}" fill="url(#${id}-band)"/>`);
  const texture = cells(look, profile.hr ?? 1, radius, cx, cy);
  if (texture !== "") {
    defs.push(`<filter id="${id}-soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${num(radius * (look === "supergiant" ? 0.025 : look === "giant" ? 0.015 : 0.004))}"/></filter>`);
    body.push(`<g clip-path="url(#${id}-clip)"><ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}" fill="#000" fill-opacity=".16"/><g filter="url(#${id}-soft)">${texture}</g></g>`);
  }
  body.push(`<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}" fill="url(#${id}-limb)"/>`);

  if (captions) {
    const fontSize = num(size * 0.043);
    const line = (text: string, at: number): string => `<text x="${num(cx)}" y="${num(at)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${fontSize}" fill="#c9d1ec">${escape(text)}</text>`;
    const second = look === "hot" || look === "fast-rotator" ? (shape === undefined ? words.smooth : `${words.measured}`) : words.generic;
    body.push(line(words.drawn, size * 0.93), line(second, size * 1.0));
    if (shape !== undefined) body.push(line(words.smooth, size * 1.07));
  }
  const title = escape(fill(words.titlePortrait, { name }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 ${size} ${height}" role="img" aria-label="${title}"><title>${title}</title><defs>${defs.join("")}</defs>${body.join("")}</svg>`;
}

const PLANETS = [
  { key: "earth", au: 1 },
  { key: "mars", au: 1.524 },
  { key: "jupiter", au: 5.203 },
] as const;
const AU_IN_SOLAR_RADII = 215.032;

/**
 * The star beside the Sun at one scale, as SVG text. A star smaller than about a hundred Suns is drawn as a disc next to the Sun's disc. A bigger one fills the picture, with the Sun a dot at its centre and the
 * orbits of Earth (and Mars and Jupiter where they fit) drawn over it, so a supergiant's size can be read against the solar system. The picture says how many times the Sun's radius the star is.
 *
 * @param profile - A star's profile from `starProfile`.
 * @param options - Size, language, name and background.
 * @returns An SVG document as a string, or `undefined` where the profile has no radius or no temperature.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";
 * import { starComparison } from "@johnmorrisdotca/hoshi-stars/portrait";
 *
 * const svg = starComparison(starProfile(starByName("Aldebaran")!), { name: "Aldebaran" });
 * console.log(svg?.includes("Earth's orbit"));
 * ```
 */
export function starComparison(profile: StarProfile, options: PortraitOptions = {}): string | undefined {
  const radius = profile.radius?.value;
  if (radius === undefined || profile.colour === undefined || profile.limbDarkening === undefined) return undefined;
  const words = TEXT[options.lang === "ja" ? "ja" : "en"];
  const size = options.size ?? 360;
  const height = Math.round(size * 0.86);
  const cx = size / 2;
  const cy = height * 0.43;
  const name = options.name ?? (profile.hr === undefined ? "Star" : `HR ${profile.hr}`);
  const id = `hs-cmp-${profile.hr ?? "star"}`;
  const sunColour = blackBodyColour(5772);
  const half = height * 0.37;
  const defs: string[] = [];
  const body: string[] = [];
  if (options.background !== "none") body.push(`<rect width="${size}" height="${height}" rx="${num(size * 0.03)}" fill="#0b1020"/>`);
  const disc = (name2: string, x: number, y: number, r: number, colour: string, u: number): void => {
    defs.push(`<radialGradient id="${id}-${name2}" cx="50%" cy="50%" r="50%">${limbStops(u)}</radialGradient>`);
    body.push(`<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="${colour}"/><circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="url(#${id}-${name2})"/>`);
  };
  const label = (text: string, x: number, y: number, anchor = "middle", opacity = 1): string => `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}" font-family="system-ui, sans-serif" font-size="${num(size * 0.04)}" fill="#e6ebff" fill-opacity="${opacity}" stroke="#0b1020" stroke-opacity=".8" stroke-width="2.5" paint-order="stroke">${escape(text)}</text>`;
  const ratio = radius >= 10 ? Math.round(radius).toLocaleString("en") : radius >= 1 ? radius.toFixed(1) : radius.toFixed(2);
  const lines: string[] = [];

  if (radius >= 100) {
    // The star fills the picture; the Sun is a dot; orbits show the scale.
    const reach = Math.max(radius * 1.12, AU_IN_SOLAR_RADII * 1.2);
    const px = half / reach;
    disc("star", cx, cy, radius * px, profile.colour, profile.limbDarkening);
    body.push(`<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(Math.max(1.6, px))}" fill="${sunColour}" stroke="#0b1020" stroke-width=".8"/>`);
    let first = true;
    for (const planet of PLANETS) {
      const r = planet.au * AU_IN_SOLAR_RADII * px;
      if (r > half * 1.02 && !first) continue;
      first = false;
      body.push(`<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.2" stroke-dasharray="4 3"/>`);
      body.push(label(words[planet.key], cx + r * 0.707, cy - r * 0.707 - 4, "start", 0.95));
    }
    lines.push(label(words.dot, cx, height - size * 0.035, "middle", 0.8));
  } else {
    const far = Math.max(radius, 1);
    const px = (Math.min(size * 0.22, half)) / far;
    const rs = 1 * px;
    const rr = radius * px;
    const gap = size * 0.06;
    const total = rs * 2 + rr * 2 + gap;
    const sunX = cx - total / 2 + rs;
    const starX = cx + total / 2 - rr;
    disc("sun", sunX, cy, rs, sunColour, 0.65);
    disc("star", starX, cy, rr, profile.colour, profile.limbDarkening);
    lines.push(label(words.sun, sunX, cy + Math.max(rs, rr) + size * 0.07));
    lines.push(label(name, starX, cy + Math.max(rs, rr) + size * 0.07));
  }
  lines.push(label(fill(radius >= 1 ? words.times : words.timesLess, { n: radius >= 1 ? ratio : `${(radius * 100).toFixed(radius < 0.1 ? 1 : 0)}%` }), cx, height - (radius >= 100 ? size * 0.09 : size * 0.05)));
  const title = escape(fill(words.titleCompare, { name }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 ${size} ${height}" role="img" aria-label="${title}"><title>${title}</title><defs>${defs.join("")}</defs>${body.join("")}${lines.join("")}</svg>`;
}
