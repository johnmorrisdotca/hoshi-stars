// What the chart element starts from: the zoom range, the projections it knows, the sky cultures (each loaded only when asked for), how many markers the Tab key reaches, and two small readers. Moved out of element.ts as it was.
import type { Culture } from "../culture.ts";
import { western } from "../cultures/western.ts";
import type { Projection } from "../projection.ts";

/** The zoom range when the page names none: 0.1 to 500, in the chart's own unit (1 is the projection's fit of the whole sky). `zoom-max` raises it as far as 8000, the deep-sky pictures' own range. */
export const CHART_ZOOM_MIN = 0.1;
export const CHART_ZOOM_MAX = 500;
export const CHART_ZOOM_LIMIT = 8000;

export const PROJECTIONS: readonly Projection[] = ["stereographic", "orthographic", "gnomonic", "equidistant", "equirectangular", "mollweide", "hammer"];
export const CULTURES: Record<string, () => Promise<Culture>> = {
  western: async () => western,
  japanese: async () => (await import("../cultures/japanese.ts")).japanese,
  chinese: async () => (await import("../cultures/chinese.ts")).chinese,
};

/** At most this many markers are reached with the Tab key (the first drawn, in the order given); every marker can still be clicked. */
export const TAB_STOPS = 40;

export const number = (text: string | null, fallback: number): number => {
  const n = Number(text);
  return text !== null && text.trim() !== "" && Number.isFinite(n) ? n : fallback;
};

/** A Western or Japanese figure's id is its constellation's abbreviation when it is one of the 88 (`Ori`), and an asterism's own id otherwise. */
export function constellationOf(id: string): { abbreviation?: string } {
  return /^[A-Z][a-z]{2}$/.test(id) ? { abbreviation: id } : {};
}
