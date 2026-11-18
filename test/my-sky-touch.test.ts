// Two fingers dragging together on "my sky" turn the sky, as a mouse drag and the arrow keys do (the family's gesture check, `touch-pan`): the controller moves the view by the middle of the two fingers, and the sky plays that as a heading and a pitch.
import assert from "node:assert/strict";
import { test } from "node:test";
import { attachSkyHands, type SkyView } from "../src/my-sky/hands.ts";
import { degreesPerPixel } from "../src/my-sky/view.ts";

// the controller lets go of its frame loop on destroy, and node has no animation frames
Object.assign(globalThis, { cancelAnimationFrame: () => {}, requestAnimationFrame: () => 0 });

/** Just enough of an element for the controller to bind to: events, a size, a style and a pointer capture that does nothing. */
function fakeBox(): HTMLElement {
  const box = new EventTarget() as unknown as Record<string, unknown>;
  box["style"] = {};
  box["dataset"] = {};
  box["ownerDocument"] = new EventTarget();
  box["setPointerCapture"] = () => {};
  box["getBoundingClientRect"] = () => ({ left: 0, top: 0, right: 400, bottom: 800, width: 400, height: 800 });
  return box as unknown as HTMLElement;
}

function touch(box: HTMLElement, type: "pointerdown" | "pointermove" | "pointerup", id: number, x: number, y: number): void {
  const event = Object.assign(new Event(type, { cancelable: true }), { pointerId: id, pointerType: "touch", clientX: x, clientY: y, button: 0, ctrlKey: false, metaKey: false, shiftKey: false });
  box.dispatchEvent(event);
}

function sky(fov: number): { box: HTMLElement; view: SkyView; moves: SkyView[]; destroy: () => void } {
  const box = fakeBox();
  const view: SkyView = { heading: 100, pitch: 20, fov };
  const moves: SkyView[] = [];
  const hands = attachSkyHands(box, {
    camera: () => ({ ...view, width: 400, height: 800 }),
    opening: () => 90,
    moved: (next) => {
      Object.assign(view, next);
      moves.push({ ...next });
    },
    home: () => ({ heading: 0, pitch: 0, fov: 90 }),
  });
  return { box, view, moves, destroy: () => hands.destroy() };
}

/** The two fingers drag by (dx, dy) in ten steps, the fingers moving one after the other as a real pair of fingers' events arrive, so no event holds the distance between them exactly. */
function dragTogether(box: HTMLElement, dx: number, dy: number): void {
  let a = { x: 160, y: 400 };
  let b = { x: 240, y: 400 };
  touch(box, "pointerdown", 1, a.x, a.y);
  touch(box, "pointerdown", 2, b.x, b.y);
  for (let step = 1; step <= 10; step += 1) {
    a = { x: 160 + (dx * step) / 10, y: 400 + (dy * step) / 10 };
    touch(box, "pointermove", 1, a.x, a.y);
    b = { x: 240 + (dx * step) / 10, y: 400 + (dy * step) / 10 };
    touch(box, "pointermove", 2, b.x, b.y);
  }
  touch(box, "pointerup", 2, b.x, b.y);
  touch(box, "pointerup", 1, a.x, a.y);
}

test("two fingers dragging together on a zoomed sky turn it by the pixels dragged, as the picture's own scale reads them", () => {
  const { box, view, destroy } = sky(45);
  const camera = { heading: 100, pitch: 20, fov: 45, width: 400, height: 800 };
  const degrees = degreesPerPixel(camera);
  dragTogether(box, 50, 25);
  // the sky is dragged right, so you look left; it is dragged down, so you look up
  assert.ok(Math.abs(view.heading - (100 - 50 * degrees)) < 0.5, `heading ${view.heading}, wanted ${100 - 50 * degrees}`);
  assert.ok(Math.abs(view.pitch - (20 + 25 * degrees)) < 0.5, `pitch ${view.pitch}, wanted ${20 + 25 * degrees}`);
  assert.ok(Math.abs(view.fov - 45) < 0.5, `the field of view stayed at 45 degrees, not ${view.fov}`);
  destroy();
});

test("two fingers dragging together turn the sky whichever finger's event comes first", () => {
  const { box, view, destroy } = sky(30);
  touch(box, "pointerdown", 1, 160, 400);
  touch(box, "pointerdown", 2, 240, 400);
  for (let step = 1; step <= 10; step += 1) {
    touch(box, "pointermove", 2, 240 - 4 * step, 400);
    touch(box, "pointermove", 1, 160 - 4 * step, 400);
  }
  touch(box, "pointerup", 1, 120, 400);
  touch(box, "pointerup", 2, 200, 400);
  assert.ok(view.heading > 100, `dragged left, the sky turns the other way: heading ${view.heading}`);
  destroy();
});

test("a pinch about the middle of the sky narrows the field of view and leaves the heading and the pitch where they were", () => {
  const { box, view, destroy } = sky(45);
  touch(box, "pointerdown", 1, 160, 400);
  touch(box, "pointerdown", 2, 240, 400);
  for (let step = 1; step <= 10; step += 1) {
    touch(box, "pointermove", 1, 160 - 4 * step, 400);
    touch(box, "pointermove", 2, 240 + 4 * step, 400);
  }
  touch(box, "pointerup", 1, 120, 400);
  touch(box, "pointerup", 2, 280, 400);
  assert.ok(view.fov < 30, `the field of view narrowed from 45: ${view.fov}`);
  assert.ok(Math.abs(view.heading - 100) < 0.5 && Math.abs(view.pitch - 20) < 0.5, `heading ${view.heading} and pitch ${view.pitch} stayed`);
  destroy();
});
