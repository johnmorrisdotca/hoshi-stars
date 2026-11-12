// The sample the markers page opens with: stars seen on some evenings (real stars, an invented log) and a comet crossing Taurus and Orion (an invented path: it is not any comet's orbit). Times are the reader's own evening.
import { starByHr } from "../src/index.ts";
import type { SkyMarker } from "../src/chart/markers.ts";

/** Bright stars by HR number, in the order they were "seen". */
const SEEN: ReadonlyArray<[number, number]> = [[2061, 2], [1713, 4], [2491, 6], [1457, 9], [2943, 12], [1708, 15], [2990, 18]];

/**
 * The sample markers: the evenings stars were seen, and a comet's invented track.
 *
 * @param ja - Names in Japanese where the catalogue has them.
 * @param year - The year of the dates; the sample is for November of it.
 * @returns The markers.
 *
 * @example
 * ```ts
 * import { sampleMarkers } from "./markers-sample.ts";
 *
 * console.log(sampleMarkers(false, 2026).length);
 * // 29
 * ```
 */
export function sampleMarkers(ja: boolean, year: number): SkyMarker[] {
  const night = (day: number, hour: number): string => `${year}-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00`;
  const log: SkyMarker[] = SEEN.map(([hr, day]) => {
    const star = starByHr(hr)!;
    return { id: `seen-${hr}`, ra: star.rightAscension, dec: star.declination, date: night(day, 20), label: ja ? star.nameJa ?? star.name ?? `HR ${hr}` : star.name ?? `HR ${hr}`, color: "#9be7ff", size: 10, group: ja ? "見た星 (見本)" : "Stars I've seen (sample)" };
  });
  const comet: SkyMarker[] = Array.from({ length: 22 }, (_, i) => ({
    id: `comet-${i + 1}`,
    ra: 58 + i * 2.2,
    dec: 24 - i * 1.15 + Math.sin(i / 3) * 1.2,
    date: night(i + 1, 21),
    label: i % 3 === 0 ? (ja ? `彗星 ${i + 1}日` : `Comet, ${i + 1} Nov`) : undefined,
    color: "#ff8fb1",
    size: 6 + Math.round(Math.sin((i / 21) * Math.PI) * 4),
    group: ja ? "彗星 (架空の軌道)" : "A comet (invented path)",
  }));
  return [...log, ...comet];
}
