// The sky out to a distance in 3D as a part a page can mount: the canvas (kazoku-ui's shared renderer, one WebGL context for the page), the shells' labels over it, and the calls that show layers and move the camera. The page owns the hands
// (the shared view controls, or a plain controller in an embed) and tells this part where the view is with `pose`.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import type { DistanceLayers } from "../src/distance.ts";
import { layersItem, type LayersFrame, type LayersScene } from "./layers-scene.ts";
import type { LayersLayout } from "./layers-layout.ts";
import { pageRenderer } from "./page-renderer.ts";
import { RESTING_POSE, type Pose } from "./space-camera.ts";
import { lightYearsText } from "./space-text.ts";
import type { Lang } from "./thumbs.ts";
import type * as ThreeModule from "./three-subset.ts";

export interface LayersMountOptions {
  /** The element the canvas goes in; the hands bind to it. */
  host: HTMLElement;
  /** The layer the labels go in, over the host. */
  labels: HTMLElement;
  lang(): Lang;
  /** Layers were shown (or failed to draw: `live` false). */
  onShown?(layers: DistanceLayers, layout: LayersLayout, live: boolean): void;
}

export interface LayersMount {
  /** Show layers. Resolves with whether the 3D view is live. */
  show(layers: DistanceLayers): Promise<boolean>;
  pose(pose: Pose, snap?: boolean): void;
  /** The language changed: write the labels again. */
  refresh(): void;
  readonly layout: LayersLayout | undefined;
  readonly renderer: SharedRenderer<typeof ThreeModule>;
  readonly live: boolean;
  dispose(): void;
}

const reducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mountLayers(options: LayersMountOptions): LayersMount {
  const { host, labels } = options;
  const renderer = pageRenderer();
  // the renderer's numbers, for the freeze test and anyone who asks the element
  Object.defineProperty(host, "stats", { get: () => renderer.stats, configurable: true });
  let token = 0;
  let view: View | undefined;
  let scene: LayersScene | undefined;
  let layout: LayersLayout | undefined;
  let live = false;
  let lastPose: Pose = { ...RESTING_POSE };
  let elements = new Map<string, HTMLElement>();

  function buildLabels(): void {
    labels.replaceChildren();
    elements = new Map();
    if (layout === undefined) return;
    for (const shell of layout.shells) {
      const el = document.createElement("div");
      el.className = "sp-label sp-tick";
      el.dataset["shell"] = String(shell.lightYears);
      el.textContent = options.lang() === "ja" ? `${lightYearsText(shell.lightYears, "ja")}光年` : `${lightYearsText(shell.lightYears, "en")} ly`;
      el.hidden = true;
      labels.append(el);
      elements.set(`shell:${shell.lightYears}`, el);
    }
  }

  function place(frame: LayersFrame): void {
    for (const point of frame.points) {
      const el = elements.get(point.key);
      if (el === undefined) continue;
      el.hidden = !point.visible;
      if (point.visible) el.style.transform = `translate(${Math.round(point.x + 4)}px, ${Math.round(point.y - 16)}px)`;
    }
  }

  async function show(layers: DistanceLayers): Promise<boolean> {
    const mine = ++token;
    view?.dispose();
    view = undefined;
    scene = undefined;
    live = false;
    const item = layersItem({ layers, onFrame: place, invalidate: () => view?.invalidate(), still: reducedMotion });
    layout = item.layout;
    buildLabels();
    const next = renderer.view(host, item, { still: null });
    view = next;
    const ok = await next.focus();
    if (mine !== token) return false;
    if (!ok || next.scene === undefined) {
      options.onShown?.(layers, item.layout, false);
      return false;
    }
    scene = next.scene as LayersScene;
    live = true;
    scene.pose(lastPose, true);
    next.invalidate();
    options.onShown?.(layers, item.layout, true);
    return true;
  }

  return {
    show,
    pose(next, snap = false) {
      lastPose = next;
      scene?.pose(next, snap);
    },
    refresh() {
      buildLabels();
      view?.invalidate();
    },
    get layout() {
      return layout;
    },
    renderer,
    get live() {
      return live;
    },
    dispose() {
      token += 1;
      view?.dispose();
      view = undefined;
      scene = undefined;
      labels.replaceChildren();
    },
  };
}
