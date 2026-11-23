// Drawing what a page asked "my sky" to show: the ring round the target with its name (a constellation's figure lit whole), the marker on the horizon for a target that is below it, and the page's own marks. Canvas 2D only; nothing is kept
// here. Both draw from numbers made when the target or the marks changed (or the clock ticked) and the camera, so a turn of the view does not recompute anything.
import { halo } from "./bodies-draw.ts";
import type { DrawnBody } from "./draw.ts";
import type { Direction, LocalFrame } from "./frame.ts";
import type { SkyMark } from "./marks.ts";
import { MARK_REACH } from "./reach.ts";
import { projectDirection, type CameraAxes, type SkyCamera } from "./view.ts";

const RAD = Math.PI / 180;
const FONT = '"Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';

/** The target as a draw needs it. */
export interface SceneTarget {
  /** The name to write beside the ring, in the language drawn. */
  label: string;
  /** The same with "(below the horizon)", for the marker on the horizon. */
  belowLabel: string;
  altitude: number;
  azimuth: number;
  up: boolean;
  /** A constellation: its lines, each the right ascension and declination of both ends (J2000), drawn lit. A constellation has a name but no ring. */
  lines?: ReadonlyArray<readonly [number, number, number, number]>;
}

const directionOf = (altitude: number, azimuth: number): Direction => ({ east: Math.cos(altitude * RAD) * Math.sin(azimuth * RAD), north: Math.cos(altitude * RAD) * Math.cos(azimuth * RAD), up: Math.sin(altitude * RAD) });

/** Write a name by a point, on the side that has room. */
function writeBeside(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number, width: number, fill: string): void {
  if (text === "") return;
  const room = ctx.measureText(text).width + gap + 8;
  const left = x + room > width;
  ctx.textAlign = left ? "right" : "left";
  halo(ctx, text, left ? x - gap : x + gap, y + 4, fill);
}

/**
 * Draw the target: a constellation's lines lit and its name, or a ring with the name beside it. A target below the horizon is a dashed ring where it is (if that is in the picture) and a marker on the horizon in its direction with its name and
 * "below the horizon". Returns the ring as drawn (for a test and for the page), or `undefined` when none is in the picture.
 *
 * @param ctx - A 2D context, scaled so one unit is one CSS pixel.
 * @param camera - The camera.
 * @param axes - `cameraAxes(camera.heading, camera.pitch)`.
 * @param frame - The sky's turn for the place and moment, for a constellation's stars.
 * @param target - What to draw.
 * @returns Where the ring or the name was drawn, and how far it reaches; or `undefined`.
 *
 * @example
 * ```ts no-run
 * import { drawTarget } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * const ring = drawTarget(ctx, camera, axes, frame, { label: "Mars", belowLabel: "Mars (below the horizon)", altitude: 30, azimuth: 200, up: true });
 * console.log(ring);
 * ```
 */
export function drawTarget(ctx: CanvasRenderingContext2D, camera: SkyCamera, axes: CameraAxes, frame: LocalFrame, target: SceneTarget, font: string = FONT): DrawnBody | undefined {
  const { width, height } = camera;
  const spot = { x: 0, y: 0 };
  const on = (x: number, y: number): boolean => x > -30 && x < width + 30 && y > -30 && y < height + 30;
  let found: DrawnBody | undefined;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (target.lines !== undefined && target.up) {
    // the figure's lines, lit over the faint ones: a wide soft stroke under a bright thin one
    const ends: Array<[number, number, number, number]> = [];
    const spotA = { east: 0, north: 0, up: 0 };
    const spotB = { east: 0, north: 0, up: 0 };
    const a = { x: 0, y: 0 };
    for (const [ra1, dec1, ra2, dec2] of target.lines) {
      frame.fromJ2000(ra1, dec1, spotA);
      frame.fromJ2000(ra2, dec2, spotB);
      if (spotA.up <= 0 || spotB.up <= 0) continue;
      if (!projectDirection(camera, axes, spotA, a)) continue;
      const ax = a.x;
      const ay = a.y;
      if (!projectDirection(camera, axes, spotB, a)) continue;
      ends.push([ax, ay, a.x, a.y]);
    }
    for (const [width2, colour] of [[6, "rgba(143, 176, 255, 0.22)"], [2, "rgba(214, 228, 255, 0.95)"]] as const) {
      ctx.lineWidth = width2;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of ends) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
  }
  const at = directionOf(target.altitude, target.azimuth);
  if (projectDirection(camera, axes, at, spot) && on(spot.x, spot.y)) {
    ctx.font = `600 13px ${font}`;
    if (target.lines === undefined) {
      const r = 20;
      ctx.lineWidth = 2;
      ctx.strokeStyle = target.up ? "rgba(255, 226, 140, 0.95)" : "rgba(255, 226, 140, 0.7)";
      ctx.setLineDash(target.up ? [] : [4, 4]);
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (target.up) {
        ctx.textBaseline = "alphabetic";
        writeBeside(ctx, target.label, spot.x, spot.y, r + 6, width, "#ffe9a8");
      }
      found = { kind: "target", id: "target", x: spot.x, y: spot.y, r };
    } else if (target.up) {
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";
      halo(ctx, target.label, Math.max(ctx.measureText(target.label).width / 2 + 4, Math.min(width - ctx.measureText(target.label).width / 2 - 4, spot.x)), Math.max(16, Math.min(height - 10, spot.y)), "#ffe9a8");
      found = { kind: "target", id: "target", x: spot.x, y: spot.y, r: 12 };
    }
  }
  if (!target.up) {
    // below the horizon: a marker on the horizon in its direction, with its name
    if (projectDirection(camera, axes, directionOf(0, target.azimuth), spot) && on(spot.x, spot.y)) {
      const x = Math.max(8, Math.min(width - 8, spot.x));
      const y = Math.max(12, Math.min(height - 12, spot.y));
      ctx.fillStyle = "rgba(255, 226, 140, 0.95)";
      ctx.strokeStyle = "rgba(4, 7, 18, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 12);
      ctx.lineTo(x + 8, y - 12);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.font = `600 13px ${font}`;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";
      const half = ctx.measureText(target.belowLabel).width / 2;
      halo(ctx, target.belowLabel, Math.max(half + 4, Math.min(width - half - 4, x)), Math.max(14, y - 18), "#ffe9a8");
      found ??= { kind: "target", id: "target", x, y, r: 12 };
    }
  }
  return found;
}

/**
 * Draw a page's marks: a dot (a diamond for a `satellite`) with the label beside it, dimmed when it is below the horizon. Returns each mark that was drawn with how far a press may be from it, for picking.
 *
 * @param ctx - A 2D context, scaled so one unit is one CSS pixel.
 * @param camera - The camera.
 * @param axes - `cameraAxes(camera.heading, camera.pitch)`.
 * @param marks - The marks, cleaned.
 * @returns The marks that fall in the picture, as `kind: "mark"` with the mark's `id`.
 *
 * @example
 * ```ts no-run
 * import { drawMarks } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * const hits = drawMarks(ctx, camera, axes, [{ id: "iss", azimuth: 250, altitude: 42, label: "ISS", kind: "satellite" }]);
 * console.log(hits.length);
 * ```
 */
export function drawMarks(ctx: CanvasRenderingContext2D, camera: SkyCamera, axes: CameraAxes, marks: readonly SkyMark[], font: string = FONT): DrawnBody[] {
  const hits: DrawnBody[] = [];
  if (marks.length === 0) return hits;
  const spot = { x: 0, y: 0 };
  ctx.font = `12px ${font}`;
  ctx.textBaseline = "alphabetic";
  for (const mark of marks) {
    if (!projectDirection(camera, axes, directionOf(mark.altitude, mark.azimuth), spot)) continue;
    const { x, y } = spot;
    if (x < -10 || x > camera.width + 10 || y < -10 || y > camera.height + 10) continue;
    ctx.globalAlpha = mark.altitude > 0 ? 1 : 0.45;
    ctx.fillStyle = "#ffcf7a";
    ctx.strokeStyle = "rgba(4, 7, 18, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (mark.kind === "satellite") {
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
    } else ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    writeBeside(ctx, mark.label, x, y, 10, camera.width, "rgba(255, 232, 190, 0.96)");
    ctx.globalAlpha = 1;
    hits.push({ kind: "mark", id: mark.id, x, y, r: MARK_REACH });
  }
  return hits;
}
