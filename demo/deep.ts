// What the demo and the embed page fetch on the way: the NGC and IC objects with their shapes (one chunk of script, about 190 kB gzipped, asked for only when the view is zoomed in far enough
// to show them), and the pictures of the deep-sky objects (a WebP file each, asked for only when one fills enough of the screen). Each arrival asks the page to draw again.
import type { DeepSkyObject } from "../src/deep-sky-core.ts";
import type { DeepSkyShape } from "../src/deep-sky-shape.ts";
import type { GalaxyDistance } from "../src/galaxy-distance-core.ts";
import { MAX_PICTURES } from "../src/chart/deep-draw.ts";
import { pictureBlobs } from "../src/chart/picture-cache.ts";
import { pictureUrl } from "../src/deep-sky-pictures.ts";
import { drawnPictures } from "../src/chart/picture-quality.ts";

/** How long a picture that could not be had waits before it is asked for again, and how many times it is asked for in all before it is given up for the page. */
export const PICTURE_RETRY_MS = 60_000;
export const PICTURE_TRIES = 3;

/** The zoom from which the NGC and IC objects are fetched, when the deep-sky layer is on. */
export const TIER_ZOOM = 8;

export interface DeepFetcher {
  /** The ids of the pictures that have arrived. */
  readonly ready: Set<string>;
  /**
   * The ids of the pictures given up on: each could be had neither by fetch nor as an image `PICTURE_TRIES` times, `PICTURE_RETRY_MS` apart (a phone that lost its signal for a moment gets it on a
   * later try). Not asked for again on this page; between tries a view that keeps wanting one does not ask the server at every draw either.
   */
  readonly failed: Set<string>;
  /** The whole table of objects and its shapes once fetched, else `undefined`. */
  catalogue(): readonly DeepSkyObject[] | undefined;
  shapeOf(): ((object: DeepSkyObject) => DeepSkyShape) | undefined;
  /** The distance of any galaxy of the whole table once fetched, else `undefined`. */
  distanceOf(): ((object: DeepSkyObject) => GalaxyDistance | null) | undefined;
  /** An object of the whole table by any of its names, once fetched. */
  find(text: string): DeepSkyObject | undefined;
  /** Fetch the NGC and IC objects now; resolves when they are in. */
  loadTier(): Promise<void>;
  /** Fetch the pictures with these ids (at most `MAX_PICTURES` are in flight); each arrival calls the page's `changed`. */
  want(ids: readonly string[]): void;
}

let byId: Map<string, ReturnType<typeof drawnPictures>[number]> | undefined;
const pictureById = (): Map<string, ReturnType<typeof drawnPictures>[number]> => (byId ??= new Map(drawnPictures().map((picture) => [picture.id, picture])));

/**
 * The fetcher of a page: `changed` is called when something arrives, and `now` is its clock in milliseconds (`Date.now` unless a test gives its own).
 */
export function createDeepFetcher(base: string, changed: () => void, now: () => number = Date.now): DeepFetcher {
  const ready = new Set<string>();
  const failed = new Set<string>();
  const asked = new Set<string>();
  /** A picture that failed and may be tried again: how many times it was tried, and when the next try may be. */
  const retry = new Map<string, { tries: number; at: number }>();
  let objects: readonly DeepSkyObject[] | undefined;
  let shape: ((object: DeepSkyObject) => DeepSkyShape) | undefined;
  let distance: ((object: DeepSkyObject) => GalaxyDistance | null) | undefined;
  let find: ((text: string) => DeepSkyObject | undefined) | undefined;
  let tier: Promise<void> | undefined;
  return {
    ready,
    failed,
    catalogue: () => objects,
    shapeOf: () => shape,
    distanceOf: () => distance,
    find: (text) => find?.(text),
    loadTier() {
      tier ??= Promise.all([import("../src/deep-sky-ngc-ic.ts"), import("../src/deep-sky-shape-ngc-ic.ts")]).then(([table, shapes]) => {
        objects = table.deepSky();
        find = table.deepSkyObject;
        shape = shapes.deepSkyShape;
        distance = table.galaxyDistance;
        changed();
      });
      return tier;
    },
    want(ids) {
      for (const id of ids.slice(0, MAX_PICTURES)) {
        if (asked.has(id)) {
          // in flight, arrived or given up: nothing; failed earlier: once its wait is over
          const waiting = retry.get(id);
          if (waiting === undefined || now() < waiting.at) continue;
        }
        const picture = pictureById().get(id);
        if (picture === undefined) continue;
        asked.add(id);
        const tries = (retry.get(id)?.tries ?? 0) + 1;
        retry.delete(id);
        const url = pictureUrl(picture, base);
        const fallback = (): void => {
          // a server that will not be fetched from (no CORS): let the browser load it as an image, as before
          const image = new Image();
          image.decoding = "async";
          image.onload = () => {
            ready.add(id);
            changed();
          };
          // both ways failed: it stays asked, and is tried again after a wait, until it has been tried PICTURE_TRIES times
          image.onerror = () => {
            if (tries >= PICTURE_TRIES) failed.add(id);
            else retry.set(id, { tries, at: now() + PICTURE_RETRY_MS });
          };
          image.src = url;
        };
        // fetched once and held as a blob, so every later draw shows it without asking the server again
        fetch(url)
          .then((answer) => (answer.ok ? answer.blob() : Promise.reject(new Error(String(answer.status)))))
          .then((blob) => {
            pictureBlobs.set(id, URL.createObjectURL(blob));
            ready.add(id);
            changed();
          })
          .catch(fallback);
      }
    },
  };
}
