// The chart's types: its layers, languages, view, options and hits. Moved out of chart.ts as they were; chart.ts re-exports them.
import type { Culture } from "../culture.ts";
import type { DeepSkyObject } from "../deep-sky.ts";
import type { DeepSkyShape } from "../deep-sky-shape.ts";
import type { DistanceLayers } from "../distance.ts";
import type { Projection } from "../projection.ts";
import type { FigureLines, StarNames } from "../sky-labels.ts";
import type { SeenSky } from "../sky-from.ts";
import type { SkyBody } from "./bodies.ts";
import type { FaintDraw } from "./faint-layer.ts";
import type { Box } from "./labels.ts";
import type { MarkerRange, SkyMarker } from "./markers.ts";

export const LAYERS = ["milky", "lines", "boundaries", "mansions", "names", "deep", "pictures", "holes", "faint", "ecliptic", "grid"] as const;
export type Layer = (typeof LAYERS)[number];
export type Language = "en" | "ja";

/**
 * Where the chart looks: the projection, the point in the middle (degrees) and the zoom, in the chart's own unit: 1 fits the projection's whole sky in the smaller side, more is closer.
 *
 * @example
 * ```ts no-run
 * import type { View } from "@johnmorrisdotca/hoshi-stars/chart/element";
 *
 * const chart = document.querySelector("hoshi-chart")! as HTMLElement & { view: View | undefined; setView(change: Partial<View>): void };
 * chart.setView({ ra: 279.2, dec: 38.8, zoom: 12 });
 * console.log(chart.view?.zoom);
 * ```
 */
export interface View {
  projection: Projection;
  ra: number;
  dec: number;
  zoom: number;
}

export interface ChartOptions extends View {
  width: number;
  height: number;
  magnitude: number;
  layers: ReadonlySet<Layer>;
  lang: Language;
  /** The sky culture whose figures and names are drawn: the Western sky (the 88 constellations and the asterisms) when left out. */
  culture?: Culture | undefined;
  /** The figure (a constellation's abbreviation in the Western and Japanese cultures, else the figure's id) to show brighter, with its boundary when it is a constellation, even when boundaries are off. */
  highlight?: string | undefined;
  /** Draw the stars of grade C (a rough or missing distance, `/accuracy`) dimmer. Off when left out. The sky seen from another star (`sky`) is not dimmed. */
  showUncertainty?: boolean | undefined;
  /** The star (HR number) or Messier object (`M31`) that is picked. */
  picked?: string | undefined;
  /** The black hole (its id, `cygnus-x-1`) that is picked; it is drawn and named even when the black-hole layer is off. */
  pickedHole?: string | undefined;
  /** What is near the picked thing, drawn ringed: keys `S:<HR number>`, `D:<Messier id>` and `C:<abbreviation>`. */
  near?: readonly string[] | undefined;
  /** The sky seen from another star (`skyFrom`): the stars are drawn where it puts them, with its magnitudes, and the lines join them there. A star it leaves out (no distance) is not drawn, nor a line to it. The boundaries are the Earth's and are not drawn. */
  sky?: SeenSky | undefined;
  /** Rectangles in chart pixels that no name may cover, such as the page's own buttons laid over the chart. */
  keepClear?: readonly Box[] | undefined;
  /** The faint stars of UCAC4 in the field (`faintFor`), drawn when the `faint` layer is on and the zoom reaches them. */
  faint?: FaintDraw | undefined;
  /** The deep-sky objects drawn: the Messier objects when left out; a page that has fetched the NGC and IC objects passes them all, with `shapeOf` from `deep-sky/ngc-ic-shape`. */
  catalogue?: readonly DeepSkyObject[] | undefined;
  /** The size, axis ratio and angle of an object: the Messier objects' when left out. */
  shapeOf?: ((object: DeepSkyObject) => DeepSkyShape) | undefined;
  /** The ids of the pictures that have been fetched and may be drawn (the `pictures` layer), and where the package's `pictures/` folder is served from (`./` when left out). */
  readyPictures?: ReadonlySet<string> | undefined;
  pictureBase?: string | undefined;
  /** The pictures the last frame chose (its `wanted`): they keep their places against a newcomer of about their size, so a picture does not flicker in and out as the view moves. */
  previousPictures?: ReadonlySet<string> | undefined;
  /** The `sky-labels` tier, laid out by the caller for this very view: faint constellation lines with the picked figure at full strength (they replace the `lines` layer), and names on the brightest stars (they replace the chart's own star names). */
  overlay?: { lines?: FigureLines | undefined; names?: StarNames | undefined } | undefined;
  /** The sky out to a distance (`layersByDistance`): only these things are drawn, each in the colour of its band (`colours`, six of them, near to far); a thing whose distance is uncertain is a hollow ring in `uncertain`; a thing with no distance is not drawn. The faintest-star limit, the faint layer and the deep-sky marks and pictures are left off while it is on. */
  distance?: { layers: DistanceLayers; colours: readonly string[]; uncertain: string } | undefined;
  /** The page's own points (`SkyMarker`): drawn over the stars, their names placed clear of the stars and of each other. Not drawn in the sky seen from another star (`sky`). */
  markers?: readonly SkyMarker[] | undefined;
  /** The moments `markers` are shown for (a marker with a date outside it is not drawn); all of them when left out. */
  timeRange?: MarkerRange | undefined;
  /** Join a group of markers in date order: `true` for every group, or the names of the groups. Nothing is joined when left out. */
  tracks?: boolean | readonly string[] | undefined;
  /** Planets, the Moon and other bodies the page has worked out (`SkyBody`): a dot by magnitude, the Moon a disc with its phase, each named in the chart's language and placed clear of the stars. Not drawn in the sky seen from another star (`sky`). */
  bodies?: readonly SkyBody[] | undefined;
  /** The width of a text in pixels for a CSS `font` (`"400 11px system-ui, sans-serif"`), to lay the names out by: a canvas where there is a document, else a built-in table, when left out. A server and a test pass their own for the same names everywhere. */
  measure?: ((text: string, font: string) => number) | undefined;
}

/** What a tap can land on, in chart pixels. */
export interface Hit {
  x: number;
  y: number;
  kind: "star" | "deep" | "hole" | "body";
  key: string;
  /** For a deep-sky object drawn large: how far from its middle a tap still lands on it. */
  reach?: number | undefined;
}
