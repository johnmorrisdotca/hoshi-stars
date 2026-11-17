// A page's own points on the sky ("marks"): a satellite's place each second, a probe, a landmark. This file says what a mark is and cleans what a page gives. Pure: no DOM, no clock.

/**
 * One point a page puts on the sky: where it stands over the place as an azimuth and an altitude, and a name. A press on it sends `hoshi-sky-mark` with its `id`.
 *
 * @example
 * ```ts
 * import type { SkyMark } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const station: SkyMark = { id: "iss", azimuth: 250, altitude: 42, label: "ISS", kind: "satellite" };
 * console.log(station.id);
 * ```
 */
export interface SkyMark {
  /** What the page calls it: sent back when it is pressed. */
  id: string;
  /** Degrees from north through east, 0 up to 360. */
  azimuth: number;
  /** Degrees above the horizon; a mark below the horizon is drawn dimmed. */
  altitude: number;
  /** The name drawn beside it. */
  label: string;
  /** What it is: a `satellite` is drawn as a diamond, anything else (or nothing) as a dot. */
  kind?: string;
}

/**
 * The most marks kept: more are left off, so a page that sends thousands cannot make a draw slow.
 *
 * @example
 * ```ts
 * import { MARKS_MAX } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(MARKS_MAX); // 500
 * ```
 */
export const MARKS_MAX = 500;

/**
 * Make a list of marks safe to draw: an entry with no `id`, or an azimuth or altitude that is not a finite number, is dropped; of two with the same `id` the first is kept; the azimuth is brought into 0 up to 360 and the altitude held to -90 up to 90;
 * a label that is not a text is the `id`; at most `MARKS_MAX` are kept. A value that is not a list gives none.
 *
 * @param input - What a page gave.
 * @returns A new list of new marks.
 *
 * @example
 * ```ts
 * import { cleanMarks } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(cleanMarks([{ id: "iss", azimuth: -110, altitude: 42, label: "ISS", kind: "satellite" }, { id: "bad", azimuth: NaN, altitude: 1, label: "x" }, null]));
 * ```
 */
export function cleanMarks(input: unknown): SkyMark[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: SkyMark[] = [];
  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, azimuth, altitude, label, kind } = entry as Record<string, unknown>;
    if ((typeof id !== "string" && typeof id !== "number") || String(id) === "" || seen.has(String(id))) continue;
    if (typeof azimuth !== "number" || typeof altitude !== "number" || !Number.isFinite(azimuth) || !Number.isFinite(altitude)) continue;
    seen.add(String(id));
    out.push({ id: String(id), azimuth: (((azimuth % 360) + 360) % 360), altitude: Math.max(-90, Math.min(90, altitude)), label: typeof label === "string" ? label : String(id), ...(typeof kind === "string" ? { kind } : {}) });
    if (out.length >= MARKS_MAX) break;
  }
  return out;
}

/**
 * Whether two lists of marks are the same, mark for mark: a page that sends the same places again does not make the sky draw again.
 *
 * @param a - A list.
 * @param b - Another.
 * @returns `true` when they have the same marks in the same order.
 *
 * @example
 * ```ts
 * import { sameMarks } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const a = [{ id: "iss", azimuth: 250, altitude: 42, label: "ISS" }];
 * console.log(sameMarks(a, [{ ...a[0]! }]), sameMarks(a, [{ ...a[0]!, altitude: 43 }]));
 * ```
 */
export function sameMarks(a: readonly SkyMark[], b: readonly SkyMark[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((m, i) => m.id === b[i]!.id && m.azimuth === b[i]!.azimuth && m.altitude === b[i]!.altitude && m.label === b[i]!.label && m.kind === b[i]!.kind);
}
