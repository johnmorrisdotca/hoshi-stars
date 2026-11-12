// Your own points on the chart: an observing log, a comet's track, the stars you have seen. The pure part: which markers a time range shows (and how strongly), in what order a group is joined,
// the span a slider covers, and CSV in and out. No DOM, no clock: a moment is always a marker's own `date`. The drawing is markers-draw.ts; the element and `chartSvg` pass the markers through.

/**
 * A moment: an ISO 8601 text (`2026-11-08` or `2026-11-08T21:30:00Z`), milliseconds since 1970 (what `Date.now()` and `getTime()` give), or a `Date`.
 *
 * @example
 * ```ts
 * import type { MarkerWhen } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const moments: MarkerWhen[] = ["2026-11-08", 1794096000000, new Date(Date.UTC(2026, 10, 8))];
 * console.log(moments.length);
 * // 3
 * ```
 */
export type MarkerWhen = string | number | Date;

/**
 * One point of your own on the chart. Only `ra` and `dec` are needed.
 *
 * @example
 * ```ts
 * import type { SkyMarker } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const seen: SkyMarker = { id: "m42-night", ra: 83.82, dec: -5.39, date: "2026-11-08T21:30:00Z", label: "M42, 8x40 binoculars", group: "Observing log" };
 * console.log(seen.label);
 * // M42, 8x40 binoculars
 * ```
 */
export interface SkyMarker {
  /** What a click says it was (`hoshi-marker`'s `id`); `m<position in the list>` when left out. */
  id?: string | undefined;
  /** Where, in degrees: right ascension 0 to 360 and declination -90 to 90 (J2000). A marker with a number that is not finite is not drawn. */
  ra: number;
  dec: number;
  /** When. A marker with a date is shown by the time range and joined into a track in date order; one without is always shown and is never joined. */
  date?: MarkerWhen | undefined;
  /** The name written beside it, placed clear of the stars and of every other name. */
  label?: string | undefined;
  /** Any CSS colour (`#ff8fb1` by default). */
  color?: string | undefined;
  /** The dot's width in pixels (9 by default). */
  size?: number | undefined;
  /** What it belongs to (`Observing log`, `Comet`): a track joins one group at a time. */
  group?: string | undefined;
}

/**
 * The moments to show: markers dated from `from` to `to`, both ends included. A marker with no date is always shown.
 *
 * @example
 * ```ts
 * import type { MarkerRange } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const november: MarkerRange = { from: "2026-11-01", to: "2026-11-30", fade: 2 };
 * console.log(november.fade);
 * // 2
 * ```
 */
export interface MarkerRange {
  /** The earliest moment shown; no limit when left out. */
  from?: MarkerWhen | undefined;
  /** The latest moment shown; no limit when left out. */
  to?: MarkerWhen | undefined;
  /** Days over which a marker comes in from the edge of the range (and goes out at the other end): at the edge it is faint, `fade` days inside it is full. 0, a clean cut, by default. */
  fade?: number | undefined;
}

/**
 * A marker the range lets through: the marker, its place in the list, the id it answers to, its moment in milliseconds and how strongly it is drawn.
 *
 * @example
 * ```ts
 * import { visibleMarkers, type VisibleMarker } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const [first]: VisibleMarker[] = visibleMarkers([{ ra: 84, dec: 0, date: "2026-11-08" }]);
 * console.log(first?.id, first?.opacity);
 * // m0 1
 * ```
 */
export interface VisibleMarker {
  marker: SkyMarker;
  index: number;
  id: string;
  /** Milliseconds since 1970; `undefined` for a marker with no (readable) date. */
  time: number | undefined;
  /** 1 in the middle of the range; down to 0.2 at an edge when the range has a `fade`. */
  opacity: number;
}

/**
 * A group joined in date order.
 *
 * @example
 * ```ts
 * import { markerTracks, visibleMarkers, type MarkerTrack } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const tracks: MarkerTrack[] = markerTracks(visibleMarkers([{ ra: 1, dec: 1, date: 2 }, { ra: 2, dec: 2, date: 1 }]), true);
 * console.log(tracks[0]?.items.map((item) => item.id));
 * // [ 'm1', 'm0' ]
 * ```
 */
export interface MarkerTrack {
  group: string;
  items: VisibleMarker[];
}

const DAY = 86_400_000;
/** The faintest a marker is drawn while it is inside the range. */
const FLOOR = 0.2;

/**
 * A moment in milliseconds since 1970.
 *
 * @param when - An ISO 8601 text, a number of milliseconds or a `Date`.
 * @returns The milliseconds, or `undefined` when there is none or it cannot be read.
 *
 * @example
 * ```ts
 * import { markerTime } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * console.log(markerTime("2026-11-08"), markerTime("not a date"));
 * // 1794096000000 undefined
 * ```
 */
export function markerTime(when: MarkerWhen | undefined): number | undefined {
  if (when === undefined || when === null) return undefined;
  const ms = typeof when === "number" ? when : when instanceof Date ? when.getTime() : /^\s*$/.test(when) ? Number.NaN : Date.parse(when);
  return Number.isFinite(ms) ? ms : undefined;
}

/** Whether a marker can be drawn: its place is a pair of finite numbers. */
const placed = (marker: SkyMarker): boolean => marker !== null && typeof marker === "object" && Number.isFinite(marker.ra) && Number.isFinite(marker.dec);

/**
 * The markers a time range lets through, in the order given, each with how strongly it is drawn. Pure: the range is always the page's own.
 *
 * @param markers - The markers.
 * @param range - The moments to show; every marker when left out.
 * @returns The markers that can be drawn and are in the range.
 *
 * @example
 * ```ts
 * import { visibleMarkers } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const log = [
 *   { ra: 83.8, dec: -5.4, date: "2026-11-01" },
 *   { ra: 88.8, dec: 7.4, date: "2026-11-09" },
 *   { ra: 101.3, dec: -16.7 },
 * ];
 * console.log(visibleMarkers(log, { from: "2026-11-05", to: "2026-11-30" }).map((m) => m.id));
 * // [ 'm1', 'm2' ]
 * ```
 */
export function visibleMarkers(markers: readonly SkyMarker[], range?: MarkerRange): VisibleMarker[] {
  const from = markerTime(range?.from);
  const to = markerTime(range?.to);
  const fade = Math.max(0, Number.isFinite(range?.fade) ? range!.fade! : 0) * DAY;
  const out: VisibleMarker[] = [];
  markers.forEach((marker, index) => {
    if (!placed(marker)) return;
    const time = markerTime(marker.date);
    let opacity = 1;
    if (time !== undefined) {
      if ((from !== undefined && time < from) || (to !== undefined && time > to)) return;
      if (fade > 0) {
        const edge = Math.min(from === undefined ? Infinity : time - from, to === undefined ? Infinity : to - time);
        opacity = edge >= fade ? 1 : FLOOR + (1 - FLOOR) * Math.max(0, edge / fade);
      }
    }
    out.push({ marker, index, id: marker.id ?? `m${index}`, time, opacity });
  });
  return out;
}

/**
 * The groups to join, each in date order, from the markers a range let through. A group with fewer than two dated markers has nothing to join. Markers with the same moment keep the order given.
 *
 * @param visible - What `visibleMarkers` returned.
 * @param tracks - `true` joins every group (markers with no `group` are one group, named `""`); a list of names joins those groups; `false` or nothing joins none.
 * @returns The tracks, in the order their groups first appear.
 *
 * @example
 * ```ts
 * import { markerTracks, visibleMarkers } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const comet = [
 *   { ra: 10, dec: 5, date: "2026-11-03", group: "Comet" },
 *   { ra: 8, dec: 4, date: "2026-11-01", group: "Comet" },
 *   { ra: 40, dec: 20, date: "2026-11-02", group: "Log" },
 * ];
 * console.log(markerTracks(visibleMarkers(comet), ["Comet"]).map((t) => t.items.map((i) => i.id)));
 * // [ [ 'm1', 'm0' ] ]
 * ```
 */
export function markerTracks(visible: readonly VisibleMarker[], tracks: boolean | readonly string[] | undefined): MarkerTrack[] {
  if (tracks === undefined || tracks === false) return [];
  const wanted = tracks === true ? undefined : new Set(tracks);
  const groups = new Map<string, VisibleMarker[]>();
  for (const item of visible) {
    if (item.time === undefined) continue;
    const group = item.marker.group ?? "";
    if (wanted !== undefined && !wanted.has(group)) continue;
    const list = groups.get(group);
    if (list === undefined) groups.set(group, [item]);
    else list.push(item);
  }
  return [...groups].filter(([, items]) => items.length >= 2).map(([group, items]) => ({ group, items: items.sort((a, b) => a.time! - b.time! || a.index - b.index) }));
}

/**
 * The first and last moment among the markers: what a time slider spans.
 *
 * @param markers - The markers.
 * @returns The earliest and latest date in milliseconds, or `undefined` when no marker has a date.
 *
 * @example
 * ```ts
 * import { markerSpan } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const span = markerSpan([{ ra: 0, dec: 0, date: "2026-11-01" }, { ra: 1, dec: 1, date: "2026-11-03" }, { ra: 2, dec: 2 }]);
 * console.log(span ? (span.to - span.from) / 86_400_000 : 0);
 * // 2
 * ```
 */
export function markerSpan(markers: readonly SkyMarker[]): { from: number; to: number } | undefined {
  let from = Infinity;
  let to = -Infinity;
  for (const marker of markers) {
    const time = markerTime(marker?.date);
    if (time === undefined) continue;
    if (time < from) from = time;
    if (time > to) to = time;
  }
  return from > to ? undefined : { from, to };
}

const COLUMNS = ["id", "ra", "dec", "date", "label", "color", "size", "group"] as const;
const cell = (value: unknown): string => {
  const text = value === undefined || value === null ? "" : value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * The markers as CSV, one row each, with a header: `id,ra,dec,date,label,color,size,group`. A `Date` is written as ISO 8601.
 *
 * @param markers - The markers.
 * @returns The CSV text, rows ending in a newline.
 *
 * @example
 * ```ts
 * import { markersToCsv } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * console.log(markersToCsv([{ ra: 83.8, dec: -5.4, date: "2026-11-01", label: "M42, Orion Nebula" }]));
 * // id,ra,dec,date,label,color,size,group
 * // ,83.8,-5.4,2026-11-01,"M42, Orion Nebula",,,
 * ```
 */
export function markersToCsv(markers: readonly SkyMarker[]): string {
  return [COLUMNS.join(","), ...markers.map((marker) => COLUMNS.map((column) => cell(marker[column])).join(","))].join("\n") + "\n";
}

/** The rows of a CSV text: quotes (`""` for a quote), commas and line breaks inside quotes, either line ending. */
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

/**
 * Markers from a list: what `JSON.parse` gave, or any array. An entry with no finite `ra` and `dec` (numbers or numeric text) is dropped; right ascension is wrapped to 0 up to 360 and declination held to -90 to 90;
 * text fields are kept as text. A `date` is kept as given, when it is a text, a number or a `Date`.
 *
 * @param input - The list.
 * @returns The markers that could be read.
 *
 * @example
 * ```ts
 * import { normaliseMarkers } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * console.log(normaliseMarkers(JSON.parse('[{"ra":"370","dec":12,"label":"A"},{"ra":null,"dec":1}]')));
 * // [ { ra: 10, dec: 12, label: 'A' } ]
 * ```
 */
export function normaliseMarkers(input: unknown): SkyMarker[] {
  if (!Array.isArray(input)) return [];
  const out: SkyMarker[] = [];
  for (const entry of input as unknown[]) {
    if (entry === null || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const number = (value: unknown): number => (typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN);
    const ra = number(e["ra"]);
    const dec = number(e["dec"]);
    if (!Number.isFinite(ra) || !Number.isFinite(dec)) continue;
    const marker: SkyMarker = { ra: ((ra % 360) + 360) % 360, dec: Math.max(-90, Math.min(90, dec)) };
    const text = (key: string): string | undefined => (typeof e[key] === "string" && e[key] !== "" ? (e[key] as string) : typeof e[key] === "number" ? String(e[key]) : undefined);
    const id = text("id");
    const label = text("label");
    const color = text("color");
    const group = text("group");
    if (id !== undefined) marker.id = id;
    const date = e["date"];
    if ((typeof date === "string" && date !== "") || (typeof date === "number" && Number.isFinite(date)) || date instanceof Date) marker.date = date;
    if (label !== undefined) marker.label = label;
    if (color !== undefined) marker.color = color;
    const size = number(e["size"]);
    if (Number.isFinite(size) && size > 0) marker.size = size;
    if (group !== undefined) marker.group = group;
    out.push(marker);
  }
  return out;
}

/**
 * Markers from CSV text, the way `markersToCsv` writes it: a header row naming the columns (`ra` and `dec` are needed; `id`, `date`, `label`, `color`, `size` and `group` are used when present, in any order). A row that
 * cannot be read is dropped (see `normaliseMarkers`).
 *
 * @param text - The CSV.
 * @returns The markers.
 *
 * @example
 * ```ts
 * import { markersFromCsv } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * console.log(markersFromCsv('label,dec,ra,date\n"M42, Orion Nebula",-5.4,83.8,2026-11-01\n'));
 * // [ { ra: 83.8, dec: -5.4, date: '2026-11-01', label: 'M42, Orion Nebula' } ]
 * ```
 */
export function markersFromCsv(text: string): SkyMarker[] {
  const [header, ...rows] = csvRows(text.replace(/^\uFEFF/, ""));
  if (header === undefined) return [];
  const names = header.map((name) => name.trim().toLowerCase());
  return normaliseMarkers(rows.map((row) => Object.fromEntries(names.map((name, i) => [name, row[i]]))));
}
