// The nearby stars the constellation in 3D offers to be seen from, beside the bright ones in from.ts: the star's key in an address (`from=GCTP3278`, the Yale catalogue number), the name `nearbyStarByName` finds it
// by, and its names in the page's two languages. No imports: the nearby table is large, so the pages load it (`./from.ts`, `loadViewpoint`) only when one of these is asked for.

/** A nearby star offered as a viewpoint. */
export interface NearViewpoint {
  /** How an address writes it: `GCTP` and the Yale catalogue number. */
  key: string;
  /** The name `nearbyStarByName` finds it by; the copied code says the same. */
  query: string;
  en: string;
  ja: string;
}

/** The nearby stars offered by name. Proxima Centauri, the nearest star to the Sun (4.2 light-years), is the Bright Star Catalogue's Alpha Centauri's own neighbour and is in no table of the bright stars. */
export const NEAR_VIEWPOINTS: ReadonlyArray<NearViewpoint> = [{ key: "GCTP3278", query: "Proxima Centauri", en: "Proxima Centauri", ja: "プロキシマ・ケンタウリ" }];

/** The nearby viewpoint an address text names, or `undefined`. */
export const nearViewpointOf = (text: string | null | undefined): NearViewpoint | undefined => NEAR_VIEWPOINTS.find((one) => one.key === text);
