// Drawing "my sky" on a canvas for a camera: the sky and ground shading, the horizon with its compass, the constellation lines and names, the stars (sized by brightness, tinted by their colour, dimmed by the sun's light and by the air near the
// horizon), the names of the brightest, the planets, the Sun and the Moon with its phase. Only what is above the horizon is drawn; the ground below it is dark. Everything comes from numbers made once for a moment (`placeStars`, the report)
// and the camera, so a turn of the view redraws without recomputing the sky. Canvas 2D only; nothing is stored here but scratch objects.
import { constellation } from "../constellations.ts";
import type { FigureLines, SkyProjector, StarNames } from "../sky-labels.ts";
import { starColour, stars as catalogue } from "../stars.ts";
import { brightShown } from "../star-filter-bright.ts";
import { starFilterKey, type StarFilter } from "../star-filter.ts";
import { paintBackground } from "./background.ts";
import { drawMoonDisc, drawMoonGlow, drawPlanet, drawSun, halo, planetRadius, ring } from "./bodies-draw.ts";
import type { Direction, LocalFrame } from "./frame.ts";
import type { SkyMark } from "./marks.ts";
import { nameSpot, PLANET_REACH, type Box } from "./reach.ts";
import type { SkyReport } from "./report.ts";
import { drawMarks, drawTarget, type SceneTarget } from "./target-draw.ts";
import { cameraAxes, projectDirection, viewScale, type SkyCamera } from "./view.ts";
import { COMPASS, mySkyWords, type MySkyLanguage } from "./words.ts";

const RAD = Math.PI / 180;
const FONT = '"Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';

/** The stars of the catalogue placed in the sky of a place and a moment: where each stands (east, north, up), how bright and what colour. */
export interface PlacedStars {
  count: number;
  east: Float32Array;
  north: Float32Array;
  up: Float32Array;
  magnitude: Float32Array;
  colour: string[];
}

/**
 * Place every catalogue star in this sky: one turn of its position each.
 *
 * @param frame - `localFrame` of the place and the moment.
 * @returns The table, to draw from until the moment moves on.
 *
 * @example
 * ```ts no-run
 * import { localFrame } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const placed = placeStars(localFrame({ latitude: 49.28, longitude: -123.12 }, new Date()));
 * console.log(placed.count);
 * ```
 */
export function placeStars(frame: LocalFrame): PlacedStars {
  const list = catalogue();
  const placed: PlacedStars = { count: list.length, east: new Float32Array(list.length), north: new Float32Array(list.length), up: new Float32Array(list.length), magnitude: new Float32Array(list.length), colour: [] };
  const spot: Direction = { east: 0, north: 0, up: 0 };
  list.forEach((star, i) => {
    frame.fromJ2000(star.rightAscension, star.declination, spot);
    placed.east[i] = spot.east;
    placed.north[i] = spot.north;
    placed.up[i] = spot.up;
    placed.magnitude[i] = star.magnitude;
    placed.colour.push(starColour(star));
  });
  return placed;
}

/** Something drawn that a tap can pick: where it is and how far a tap may be from it. */
export interface DrawnBody {
  /** `mark` is one of the page's own marks (its `id` is the mark's) and `target` is the ring round the target; neither is a body of the sky. */
  kind: "sun" | "moon" | "planet" | "mark" | "target";
  id: string;
  x: number;
  y: number;
  r: number;
  /** Where the body's name is written, when it has one: a press on it counts as a press on the body. */
  name?: Box;
}

/** Everything a draw needs. */
export interface Scene {
  camera: SkyCamera;
  lang: MySkyLanguage;
  frame: LocalFrame;
  report: SkyReport;
  stars: PlacedStars;
  /** The lines of the figures, or `null` for none. */
  lines: FigureLines | null;
  /** The strength the lines have in a dark sky, 0 to 1. */
  lineStrength: number;
  names: StarNames;
  /** Show the stars (and lines) in daylight too, as if the Sun were not up. */
  daylight: boolean;
  /** Only the stars this keeps are drawn and named (a distance range and a faintest magnitude); the figures' lines stay. Every star when left out. */
  filter?: StarFilter;
  /** The fonts of the canvas text. `label` is the family of every name (stars, constellations, the Moon and planets, the target, your marks) and `labelSize` and `labelWeight` are the star names' and constellation names' when the page set them; `sky` is the family of the other text (the compass letters). The package's own font when left out. */
  fonts?: { label?: string | undefined; labelSize?: number | undefined; labelWeight?: string | undefined; sky?: string | undefined };
  /** The body a tap picked, to ring. */
  picked: string | undefined;
  /** What a page asked the sky to turn to, to ring and name. */
  target?: SceneTarget;
  /** The page's own points. */
  marks?: readonly SkyMark[];
  /** A rectangle (a panel over the picture) that names keep clear of, in pixels. */
  keepClear?: { x0: number; y0: number; x1: number; y1: number };
}

const directionOf = (altitude: number, azimuth: number): Direction => ({ east: Math.cos(altitude * RAD) * Math.sin(azimuth * RAD), north: Math.cos(altitude * RAD) * Math.cos(azimuth * RAD), up: Math.sin(altitude * RAD) });

let backdrop: HTMLCanvasElement | undefined;
const settingsSeen = new WeakMap<object, string>();

/** Change a setting only when it differs from the last time, so a redraw at the same settings changes nothing. */
function remember(owner: object, key: string, change: () => void): void {
  if (settingsSeen.get(owner) === key) return;
  settingsSeen.set(owner, key);
  change();
}

function paintBackdrop(ctx: CanvasRenderingContext2D, scene: Scene, axesSun: Direction): void {
  const { camera } = scene;
  const cell = 3;
  const columns = Math.ceil(camera.width / cell);
  const rows = Math.ceil(camera.height / cell);
  backdrop ??= document.createElement("canvas");
  if (backdrop.width !== columns || backdrop.height !== rows) {
    backdrop.width = columns;
    backdrop.height = rows;
  }
  const small = backdrop.getContext("2d")!;
  const image = small.createImageData(columns, rows);
  paintBackground(image.data, columns, rows, cell, camera, { altitude: scene.report.sun.altitude, direction: axesSun });
  small.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(backdrop, 0, 0, columns * cell, rows * cell);
}

/**
 * Draw the whole view on a canvas whose context is already scaled to CSS pixels.
 *
 * @param ctx - A 2D context, scaled so one unit is one CSS pixel.
 * @param scene - The camera, the moment's numbers and the options.
 * @returns The Sun, Moon and planets as drawn, for picking.
 *
 * @example
 * ```ts no-run
 * import { drawScene } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * const bodies = drawScene(document.querySelector("canvas")!.getContext("2d")!, scene);
 * console.log(bodies.length);
 * ```
 */
export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene): DrawnBody[] {
  const { camera, report, lang } = scene;
  const { width, height } = camera;
  const labelFont = scene.fonts?.label ?? FONT;
  const skyFont = scene.fonts?.sky ?? FONT;
  const nameSize = scene.fonts?.labelSize ?? 11;
  const nameWeight = scene.fonts?.labelWeight === undefined ? "" : `${scene.fonts.labelWeight} `;
  const axes = cameraAxes(camera.heading, camera.pitch);
  const words = mySkyWords(lang);
  const sunDirection = directionOf(report.sun.altitude, report.sun.azimuth);
  const limit = scene.daylight ? 6 : report.limit;
  ctx.clearRect(0, 0, width, height);
  paintBackdrop(ctx, scene, sunDirection);

  const spot = { x: 0, y: 0 };
  const place = (direction: Direction): boolean => projectDirection(camera, axes, direction, spot);

  // the horizon, a line round the whole sky with a tick every 15 degrees
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(210, 225, 255, 0.45)";
  ctx.beginPath();
  let pen = false;
  let lastX = 0;
  let lastY = 0;
  for (let az = 0; az <= 360; az += 2) {
    if (place(directionOf(0, az)) && (!pen || Math.hypot(spot.x - lastX, spot.y - lastY) < 400)) {
      if (pen) ctx.lineTo(spot.x, spot.y);
      else ctx.moveTo(spot.x, spot.y);
      pen = true;
      lastX = spot.x;
      lastY = spot.y;
    } else pen = false;
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(210, 225, 255, 0.4)";
  ctx.beginPath();
  for (let az = 0; az < 360; az += 15) {
    const a = { x: 0, y: 0 };
    if (!place(directionOf(0, az))) continue;
    a.x = spot.x;
    a.y = spot.y;
    if (!place(directionOf(az % 45 === 0 ? -2.2 : -1.2, az))) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(spot.x, spot.y);
  }
  ctx.stroke();

  const project: SkyProjector = (ra, dec, out) => {
    const d = scene.frame.fromJ2000(ra, dec, { east: 0, north: 0, up: 0 });
    if (d.up <= 0 || !projectDirection(camera, axes, d, spot)) return false;
    out.x = spot.x;
    out.y = spot.y;
    return spot.x > -40 && spot.x < width + 40 && spot.y > -40 && spot.y < height + 40;
  };
  const view = { width, height, margin: 6 };

  // the constellation lines, only when the sky is dark enough to see the stars they join
  const strength = limit < 1.5 ? 0 : scene.lineStrength * Math.min(1, (limit - 1.5) / 3);
  if (scene.lines !== null && strength > 0) {
    remember(scene.lines, `${strength.toFixed(3)} ${lang}`, () => scene.lines!.set({ ...scene.lines!.settings, strength, lang }));
    scene.lines.update(project, view);
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#8fb0ff";
    for (const figure of scene.lines.figures) {
      if (figure.end <= figure.start) continue;
      ctx.globalAlpha = scene.lines.opacityOf(figure);
      ctx.beginPath();
      for (let s = figure.start; s < figure.end; s++) {
        const k = s * 4;
        ctx.moveTo(scene.lines.segments[k]!, scene.lines.segments[k + 1]!);
        ctx.lineTo(scene.lines.segments[k + 2]!, scene.lines.segments[k + 3]!);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // the stars
  const { stars } = scene;
  const kept = scene.filter === undefined ? undefined : brightShown(scene.filter);
  for (let i = 0; i < stars.count; i++) {
    const up = stars.up[i]!;
    if (up <= 0) continue;
    if (kept !== undefined && kept.mask[i] === 0) continue;
    const magnitude = stars.magnitude[i]!;
    const altitude = Math.asin(up) / RAD;
    // the air near the horizon dims a star by up to two magnitudes
    const reach = limit - (altitude < 15 ? ((15 - altitude) / 15) * 2 : 0);
    if (magnitude > reach) continue;
    if (!projectDirection(camera, axes, { east: stars.east[i]!, north: stars.north[i]!, up }, spot)) continue;
    if (spot.x < -6 || spot.x > width + 6 || spot.y < -6 || spot.y > height + 6) continue;
    ctx.globalAlpha = Math.max(0.15, Math.min(1, (reach - magnitude + 0.5) / 1.6));
    ctx.fillStyle = stars.colour[i]!;
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 0.55 + 3.4 * Math.exp(-0.35 * (magnitude + 1.5)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // where the Moon and the planets are on the screen, so a star's name keeps clear of them and of their own names
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const covers: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const planet of report.planets) {
    if (planet.up && place(directionOf(planet.altitude, planet.azimuth))) covers.push({ x0: spot.x - 14, y0: spot.y - 14, x1: spot.x + 70, y1: spot.y + 14 });
  }
  if (report.moon.altitude > -1 && place(directionOf(report.moon.altitude, report.moon.azimuth))) covers.push({ x0: spot.x - 36, y0: spot.y - 36, x1: spot.x + 80, y1: spot.y + 36 });
  const clear = scene.keepClear;
  const covered = (x: number, y: number): boolean => covers.some((c) => x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1) || (clear !== undefined && x > clear.x0 && x < clear.x1 && y > clear.y0 && y < clear.y1);
  boxes.push(...covers);
  if (scene.keepClear !== undefined) boxes.push(scene.keepClear);

  // the names of the brightest stars
  ctx.textBaseline = "alphabetic";
  if (limit >= 1 && scene.names.settings.count !== 0) {
    const include = kept === undefined ? undefined : (star: { hr: number }): boolean => kept.has(star.hr);
    remember(scene.names, `${lang} ${Math.min(limit - 0.5, 3).toFixed(2)} ${scene.names.settings.count} ${scene.filter === undefined ? "" : starFilterKey(scene.filter)} ${labelFont} ${nameSize} ${nameWeight}`, () => scene.names.set({ ...scene.names.settings, lang, magnitude: Math.min(limit - 0.5, 3), style: { ...scene.names.settings.style, font: labelFont, size: nameSize }, ...(include === undefined ? { include: undefined } : { include }) }));
    scene.names.update(project, view, covered);
    ctx.font = `${nameWeight}${scene.names.style.size}px ${scene.names.style.font}`;
    for (const label of scene.names.labels) {
      ctx.textAlign = label.anchor === "start" ? "left" : label.anchor === "end" ? "right" : "center";
      if (label.ring > 0) {
        ctx.lineWidth = scene.names.style.ringWidth;
        ctx.strokeStyle = scene.names.style.ringColour;
        ctx.beginPath();
        ctx.arc(label.x, label.y, label.ring, 0, Math.PI * 2);
        ctx.stroke();
      }
      halo(ctx, label.text, label.textX, label.textY, "rgba(226, 234, 255, 0.92)");
      boxes.push({ x0: label.x0, y0: label.y0, x1: label.x1, y1: label.y1 });
    }
  }

  // the names of the constellations in view, widest first, none over another name
  if (scene.lines !== null && strength > 0) {
    ctx.font = `italic ${nameWeight}${nameSize}px ${labelFont}`;
    ctx.textAlign = "center";
    const wide = scene.lines.figures.filter((f) => f.end > f.start).sort((a, b) => b.right - b.left - (a.right - a.left));
    for (const figure of wide) {
      if (figure.right - figure.left < 46) continue;
      const found = constellation(figure.abbreviation);
      if (found === undefined) continue;
      const text = lang === "ja" ? found.japanese : found.name;
      const w = ctx.measureText(text).width;
      const x = Math.max(w / 2 + 4, Math.min(width - w / 2 - 4, figure.x));
      const y = Math.max(14, Math.min(height - 8, figure.top - 7));
      const box = { x0: x - w / 2 - 2, y0: y - 12, x1: x + w / 2 + 2, y1: y + 3 };
      if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      boxes.push(box);
      ctx.globalAlpha = Math.min(1, strength / 0.2);
      halo(ctx, text, x, y, "rgba(150, 180, 245, 0.95)");
    }
    ctx.globalAlpha = 1;
  }
  if (scene.lines !== null && scene.lines.name !== undefined) {
    ctx.font = `600 13px ${labelFont}`;
    ctx.textAlign = "center";
    halo(ctx, scene.lines.name.text, scene.lines.name.x, scene.lines.name.y, "#ffffff");
  }

  const drawn: DrawnBody[] = [];
  const ppd = viewScale(camera) * RAD;
  ctx.font = `12px ${labelFont}`;
  // the planets above the horizon, then their names, each clear of the other planets and of the names already written
  const here: Array<{ id: (typeof report.planets)[number]["id"]; x: number; y: number; radius: number }> = [];
  const taken: Box[] = [];
  for (const planet of report.planets) {
    if (!planet.up || !place(directionOf(planet.altitude, planet.azimuth))) continue;
    const x = spot.x;
    const y = spot.y;
    if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
    drawPlanet(ctx, planet, x, y);
    const radius = planetRadius(planet.magnitude);
    here.push({ id: planet.id, x, y, radius });
    taken.push({ x0: x - radius, y0: y - radius, x1: x + radius, y1: y + radius });
    if (scene.picked === planet.id) ring(ctx, x, y, radius + 9);
  }
  for (const planet of here) {
    const text = words.planet[planet.id];
    const named = nameSpot(taken, planet.x, planet.y, planet.radius, ctx.measureText(text).width);
    ctx.textAlign = named.align;
    halo(ctx, text, named.x, named.y, "rgba(255, 244, 214, 0.95)");
    drawn.push({ kind: "planet", id: planet.id, x: planet.x, y: planet.y, r: PLANET_REACH, name: named.box });
  }
  // the Sun
  if (report.sun.altitude > -2 && place(sunDirection)) {
    drawSun(ctx, spot.x, spot.y, 13);
    drawn.push({ kind: "sun", id: "sun", x: spot.x, y: spot.y, r: 24 });
    if (scene.picked === "sun") ring(ctx, spot.x, spot.y, 22);
  }
  // the Moon, turned so its lit side faces the Sun
  const moon = report.moon;
  if (moon.altitude > -1 && place(directionOf(moon.altitude, moon.azimuth))) {
    const x = spot.x;
    const y = spot.y;
    const radius = Math.max(11, Math.min(30, 0.83 * ppd));
    const there = directionOf(moon.altitude, moon.azimuth);
    const toward = moon.towardSun;
    const dot = there.east * toward.east + there.north * toward.north + there.up * toward.up;
    const across = { east: toward.east - dot * there.east, north: toward.north - dot * there.north, up: toward.up - dot * there.up };
    const size = Math.hypot(across.east, across.north, across.up);
    let limb = 0;
    if (size > 1e-6) {
      const step = Math.tan(1 * RAD) / size;
      const ahead = { east: there.east + across.east * step, north: there.north + across.north * step, up: there.up + across.up * step };
      if (place(ahead)) limb = Math.atan2(spot.y - y, spot.x - x);
    }
    if (x > -40 && x < width + 40 && y > -40 && y < height + 40) {
      drawMoonGlow(ctx, x, y, radius, moon.phase.illuminated);
      drawMoonDisc(ctx, x, y, radius, moon.phase.phaseAngle, limb, Math.max(0, Math.min(1, -report.sun.altitude / 12)));
      ctx.textAlign = "left";
      halo(ctx, words.moon, x + radius + 5, y + 4, "rgba(255, 250, 230, 0.95)");
      drawn.push({ kind: "moon", id: "moon", x, y, r: Math.max(24, radius + 8) });
      if (scene.picked === "moon") ring(ctx, x, y, radius + 7);
    }
  }

  // what the page asked for: the ring round the target and its name, then the page's own marks over everything of the sky
  if (scene.target !== undefined) {
    const ringed = drawTarget(ctx, camera, axes, scene.frame, scene.target, labelFont);
    if (ringed !== undefined) drawn.push(ringed);
  }
  if (scene.marks !== undefined) drawn.push(...drawMarks(ctx, camera, axes, scene.marks, labelFont));

  // the compass letters on the ground just under the horizon
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  COMPASS.forEach((point, i) => {
    const main = i % 2 === 0;
    if (!place(directionOf(main ? -4.5 : -3.5, i * 45))) return;
    if (spot.x < 8 || spot.x > width - 8 || spot.y < 8 || spot.y > height - 8) return;
    ctx.font = `${main ? 700 : 500} ${main ? 17 : 12}px ${skyFont}`;
    ctx.fillStyle = main ? "rgba(235, 242, 255, 0.95)" : "rgba(200, 214, 245, 0.7)";
    ctx.fillText(words.compass[point], spot.x, spot.y);
  });
  return drawn;
}
