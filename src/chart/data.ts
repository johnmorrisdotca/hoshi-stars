// What a chart layer needs that is not in the entry: the boundaries, the Messier objects, the Milky Way and the nearby table. Each is its own file, read when a chart asks for the layer, so a chart without it never fetches it.

export const LAYERS = ["milky", "lines", "boundaries", "names", "deep", "grid"] as const;
/** A layer as the chart keeps it. The names a page writes are `LayerName`. */
export type Layer = (typeof LAYERS)[number];

/**
 * A layer a page asks for: `milky-way`, `lines`, `boundaries`, `names`, `deep-sky` or `grid`. `milky` and `deep` are the same two layers, as the embed page's address spells them.
 *
 * @example
 * ```ts
 * import type { LayerName } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const layers: LayerName[] = ["milky-way", "lines", "names"];
 * console.log(layers.length);
 * ```
 */
export type LayerName = Layer | "milky-way" | "deep-sky";

const ALIASES: Readonly<Record<string, Layer>> = { "milky-way": "milky", "deep-sky": "deep" };

/** The layers in a list of names, the ones this chart does not know left out. */
export function layerSet(names: Iterable<string>): Set<Layer> {
  const out = new Set<Layer>();
  for (const name of names) {
    const layer = ALIASES[name] ?? name;
    if ((LAYERS as readonly string[]).includes(layer)) out.add(layer as Layer);
  }
  return out;
}

interface Loaded {
  boundaries: typeof import("../boundaries.ts");
  deep: typeof import("../deep-sky.ts");
  milky: typeof import("../milky-way.ts");
  nearby: typeof import("./nearby.ts");
}

const loaded: Partial<Loaded> = {};

const LOADERS: { [K in keyof Loaded]: () => Promise<Loaded[K]> } = {
  boundaries: () => import("../boundaries.ts"),
  deep: () => import("../deep-sky.ts"),
  milky: () => import("../milky-way.ts"),
  nearby: () => import("./nearby.ts"),
};

/** A piece of data the drawing needs, or an error that says which layer to load it for. */
export function have<K extends keyof Loaded>(name: K): Loaded[K] {
  const found = loaded[name];
  if (found === undefined) throw new Error(`hoshi-stars/chart: the ${name} data is not loaded: call \`await loadChartData(options)\` before \`chartSvg(options)\``);
  return found;
}

/** Whether a piece of data is there already. */
export const has = (name: keyof Loaded): boolean => loaded[name] !== undefined;

/** What a chart's options ask the data for. */
export interface Wants {
  layers?: Iterable<string> | undefined;
  /** The constellation (abbreviation) drawn brighter: it needs the boundaries. */
  constellation?: string | undefined;
  /** What is picked and ringed (`S:2491`, `D:M31`, `C:Ori`): it needs the nearby table, and the Messier objects or the boundaries. */
  near?: string | undefined;
}

/** The pieces of data a chart with these options needs. */
export function needs(wants: Wants): Array<keyof Loaded> {
  const layers = layerSet(wants.layers ?? []);
  const out = new Set<keyof Loaded>();
  if (layers.has("milky")) out.add("milky");
  if (layers.has("deep")) out.add("deep");
  if (layers.has("boundaries") || wants.constellation !== undefined) out.add("boundaries");
  if (wants.near !== undefined && wants.near !== "") {
    out.add("nearby");
    out.add("deep");
    out.add("boundaries");
  }
  return [...out];
}

/**
 * Reads the data the layers of a chart need, once: the boundaries, the Messier objects, the Milky Way, and for `near` the nearby table. `chartSvg` draws from what is read, so call this first for any layer but `lines`, `names` and `grid`. The element does it itself.
 *
 * @param wants - The chart's options (only `layers`, `constellation` and `near` are looked at).
 * @returns Resolves when everything the options need is there.
 *
 * @example
 * ```ts
 * import { chartSvg, loadChartData } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const options = { layers: ["milky-way", "lines"], width: 400, height: 300 } as const;
 * await loadChartData(options);
 * console.log(chartSvg(options).startsWith("<svg"));
 * ```
 */
export async function loadChartData(wants: Wants): Promise<void> {
  await Promise.all(
    needs(wants).map(async (name) => {
      if (loaded[name] === undefined) (loaded as Record<string, unknown>)[name] = await LOADERS[name]();
    }),
  );
}
