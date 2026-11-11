// The sky out to a distance for the demo: the bright stars, the nearby stars and the Messier galaxies with a distance, loaded once (the nearby table is fetched only when a limit is first asked for), and the colour of each band.
import { stars } from "../src/stars.ts";
import { galaxyDistance, messier } from "../src/deep-sky.ts";
import { deepSkyInput, layersByDistance, nearbyInput, starInput, type DistanceInput, type DistanceLayers } from "../src/distance.ts";

/** One colour for each of the six bands, near to far: warm gold, then orange, coral, magenta, violet and blue. */
export const BAND_COLOURS: readonly string[] = ["#ffe08a", "#ffb35c", "#ff7a6b", "#d667b8", "#8a7be6", "#4fb0e8"];
/** The colour of the `uncertain` band: a pale grey-blue ring, because it has no place in a band. */
export const UNCERTAIN_COLOUR = "#9aa6c9";

let inputs: DistanceInput[] | undefined;
let loading: Promise<void> | undefined;
const layerCache = new Map<number, DistanceLayers>();

/** Whether the tables are in. */
export const distanceReady = (): boolean => inputs !== undefined;

/** Load the tables once, and call `done` when they are in. Safe to call again. */
export function loadDistances(done: () => void): void {
  if (inputs !== undefined) return;
  loading ??= import("../src/nearby.ts").then(({ nearbyStars }) => {
    inputs = [...stars().map(starInput), ...nearbyStars().map(nearbyInput), ...messier().map((object) => deepSkyInput(object, galaxyDistance(object)))];
  });
  void loading.then(done, () => undefined);
}

/** The layers for a limit, or `undefined` while the tables load. The nearest answers are kept. */
export function layersFor(limit: number): DistanceLayers | undefined {
  if (inputs === undefined) return undefined;
  let found = layerCache.get(limit);
  if (found === undefined) {
    found = layersByDistance(inputs, { limit });
    if (layerCache.size >= 48) layerCache.delete(layerCache.keys().next().value!);
    layerCache.set(limit, found);
  }
  return found;
}

const LABELS = {
  en: ["Under 10 ly", "10 to 50 ly", "50 to 100 ly", "100 to 500 ly", "500 to 1,000 ly", "Beyond 1,000 ly"],
  ja: ["10光年より近い", "10〜50光年", "50〜100光年", "100〜500光年", "500〜1,000光年", "1,000光年より遠い"],
} as const;
const WORDS = {
  en: { uncertain: "Distance uncertain", unknown: "No distance (not drawn)", loading: "Loading distances…", empty: "Nothing in this layer yet." },
  ja: { uncertain: "距離がはっきりしない", unknown: "距離がない（描きません）", loading: "距離を読み込んでいます…", empty: "この層にはまだ何もありません。" },
} as const;

/** The legend: a swatch, the band and how many things are in it, for each band, the uncertain band and the count with no distance. */
export function renderLegend(into: HTMLElement, layers: DistanceLayers | undefined, lang: "en" | "ja"): void {
  const words = WORDS[lang];
  into.replaceChildren();
  if (layers === undefined) {
    into.textContent = words.loading;
    return;
  }
  const row = (swatch: string, ring: boolean, label: string, count: number, band: string): void => {
    const item = document.createElement("li");
    item.dataset["band"] = band;
    const mark = document.createElement("span");
    mark.className = ring ? "dist-swatch ring" : "dist-swatch";
    mark.style.setProperty("--swatch", swatch);
    const text = document.createElement("span");
    text.textContent = label;
    const number = document.createElement("span");
    number.className = "dist-count";
    number.textContent = count.toLocaleString(lang);
    item.append(mark, text, number);
    into.append(item);
  };
  LABELS[lang].forEach((label, i) => {
    if (i === 0 || layers.counts[i]! > 0 || layers.limit === Number.POSITIVE_INFINITY || BAND_START[i]! < layers.limit) row(BAND_COLOURS[i]!, false, label, layers.counts[i]!, String(i));
  });
  row(UNCERTAIN_COLOUR, true, words.uncertain, layers.uncertain, "uncertain");
  const none = document.createElement("li");
  none.dataset["band"] = "unknown";
  none.className = "dist-unknown";
  none.textContent = `${words.unknown}: ${layers.unknown.toLocaleString(lang)}`;
  into.append(none);
}

/** Where each band starts, in light-years: a band that begins beyond the limit is not listed. */
const BAND_START: readonly number[] = [0, 10, 50, 100, 500, 1000];
