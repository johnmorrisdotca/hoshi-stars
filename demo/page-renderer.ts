// The page's one shared renderer (one WebGL context for every 3D view on the page), made on first use: three.js is loaded when the first view goes live.
import { createSharedRenderer, type SharedRenderer } from "@johnmorrisdotca/kazoku-ui/renderer";
import type * as ThreeModule from "./three-subset.ts";

let shared: SharedRenderer<typeof ThreeModule> | undefined;
export function pageRenderer(): SharedRenderer<typeof ThreeModule> {
  shared ??= createSharedRenderer<typeof ThreeModule>({ load: () => import("./three-subset.ts"), stillSize: 320, antialias: true });
  return shared;
}
