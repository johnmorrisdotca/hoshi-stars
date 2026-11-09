// The sky as seen from another star, counting the nearby stars too: Proxima Centauri, Barnard's Star and about 5,600 more are moved with the bright ones.
// The sky-from nearby tier (`@johnmorrisdotca/hoshi-stars/sky-from/nearby`): it imports the nearby table (about 240 kB gzipped), so it is its own import and `/sky-from` stays small. Pure: no DOM, no clock, no state.
import { nearbyStarByName, nearbyStars } from "./nearby.ts";
import { skyFrom, type SeenSky, type SkyFromOptions, type SkyFromViewpoint } from "./sky-from.ts";
import { starByName, stars } from "./stars.ts";

/**
 * `skyFrom` over the 5,080 bright stars and the 5,565 nearby stars together. A name is looked up among the bright stars first, then the nearby ones (`Proxima Centauri`, `GJ 551`, `Barnard's Star`). A nearby star with no magnitude (the catalogue gives one for most) cannot be given a brightness and is counted in `skipped` with the stars that have no distance. The Sun is among the stars.
 *
 * @param viewpoint - As for `skyFrom`, and the name of a nearby star.
 * @param options - `magnitude`, the faintest apparent magnitude to include. `among` is the table: it is set here.
 * @returns A new list of seen stars, brightest first, with a `skipped` count.
 * @throws As for `skyFrom`.
 *
 * @example
 * ```ts
 * import { skyFromWithNearby } from "@johnmorrisdotca/hoshi-stars/sky-from/nearby";
 *
 * const sky = skyFromWithNearby("Proxima Centauri", { magnitude: 0 });
 * console.log(sky.map((star) => star.name ?? star.designation));
 * ```
 */
export function skyFromWithNearby(viewpoint: SkyFromViewpoint, options: Omit<SkyFromOptions, "among"> = {}): SeenSky {
  const target = typeof viewpoint === "string" ? (starByName(viewpoint) ?? nearbyStarByName(viewpoint) ?? viewpoint) : viewpoint;
  return skyFrom(target, { ...options, among: [...stars(), ...nearbyStars()] });
}
