// The black holes: the stellar-mass ones in X-ray binaries, the quiet ones found from a companion's orbit or a lensed star, and the supermassive ones at the centres of galaxies, each with its place on
// the sky, a mass and a distance with their ranges where the papers give them, the companion star, how it was found, the year, and the paper behind each fact. The black-hole tier
// (`@johnmorrisdotca/hoshi-stars/black-holes`): about 22 kB gzipped, kept apart so a page that does not draw black holes pays nothing. Pure: no DOM, no clock, no state beyond the parsed table.
import { BLACK_HOLE_REFERENCE_ROWS, BLACK_HOLE_ROWS } from "./data/black-holes.ts";

/**
 * The kinds of black hole, a small fixed list: `stellar` (in an X-ray binary, found by the X-rays it makes), `quiet` (found from the orbit of its companion star, or from how it bent the light of a
 * star behind it, and giving off almost nothing) and `supermassive` (at the centre of a galaxy).
 *
 * @example
 * ```ts
 * import { BLACK_HOLE_KINDS } from "@johnmorrisdotca/hoshi-stars/black-holes";
 *
 * console.log(BLACK_HOLE_KINDS.join(", "));
 * ```
 */
export const BLACK_HOLE_KINDS = ["stellar", "quiet", "supermassive"] as const;

/**
 * The kind of a black hole: `stellar`, `quiet` or `supermassive`.
 *
 * @example
 * ```ts
 * import { blackHole, type BlackHoleKind } from "@johnmorrisdotca/hoshi-stars/black-holes";
 *
 * const kind: BlackHoleKind = blackHole("Cygnus X-1")!.kind;
 * console.log(kind);
 * ```
 */
export type BlackHoleKind = (typeof BLACK_HOLE_KINDS)[number];

/**
 * The ways a black hole was found: `x-rays` (from the X-rays of gas falling in), `orbit` (from the orbit of a companion star), `microlensing` (from how it bent a background star's light), `stars` (from
 * stars orbiting it), `gas` (from gas orbiting it), `masers` (from water masers orbiting it), `echoes` (from the delay of light echoing through gas near it, "reverberation") and `image` (a picture of its shadow).
 *
 * @example
 * ```ts
 * import { BLACK_HOLE_FOUND } from "@johnmorrisdotca/hoshi-stars/black-holes";
 *
 * console.log(BLACK_HOLE_FOUND.length);
 * ```
 */
export const BLACK_HOLE_FOUND = ["x-rays", "orbit", "microlensing", "stars", "gas", "masers", "echoes", "image"] as const;

/**
 * How a black hole was found: one of `BLACK_HOLE_FOUND`.
 *
 * @example
 * ```ts
 * import { blackHole, type BlackHoleFound } from "@johnmorrisdotca/hoshi-stars/black-holes";
 *
 * const how: BlackHoleFound = blackHole("Gaia BH1")!.foundBy;
 * console.log(how);
 * ```
 */
export type BlackHoleFound = (typeof BLACK_HOLE_FOUND)[number];

/**
 * A number the papers give with its range: the best value, and the lowest and highest the paper allows, or only a limit.
 *
 * @example
 * ```ts
 * import { blackHole, type BlackHoleMeasure } from "@johnmorrisdotca/hoshi-stars/black-holes";
 *
 * const mass: BlackHoleMeasure = blackHole("Cygnus X-1")!.massSuns!;
 * console.log(mass.value, mass.low, mass.high);
 * ```
 */
export interface BlackHoleMeasure {
  /** The best value, or `undefined` where the paper gives only a range. */
  value: number | undefined;
  /** The lowest value the paper allows (about one standard deviation below, or the bottom of a range), or `undefined`. */
  low: number | undefined;
  /** The highest value the paper allows, or `undefined`. */
  high: number | undefined;
  /** `"lower"` where `value` is only a lower limit (a minimum), `"upper"` where it is only an upper limit, else `undefined`. */
  limit: "lower" | "upper" | undefined;
}

/**
 * A paper that a fact comes from.
 *
 * @example
 * ```ts
 * import { blackHole, type BlackHoleSource } from "@johnmorrisdotca/hoshi-stars/black-holes";
 *
 * const source: BlackHoleSource = blackHole("A0620-00")!.sources.mass[0]!;
 * console.log(source.citation, source.link);
 * ```
 */
export interface BlackHoleSource {
  /** A short key, unique in the table (`Cantrell2010`). */
  key: string;
  /** The citation: author, year, journal, volume and page (`Cantrell 2010, ApJ 710, 1127`). */
  citation: string;
  /** Where to read it: an NASA ADS, arXiv or Wikidata address, or `undefined`. */
  link: string | undefined;
}

/**
 * The papers behind each fact of a black hole: lists, empty where the fact is not known.
 *
 * @example
 * ```ts
 * import { blackHole, type BlackHoleSources } from "@johnmorrisdotca/hoshi-stars/black-holes";
 *
 * const sources: BlackHoleSources = blackHole("V404 Cygni")!.sources;
 * console.log(sources.distance.map((s) => s.citation));
 * ```
 */
export interface BlackHoleSources {
  /** Where the position is from. */
  position: BlackHoleSource[];
  /** Where the mass is from. */
  mass: BlackHoleSource[];
  /** Where the distance is from. */
  distance: BlackHoleSource[];
  /** Where the companion star's type is from. */
  companion: BlackHoleSource[];
  /** Where the year and the way it was found are from. */
  found: BlackHoleSource[];
}

/**
 * One black hole. Positions are J2000 (equator and equinox of 2000), the same frame as `Star` and `DeepSkyObject`.
 *
 * @example
 * ```ts
 * import { blackHole, type BlackHole } from "@johnmorrisdotca/hoshi-stars/black-holes";
 *
 * const cygnus: BlackHole = blackHole("Cygnus X-1")!;
 * console.log(cygnus.id, cygnus.kind, cygnus.massSuns?.value, cygnus.companion, cygnus.year);
 * ```
 */
export interface BlackHole {
  /** A short unique id made of lower-case letters, digits and hyphens (`cygnus-x-1`, `m87`). */
  id: string;
  /** The name: the object's usual name (`Cygnus X-1`), or for a supermassive black hole its galaxy's name with a star after it (`M87*`, `NGC 4258*`), as astronomers write Sagittarius A*. */
  name: string;
  /** Other names that `blackHole` finds too (`Cyg X-1`, `HDE 226868`; for `M87*`, `M87` and `NGC 4486`). Usually a few, sometimes none. */
  otherNames: string[];
  /** The kind: `stellar`, `quiet` or `supermassive`. */
  kind: BlackHoleKind;
  /** `confirmed` where the mass of the invisible object is measured above what a neutron star can have, from its pull on a companion, on stars, gas or masers around it, or from an image; else `candidate`: a source that acts like a black hole. */
  status: "confirmed" | "candidate";
  /** The IAU three-letter constellation abbreviation (`Cyg`), the same text as `Star.constellation`. */
  constellation: string;
  /** Right ascension in degrees at J2000, 0 up to 360. Given to 0.0001 degree (0.36 arc-second). */
  rightAscension: number;
  /** Declination in degrees at J2000, -90 to 90. Given to 0.0001 degree. */
  declination: number;
  /** The mass in Suns (solar masses) with its range, or `undefined` where there is no measure. */
  massSuns: BlackHoleMeasure | undefined;
  /** The distance in parsecs (1 parsec is 3.2616 light-years) with its range, or `undefined`. */
  distanceParsecs: BlackHoleMeasure | undefined;
  /** The companion star's designation (`HDE 226868`, `V404 Cyg`), or `undefined` where it has none or the black hole has no companion. */
  companion: string | undefined;
  /** The companion star's spectral type or kind (`O supergiant`, `K3 III`, `red giant`), or `undefined`. */
  companionType: string | undefined;
  /** How it was found. */
  foundBy: BlackHoleFound;
  /** The year: for a stellar black hole when its X-ray source was discovered, for a quiet one the year of its discovery paper, for a supermassive one the year of the mass measurement used. `undefined` where unknown. */
  year: number | undefined;
  /** The papers behind each fact. */
  sources: BlackHoleSources;
  /** A short English note where the facts need one (a disputed mass, an unusual place), else `undefined`. */
  note: string | undefined;
}

/**
 * The options of `blackHoles`: all optional, and together they narrow the list.
 *
 * @example
 * ```ts
 * import { blackHoles, type BlackHoleOptions } from "@johnmorrisdotca/hoshi-stars/black-holes";
 *
 * const options: BlackHoleOptions = { kind: "stellar", status: "confirmed" };
 * console.log(blackHoles(options).map((b) => b.name));
 * ```
 */
export interface BlackHoleOptions {
  /** Only black holes of that kind. */
  kind?: BlackHoleKind;
  /** Only black holes with that status. */
  status?: "confirmed" | "candidate";
  /** Only black holes found that way. */
  foundBy?: BlackHoleFound;
  /** Only black holes in that constellation (the abbreviation, `Sgr`). */
  constellation?: string;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function number(text: string): number | undefined {
  return text === "" ? undefined : Number(text);
}

function measure(value: string, low: string, high: string, limit: string): BlackHoleMeasure | undefined {
  const m = { value: number(value), low: number(low), high: number(high), limit: limit === ">" ? ("lower" as const) : limit === "<" ? ("upper" as const) : undefined };
  return m.value === undefined && m.low === undefined && m.high === undefined ? undefined : Object.freeze(m);
}

const WORLD = "https://ui.adsabs.harvard.edu/abs/";

function linkOf(link: string): string | undefined {
  if (link === "") return undefined;
  if (link.startsWith("http")) return link;
  if (link.startsWith("arXiv:")) return `https://arxiv.org/abs/${link.slice(6)}`;
  return `${WORLD}${encodeURIComponent(link)}`;
}

let table: { all: BlackHole[]; byKey: Map<string, BlackHole> } | undefined;

function load(): { all: BlackHole[]; byKey: Map<string, BlackHole> } {
  if (table !== undefined) return table;
  const sourceOf = new Map<string, BlackHoleSource>();
  for (const row of BLACK_HOLE_REFERENCE_ROWS.split("\n")) {
    const [key, link, citation] = row.split("|") as [string, string, string];
    sourceOf.set(key, Object.freeze({ key, citation, link: linkOf(link) }));
  }
  const sourcesOf = (text: string): BlackHoleSource[] => Object.freeze(text === "" ? [] : text.split("+").map((key) => sourceOf.get(key)!)) as BlackHoleSource[];
  const all: BlackHole[] = [];
  const byKey = new Map<string, BlackHole>();
  const ambiguous = new Set<string>();
  const add = (text: string, object: BlackHole): void => {
    const k = fold(text);
    if (k === "") return;
    const other = byKey.get(k);
    if (other !== undefined && other !== object) ambiguous.add(k);
    else byKey.set(k, object);
  };
  for (const row of BLACK_HOLE_ROWS.split("\n")) {
    const p = row.split("|") as string[];
    const refs = (p[20] ?? "").split(",");
    const object: BlackHole = Object.freeze({
      id: p[0]!,
      name: p[1]!,
      otherNames: Object.freeze(p[2] === "" ? [] : p[2]!.split(";")) as string[],
      kind: BLACK_HOLE_KINDS[Number(p[3])]!,
      status: p[4] === "0" ? ("confirmed" as const) : ("candidate" as const),
      constellation: p[7]!,
      rightAscension: Number(p[5]) / 10000,
      declination: Number(p[6]) / 10000,
      massSuns: measure(p[8]!, p[9]!, p[10]!, p[11]!),
      distanceParsecs: measure(p[12]!, p[13]!, p[14]!, p[15]!),
      companion: p[16] === "" ? undefined : p[16],
      companionType: p[17] === "" ? undefined : p[17],
      foundBy: BLACK_HOLE_FOUND[Number(p[18])]!,
      year: number(p[19]!),
      sources: Object.freeze({
        position: sourcesOf(refs[0] ?? ""),
        mass: sourcesOf(refs[1] ?? ""),
        distance: sourcesOf(refs[2] ?? ""),
        companion: sourcesOf(refs[3] ?? ""),
        found: sourcesOf(refs[4] ?? ""),
      }),
      note: p[21] === "" || p[21] === undefined ? undefined : p[21],
    });
    all.push(object);
    add(object.id, object);
    add(object.name, object);
    for (const other of object.otherNames) add(other, object);
  }
  for (const k of ambiguous) byKey.delete(k);
  table = { all, byKey };
  return table;
}

/**
 * Every known black hole that has a place on the sky and a published mass or a published case for one: the stellar-mass ones in X-ray binaries (BlackCAT's 73 and a few more), the quiet ones (Gaia BH1,
 * BH2 and BH3, VFTS 243, the lone black hole OGLE-2011-BLG-0462) and the supermassive ones at the centres of galaxies with a measured mass. The stellar ones come first, then the quiet, then the supermassive, each
 * group by right ascension. Candidates are in the list with `status` `"candidate"`; gravitational-wave events are not (they have no single place).
 *
 * @param options - `kind`, `status`, `foundBy` and `constellation` narrow the list.
 * @returns A fresh array of the shared, frozen objects.
 * @throws RangeError if `kind`, `status` or `foundBy` is not one of the listed values. TypeError if `constellation` is not a string.
 *
 * @example
 * ```ts
 * import { blackHoles } from "@johnmorrisdotca/hoshi-stars/black-holes";
 *
 * console.log(blackHoles().length, blackHoles({ kind: "supermassive" }).length);
 * ```
 */
export function blackHoles(options: BlackHoleOptions = {}): BlackHole[] {
  const { kind, status, foundBy, constellation } = options;
  if (kind !== undefined && !BLACK_HOLE_KINDS.includes(kind)) throw new RangeError(`kind must be one of ${BLACK_HOLE_KINDS.join(", ")}, got ${JSON.stringify(kind)}`);
  if (status !== undefined && status !== "confirmed" && status !== "candidate") throw new RangeError(`status must be "confirmed" or "candidate", got ${JSON.stringify(status)}`);
  if (foundBy !== undefined && !BLACK_HOLE_FOUND.includes(foundBy)) throw new RangeError(`foundBy must be one of ${BLACK_HOLE_FOUND.join(", ")}, got ${JSON.stringify(foundBy)}`);
  if (constellation !== undefined && typeof constellation !== "string") throw new TypeError(`constellation must be a string, got ${typeof constellation}`);
  return load().all.filter((b) => (kind === undefined || b.kind === kind) && (status === undefined || b.status === status) && (foundBy === undefined || b.foundBy === foundBy) && (constellation === undefined || b.constellation === constellation));
}

/**
 * A black hole by any of its names, ignoring case, spacing, punctuation and the star after a name: `Cygnus X-1`, `cyg x-1`, `HDE 226868`, `V404 Cyg`, `Sgr A*`, `M87`, `M87*`, `NGC 4486`, or its id. A name two black
 * holes share finds neither.
 *
 * @param text - The name.
 * @returns The black hole, or `undefined` if the text names none.
 * @throws TypeError if `text` is not a string.
 *
 * @example
 * ```ts
 * import { blackHole } from "@johnmorrisdotca/hoshi-stars/black-holes";
 *
 * console.log(blackHole("Sgr A*")?.massSuns?.value, blackHole("M87")?.distanceParsecs?.value, blackHole("v404 cyg")?.name);
 * ```
 */
export function blackHole(text: string): BlackHole | undefined {
  if (typeof text !== "string") throw new TypeError(`text must be a string, got ${typeof text}`);
  return load().byKey.get(fold(text));
}
