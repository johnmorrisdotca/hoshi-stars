// The nearby stars for the sky chart's Nearby layer: the table (the Yale parallax catalogue's 5,593 stars) is fetched the first time the layer is on, and the chart is drawn again when it is here.
// Each star says whether the faint tiles hold it too (`NEARBY_FAINT_ROWS`), so the chart draws it once.
import type { NearbyMark } from "../src/chart/chart.ts";
import type { Layer } from "../src/chart/chart.ts";

let marks: NearbyMark[] | undefined;
let loading: Promise<void> | undefined;

/** The nearby stars while the layer is on and the table is here; `undefined` before. `onReady` is called once when the table arrives. */
export function nearbyFor(layers: ReadonlySet<Layer>, onReady: () => void): readonly NearbyMark[] | undefined {
  if (!layers.has("nearby")) return undefined;
  loading ??= Promise.all([import("../src/nearby.ts"), import("../src/data/nearby-faint.ts")]).then(([{ nearbyStars }, { NEARBY_FAINT_ROWS }]) => {
    const inFaint = new Set(NEARBY_FAINT_ROWS.split("\n").map((row) => `gctp-${row.split("|")[0]}`));
    marks = nearbyStars().map((star) => ({ id: star.id, name: star.name, designation: star.designation, rightAscension: star.rightAscension, declination: star.declination, magnitude: star.magnitude, inFaint: inFaint.has(star.id) }));
    onReady();
  });
  return marks;
}
