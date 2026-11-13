// The sky seen from another star, for the demo and the embed page: which stars are offered, how a choice is written in an address (`from=HR5459`), and the sky it gives.
import { starByHr, starDistance, type Star } from "../src/index.ts";
import { skyFrom, type SeenSky } from "../src/sky-from.ts";
import type { NearbyStar } from "../src/nearby.ts";
import { nearViewpointOf, type NearViewpoint } from "./near-viewpoints.ts";

/** The stars the "View from" choice offers by name, with the Bright Star Catalogue number each is written as in an address. Alpha Centauri is the nearer pair's brighter star, Rigil Kentaurus. */
export const FAMOUS: ReadonlyArray<{ hr: number; en: string; ja: string }> = [
  { hr: 5459, en: "Alpha Centauri", ja: "ケンタウルス座α星" },
  { hr: 2491, en: "Sirius", ja: "シリウス" },
  { hr: 2943, en: "Procyon", ja: "プロキオン" },
  { hr: 7557, en: "Altair", ja: "アルタイル" },
  { hr: 7001, en: "Vega", ja: "ベガ" },
  { hr: 8728, en: "Fomalhaut", ja: "フォーマルハウト" },
  { hr: 5340, en: "Arcturus", ja: "アークトゥルス" },
  { hr: 2990, en: "Pollux", ja: "ポルックス" },
  { hr: 1457, en: "Aldebaran", ja: "アルデバラン" },
  { hr: 2061, en: "Betelgeuse", ja: "ベテルギウス" },
];

/** The star an address names (`HR5459`), or `undefined` when it names none, or one with no distance: a sky cannot be seen from it. */
export function viewpointOf(text: string | null | undefined): Star | undefined {
  const found = /^HR(\d{1,5})$/.exec(text ?? "");
  const star = found === null ? undefined : starByHr(Number(found[1]));
  return star !== undefined && starDistance(star) !== undefined ? star : undefined;
}

export const fromText = (star: Star): string => `HR${star.hr}`;

let last: { hr: number; sky: SeenSky } | undefined;
/** The sky seen from a star, kept for the next call with the same star. */
export function skyOf(star: Star | undefined): SeenSky | undefined {
  if (star === undefined) return undefined;
  if (last?.hr !== star.hr) last = { hr: star.hr, sky: skyFrom(star) };
  return last.sky;
}

/** A star a sky can be seen from: a bright star, or a nearby one (Proxima Centauri) once `loadViewpoint` has read the nearby table. */
export type Viewpoint = Star | NearbyStar;

const loaded = new Map<string, NearbyStar>();

/** The viewpoint an address text names (`HR5459`, `GCTP3278`) if it is ready now: a bright star at once, a nearby star once `loadViewpoint` has read it. */
export function readyViewpointOf(text: string | null | undefined): Viewpoint | undefined {
  const near = nearViewpointOf(text);
  return near === undefined ? viewpointOf(text) : loaded.get(near.key);
}

/** Like `readyViewpointOf`, but reads the nearby table first (a separate chunk, loaded only for a nearby star) where the text names one. `undefined` for text that names no star with a distance. */
export async function loadViewpoint(text: string | null | undefined): Promise<Viewpoint | undefined> {
  const near = nearViewpointOf(text);
  if (near === undefined) return viewpointOf(text);
  if (!loaded.has(near.key)) {
    const { nearbyStarByName } = await import("../src/nearby.ts");
    const found = nearbyStarByName(near.query);
    if (found !== undefined && found.lightYears !== undefined) loaded.set(near.key, found);
  }
  return loaded.get(near.key);
}

/** How an address writes a viewpoint: `HR5459` for a bright star, `GCTP3278` for a nearby one. */
export const viewpointText = (star: Viewpoint): string => ("hr" in star ? fromText(star) : `GCTP${star.gctp}`);

/** The name of a viewpoint in a language: the offered name, else the star's own name, else its catalogue number. */
export function viewpointName(star: Viewpoint, lang: "en" | "ja"): string {
  if ("hr" in star) return FAMOUS.find((one) => one.hr === star.hr)?.[lang] ?? star.name ?? `HR ${star.hr}`;
  const offered: NearViewpoint | undefined = nearViewpointOf(`GCTP${star.gctp}`);
  return offered?.[lang] ?? star.name ?? `GCTP ${star.gctp}`;
}
