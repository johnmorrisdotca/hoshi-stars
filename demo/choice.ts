// What the demo, the embed page and the code to copy all agree on: a chart as a handful of choices, and how they are written into an address.
import { defaultZoom, LAYERS, DEFAULT_VIEW, ZOOM_MAX, ZOOM_MIN, type Language, type Layer, type View } from "./chart.ts";
import { cultureOf, DEFAULT_CULTURE } from "./cultures.ts";
import { fromText, viewpointOf } from "./from.ts";
import { PROJECTIONS, type Projection } from "../src/projection.ts";
import { lookIdOf, type LookId } from "./sky-overlay.ts";
import { CONSTELLATION_LINES_ATTRIBUTE, lineStrengthFromAttribute, STAR_NAMES_ATTRIBUTES, starNamesFromAttributes, type StarNamesSettings } from "../src/sky-labels.ts";

export const DEFAULT_LAYERS: readonly Layer[] = ["milky", "lines", "names", "pictures", "faint", "grid"];
export const DEFAULT_MAGNITUDE = 5;

/** A chart: the view, the faintest star, the layers and, for a page that draws one constellation brighter, its abbreviation. */
export interface Choice extends View {
  magnitude: number;
  layers: ReadonlySet<Layer>;
  lang: Language;
  highlight?: string | undefined;
  /** For a page that rings what is near a star, a Messier object or a constellation: its key (`S:2491`, `D:M31`, `C:Ori`), and how nearness is measured (the sky when left out). */
  nearTo?: string | undefined;
  nearBy?: "sky" | "space" | undefined;
  /** The star the sky is seen from, written `HR5459`; left out for the Earth's sky. */
  from?: string | undefined;
  /** The sky culture drawn: `western`, `japanese` or `chinese`; left out for the Western sky. */
  cultureId?: string | undefined;
  /** Names on the brightest stars (`star-names=12`, `star-names-magnitude=1.5`); left out for none. */
  starNames?: StarNamesSettings | undefined;
  /** Faint constellation lines at this strength, 0 to 1 (`constellation-lines=0.2`); left out for none. */
  lineStrength?: number | undefined;
  /** The look of the names (`label-look`): `display` when left out. */
  labelLook?: LookId | undefined;
}

const number = (text: string | null, fallback: number, low: number, high: number): number => {
  const n = text === null || text === "" ? Number.NaN : Number(text);
  return Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
};

/** The layers an address names: a comma list, `none` for no layers, or the defaults when it says nothing. */
export function layersOf(text: string | null): Set<Layer> {
  if (text === null) return new Set(DEFAULT_LAYERS);
  return new Set(text.split(",").filter((name): name is Layer => (LAYERS as readonly string[]).includes(name)));
}

export const layersText = (layers: ReadonlySet<Layer>): string | null => {
  const text = LAYERS.filter((name) => layers.has(name)).join(",");
  return text === "" ? "none" : text === DEFAULT_LAYERS.join(",") ? null : text;
};

/** The choice an address holds, with every missing or bad part at its default; a missing zoom is the opening view for a chart of `width` by `height` pixels. */
export function choiceOf(query: URLSearchParams, width = 480, height = 360): Choice {
  const kind = query.get("proj") ?? "";
  const projection: Projection = (PROJECTIONS as readonly string[]).includes(kind) ? (kind as Projection) : DEFAULT_VIEW.projection;
  const named = query.get("layers");
  const highlight = query.get("c") ?? undefined;
  const near = /^[SDC]:[\w.-]+$/.test(query.get("near") ?? "") ? query.get("near")! : undefined;
  const from = viewpointOf(query.get("from"));
  const culture = cultureOf(query.get("culture"));
  const starNames = starNamesFromAttributes(query.get(STAR_NAMES_ATTRIBUTES.count), query.get(STAR_NAMES_ATTRIBUTES.magnitude));
  const lineStrength = lineStrengthFromAttribute(query.get(CONSTELLATION_LINES_ATTRIBUTE));
  return {
    projection,
    ra: ((number(query.get("ra"), DEFAULT_VIEW.ra, -1e6, 1e6) % 360) + 360) % 360,
    dec: number(query.get("dec"), DEFAULT_VIEW.dec, -90, 90),
    zoom: number(query.get("zoom"), defaultZoom(projection, width, height), ZOOM_MIN, ZOOM_MAX),
    magnitude: number(query.get("mag"), DEFAULT_MAGNITUDE, 2, 6),
    layers: layersOf(named === "none" ? "" : named),
    lang: query.get("lang") === "ja" ? "ja" : "en",
    ...(highlight === undefined ? {} : { highlight }),
    ...(from === undefined ? {} : { from: fromText(from) }),
    ...(culture === undefined || culture.id === DEFAULT_CULTURE ? {} : { cultureId: culture.id }),
    ...(near === undefined ? {} : { nearTo: near }),
    ...(near !== undefined && query.get("by") === "space" ? { nearBy: "space" as const } : {}),
    ...(starNames === undefined ? {} : { starNames }),
    ...(lineStrength === undefined ? {} : { lineStrength }),
    ...(lookIdOf(query.get("label-look")) === "display" ? {} : { labelLook: lookIdOf(query.get("label-look")) }),
  };
}

/** The address text for a choice, for the embed page (every part written, so the frame never depends on the demo's defaults). */
export function frameQuery(choice: Choice): string {
  const q = new URLSearchParams({ proj: choice.projection, ra: choice.ra.toFixed(2), dec: choice.dec.toFixed(2), zoom: String(Math.round(choice.zoom * 100) / 100), mag: String(choice.magnitude), layers: layersText(choice.layers) ?? DEFAULT_LAYERS.join(",") });
  if (choice.lang === "ja") q.set("lang", "ja");
  if (choice.highlight !== undefined) q.set("c", choice.highlight);
  if (choice.from !== undefined) q.set("from", choice.from);
  if (choice.cultureId !== undefined && choice.cultureId !== DEFAULT_CULTURE) q.set("culture", choice.cultureId);
  if (choice.nearTo !== undefined) q.set("near", choice.nearTo);
  if (choice.nearTo !== undefined && choice.nearBy === "space") q.set("by", "space");
  if (choice.starNames?.count !== undefined) q.set("star-names", String(choice.starNames.count));
  if (choice.starNames?.magnitude !== undefined) q.set("star-names-magnitude", String(choice.starNames.magnitude));
  if (choice.lineStrength !== undefined) q.set("constellation-lines", String(choice.lineStrength));
  if (choice.labelLook !== undefined) q.set("label-look", choice.labelLook);
  return q.toString();
}
