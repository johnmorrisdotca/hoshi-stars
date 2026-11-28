// Play, Pause and Back for a sky that is dated by a moment. The bar moves nothing itself: this clock does, and only while Play is on, so a paused sky is not drawn again.
import "@johnmorrisdotca/kazoku-ui/replay-bar/define";
import type { ReplayBarElement, ReplayDetail } from "@johnmorrisdotca/kazoku-ui/replay-bar/element";
import { skyMoment } from "./sky-clock.ts";

const SPEEDS = [1, 3600, 86400, -3600] as const;
const DEFAULT_SPEED = 3600;
const DRAW_MS = 250;

interface Address {
  get(key: string): string | null;
  set(key: string, value: string | null): void;
  flush?(): void;
}

/** Wire `#replay` to the page's moment. Back returns to the date the reader chose. Reduced motion never starts Play on its own. */
export function attachSkyPlay(opts: {
  address: Address;
  /** The moment shown, or null while the page follows the clock. */
  time: () => number | null;
  /** Show this moment. Does not move the date Back returns to. */
  show: (ms: number) => void;
  /** Write the moment into the address. Called when Play stops, and when the page is left while it runs. */
  settle: () => void;
  label: () => string;
  lang: () => string;
}): { chose: (ms: number) => void; stopped: () => void } {
  const bar = document.querySelector<ReplayBarElement>("#replay")!;
  const asked = Number(opts.address.get("speed"));
  let speed: number = (SPEEDS as readonly number[]).includes(asked) ? asked : DEFAULT_SPEED;
  let origin = opts.time() ?? Date.now();
  let runMs = origin;
  let runAt = 0;
  let frame = 0;
  let drawnAt = 0;

  const writeSpeed = (): void => {
    opts.address.set("play", bar.playing ? "on" : null);
    opts.address.set("speed", speed === DEFAULT_SPEED ? null : String(speed));
  };
  const cancel = (): void => {
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
  };
  const tick = (now: number): void => {
    frame = 0;
    if (!bar.playing) return;
    if (now - drawnAt >= DRAW_MS && document.activeElement?.id !== "moment") {
      drawnAt = now;
      opts.show(skyMoment(runMs, now - runAt, speed));
    }
    frame = requestAnimationFrame(tick);
  };
  const arm = (): void => {
    const current = opts.time() ?? Date.now();
    if (opts.time() === null) {
      origin = current;
      opts.show(current);
    }
    runMs = opts.time() ?? current;
    runAt = performance.now();
    drawnAt = 0;
    cancel();
    frame = requestAnimationFrame(tick);
  };

  bar.setAttribute("speed", String(speed));
  bar.words = { start: opts.label() };
  bar.setAttribute("lang", opts.lang());
  bar.addEventListener("kazoku-replay", (event) => {
    const { action, playing, reason } = (event as CustomEvent<ReplayDetail>).detail;
    if (reason === "init") return;
    if (action === "start") {
      cancel();
      opts.show(origin);
      opts.settle();
      writeSpeed();
      return;
    }
    if (action === "repeat") return;
    if (playing) arm();
    else {
      cancel();
      opts.settle();
    }
    writeSpeed();
  });
  bar.addEventListener("kazoku-speedchange", (event) => {
    const { value, reason } = (event as CustomEvent<{ value: number; reason: string }>).detail;
    if (reason !== "user" || !(SPEEDS as readonly number[]).includes(value)) return;
    speed = value;
    if (bar.playing) {
      runMs = opts.time() ?? runMs;
      runAt = performance.now();
    }
    writeSpeed();
  });
  document.addEventListener("hoshi-language", () => {
    bar.words = { start: opts.label() };
    bar.setAttribute("lang", opts.lang());
  });
  addEventListener("pagehide", () => {
    if (!bar.playing) return;
    opts.settle();
    opts.address.flush?.();
  });
  if (opts.address.get("play") === "on") bar.playing = true;
  if (!bar.playing) {
    opts.address.set("play", null);
    writeSpeed();
  }

  return {
    /** The reader chose a date. Back returns to it, and a running clock goes on from it. */
    chose: (ms: number): void => {
      origin = ms;
      if (!bar.playing) return;
      runMs = ms;
      runAt = performance.now();
    },
    /** Play is off (Now, or the page left the dated moment). */
    stopped: (): void => {
      cancel();
      if (bar.playing) bar.playing = false;
      writeSpeed();
    },
  };
}
