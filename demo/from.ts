// The sky seen from another star, for the demo and the embed page: which stars are offered, how a choice is written in an address (`from=HR5459`), and the sky it gives.
import { starByHr, starDistance, type Star } from "../src/index.ts";
import { skyFrom, type SeenSky } from "../src/sky-from.ts";
import { NO_GCTP } from "./build.ts";

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
  if (last?.hr !== star.hr) last = { hr: star.hr, sky: NO_GCTP ? withoutCompanions(star, skyFrom(star)) : skyFrom(star) };
  return last.sky;
}

/**
 * The fallback build only. A parallax with no error is taken as exact by `skyFrom`, so a companion that shares the viewpoint's parallax (Alpha Centauri B, from Alpha Centauri A) is left a few
 * thousandths of a light-year away and shines at magnitude -24. The Yale build drops it because the Yale error is bigger than that gap. Here the viewpoint's error is taken as the Bright Star
 * Catalogue's rounding, half a milliarcsecond, and a star nearer than that is left out and counted in `skipped`, as `skyFrom` does with an error it is given.
 */
function withoutCompanions(star: Star, sky: SeenSky): SeenSky {
  const distance = starDistance(star);
  if (distance === undefined || star.parallaxErrorMas !== undefined) return sky;
  const slack = (distance.lightYears * 0.5) / star.parallaxMas;
  const kept = sky.filter((seen) => seen.lightYears > slack);
  return Object.assign(kept, { skipped: sky.skipped + (sky.length - kept.length) });
}
