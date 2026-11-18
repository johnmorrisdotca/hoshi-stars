// What the sky says and is asked: the view, pick, target, mark and report details of <hoshi-my-sky>. Moved out of element.ts as they were; element.ts re-exports them.
import type { ResolvedTarget } from "./target-stars.ts";
import type { SkyView } from "./hands.ts";
import type { SkyReport } from "./report.ts";
import type { SkyTarget, TargetInSky } from "./target.ts";

/**
 * What `hoshi-sky-view` says: which way the sky faces now, and `final` once the hand has settled.
 *
 * @example
 * ```ts no-run
 * import type { MySkyViewDetail } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * document.querySelector("hoshi-my-sky")!.addEventListener("hoshi-sky-view", (event) => {
 *   const { heading, pitch, fov, final } = (event as CustomEvent<MySkyViewDetail>).detail;
 *   if (final) console.log(`facing ${Math.round(heading)}, looking ${Math.round(pitch)} up, ${Math.round(fov)} across`);
 * });
 * ```
 */
export interface MySkyViewDetail extends SkyView {
  final: boolean;
}

/**
 * What `hoshi-sky-pick` says: a tap landed on the Sun (`kind` `sun`), the Moon (`moon`), a planet (`planet`, `id` its name in lower case), a constellation (`figure`, `id` its three-letter abbreviation) or nothing (`none`).
 *
 * @example
 * ```ts no-run
 * import type { MySkyPick } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * document.querySelector("hoshi-my-sky")!.addEventListener("hoshi-sky-pick", (event) => {
 *   const { kind, id } = (event as CustomEvent<MySkyPick>).detail;
 *   console.log(kind, id);
 * });
 * ```
 */
export interface MySkyPick {
  kind: "sun" | "moon" | "planet" | "figure" | "none";
  id: string | null;
}

/**
 * What `hoshi-sky-target` says once the view has turned to the target (`reached` true), or was turned away by the reader or the page before it got there (`reached` false): the target as it was set, its name in the language shown, where it stands and whether it is up.
 *
 * @example
 * ```ts no-run
 * import type { MySkyTargetDetail } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * document.querySelector("hoshi-my-sky")!.addEventListener("hoshi-sky-target", (event) => {
 *   const { label, up, reached } = (event as CustomEvent<MySkyTargetDetail>).detail;
 *   if (reached) console.log(up ? `${label} is up` : `${label} is below the horizon`);
 * });
 * ```
 */
export interface MySkyTargetDetail {
  /** The target as it was set: the text, or the point. */
  target: SkyTarget;
  /** What it is: `star`, `constellation`, `planet`, `moon`, `sun` or `point`. */
  kind: ResolvedTarget["kind"];
  /** Its name in the language shown. */
  label: string;
  /** Whether the view got to it. */
  reached: boolean;
  /** Where it stands now, and whether it is up. */
  altitude: number;
  azimuth: number;
  up: boolean;
}

/**
 * What `hoshi-sky-mark` says when a mark of the page's is pressed (with a tap, or Enter or Space on its button for a keyboard): the mark's own numbers.
 *
 * @example
 * ```ts no-run
 * import type { MySkyMarkDetail } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * document.querySelector("hoshi-my-sky")!.addEventListener("hoshi-sky-mark", (event) => {
 *   console.log((event as CustomEvent<MySkyMarkDetail>).detail.id);
 * });
 * ```
 */
export interface MySkyMarkDetail {
  id: string;
  label: string;
  kind: string | undefined;
  azimuth: number;
  altitude: number;
}

/**
 * The target in `sky`: where it stands over the place, whether it is up (`up`), its next `rise` and `set` and whether it is `always` or `never` up there, with what it is and its name in each language.
 *
 * @example
 * ```ts no-run
 * import type { MySkyTargetReport } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * const say = (t: MySkyTargetReport): string => `${t.label.en} is ${t.up ? "up" : "down"}`;
 * console.log(typeof say);
 * ```
 */
export interface MySkyTargetReport extends TargetInSky {
  kind: ResolvedTarget["kind"];
  label: { en: string; ja: string };
}

/**
 * What the element's `sky` property gives: the Sun, the Moon and the planets (`SkyReport`) and the target, or `null` while there is none (or it names nothing).
 *
 * @example
 * ```ts no-run
 * import type { MySkyReport } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * const up = (report: MySkyReport): boolean => report.target?.up === true;
 * console.log(typeof up);
 * ```
 */
export interface MySkyReport extends SkyReport {
  target: MySkyTargetReport | null;
}
