// What the demo and the embed page fetch on the way: the NGC and IC objects with their shapes (one chunk of script, about 190 kB gzipped, asked for only when the view is zoomed in far enough
// to show them), and the pictures of the deep-sky objects (a WebP file each, asked for only when one fills enough of the screen). Each arrival asks the page to draw again.
import type { DeepSkyObject } from "../src/deep-sky-core.ts";
import type { DeepSkyShape } from "../src/deep-sky-shape.ts";
import { MAX_PICTURES } from "./deep-draw.ts";
import { pictureBlobs } from "./picture-cache.ts";
import { pictureUrl } from "../src/deep-sky-pictures.ts";
import { drawnPictures } from "./picture-quality.ts";

/** The zoom from which the NGC and IC objects are fetched, when the deep-sky layer is on. */
export const TIER_ZOOM = 8;

export interface DeepFetcher {
  /** The ids of the pictures that have arrived. */
  readonly ready: Set<string>;
  /** The whole table of objects and its shapes once fetched, else `undefined`. */
  catalogue(): readonly DeepSkyObject[] | undefined;
  shapeOf(): ((object: DeepSkyObject) => DeepSkyShape) | undefined;
  /** An object of the whole table by any of its names, once fetched. */
  find(text: string): DeepSkyObject | undefined;
  /** Fetch the NGC and IC objects now; resolves when they are in. */
  loadTier(): Promise<void>;
  /** Fetch the pictures with these ids (at most `MAX_PICTURES` are in flight); each arrival calls the page's `changed`. */
  want(ids: readonly string[]): void;
}

let byId: Map<string, ReturnType<typeof drawnPictures>[number]> | undefined;
const pictureById = (): Map<string, ReturnType<typeof drawnPictures>[number]> => (byId ??= new Map(drawnPictures().map((picture) => [picture.id, picture])));

export function createDeepFetcher(base: string, changed: () => void): DeepFetcher {
  const ready = new Set<string>();
  const asked = new Set<string>();
  let objects: readonly DeepSkyObject[] | undefined;
  let shape: ((object: DeepSkyObject) => DeepSkyShape) | undefined;
  let find: ((text: string) => DeepSkyObject | undefined) | undefined;
  let tier: Promise<void> | undefined;
  return {
    ready,
    catalogue: () => objects,
    shapeOf: () => shape,
    find: (text) => find?.(text),
    loadTier() {
      tier ??= Promise.all([import("../src/deep-sky-ngc-ic.ts"), import("../src/deep-sky-shape-ngc-ic.ts")]).then(([table, shapes]) => {
        objects = table.deepSky();
        find = table.deepSkyObject;
        shape = shapes.deepSkyShape;
        changed();
      });
      return tier;
    },
    want(ids) {
      for (const id of ids.slice(0, MAX_PICTURES)) {
        if (asked.has(id)) continue;
        const picture = pictureById().get(id);
        if (picture === undefined) continue;
        asked.add(id);
        const url = pictureUrl(picture, base);
        const fallback = (): void => {
          // a server that will not be fetched from (no CORS): let the browser load it as an image, as before
          const image = new Image();
          image.decoding = "async";
          image.onload = () => {
            ready.add(id);
            changed();
          };
          image.onerror = () => asked.delete(id);
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
