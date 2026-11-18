// What a tap on <hoshi-chart> reports and what its view and marker events carry. Moved out of element.ts as they were; element.ts re-exports them.
import type { Projection } from "../projection.ts";
import type { SkyBodyNames } from "./bodies.ts";
import type { SkyMarker } from "./markers.ts";
import type { PickAccuracy } from "./uncertainty.ts";

/**
 * What `hoshi-pick` says: a body of the page's `bodies` (`kind` `body`, `id` its own, with `names`), a star (`id` its HR number, with `accuracy`: its grade, the distance range and the position resolution), a deep-sky object (`M42`), a black hole (`cygnus-x-1`), a figure (`id` the figure's, with `abbreviation` for a constellation), or nothing (`kind` `none`).
 *
 * @example
 * ```ts no-run
 * import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";
 *
 * document.querySelector("hoshi-chart")!.addEventListener("hoshi-pick", (event) => {
 *   const { kind, id, abbreviation, accuracy } = (event as CustomEvent<ChartPick>).detail;
 *   console.log(kind, id, abbreviation ?? "", accuracy?.grade ?? "");
 * });
 * ```
 */
export interface ChartPick {
  kind: "star" | "deep" | "hole" | "figure" | "body" | "none";
  id: string | null;
  /** For a body only: its names in English and Japanese, as the page gave them. */
  names?: SkyBodyNames | undefined;
  abbreviation?: string | undefined;
  /** For a star only: how well it is known (`PickAccuracy`): the grade A, B or C, the distance range in light-years (`null` where there is none) and the position resolution in arc-seconds. */
  accuracy?: PickAccuracy | undefined;
}

/**
 * What `hoshi-view` says: where the chart looks now, and `final` once the hand has settled.
 *
 * @example
 * ```ts no-run
 * import type { ChartViewDetail } from "@johnmorrisdotca/hoshi-stars/chart/element";
 *
 * document.querySelector("hoshi-chart")!.addEventListener("hoshi-view", (event) => {
 *   const { ra, dec, zoom, final } = (event as CustomEvent<ChartViewDetail>).detail;
 *   if (final) history.replaceState(null, "", `?ra=${ra.toFixed(2)}&dec=${dec.toFixed(2)}&zoom=${zoom.toFixed(2)}`);
 * });
 * ```
 */
export interface ChartViewDetail {
  projection: Projection;
  ra: number;
  dec: number;
  zoom: number;
  final: boolean;
}

/**
 * What `hoshi-marker` says: a marker was clicked, tapped, or chosen with Enter or Space while it had the focus.
 *
 * @example
 * ```ts no-run
 * import type { ChartMarkerDetail } from "@johnmorrisdotca/hoshi-stars/chart/element";
 *
 * document.querySelector("hoshi-chart")!.addEventListener("hoshi-marker", (event) => {
 *   const { marker, id, source } = (event as CustomEvent<ChartMarkerDetail>).detail;
 *   console.log(id, marker.label ?? "", source);
 * });
 * ```
 */
export interface ChartMarkerDetail {
  /** The marker, as the page gave it (the same object when it was set as a property). */
  marker: SkyMarker;
  /** The marker's `id`, or `m<position>` when it has none. */
  id: string;
  /** Its position in `markers`. */
  index: number;
  /** `pointer` for a click or a tap, `key` for Enter or Space on a marker that has the focus. */
  source: "pointer" | "key";
}
