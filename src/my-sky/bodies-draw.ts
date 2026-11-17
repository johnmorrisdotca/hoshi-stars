// Drawing the Sun, the Moon and the planets of "my sky" on a canvas: the Moon as a disc with its real phase (the lit part is a half disc on the side facing the Sun, closed by the terminator, a half ellipse), the Sun as a glow with a bright disc,
// the planets as coloured dots sized by brightness. They are drawn larger than the sky's own scale (the Moon is half a degree across, which is a few pixels), as every picture of the sky does. Canvas only; no state.
import type { PlanetInSky } from "./report.ts";

type Context = CanvasRenderingContext2D;

/** The colour of each planet's dot. */
export const PLANET_COLOURS: Readonly<Record<string, string>> = { mercury: "#d8d2c8", venus: "#fff6d8", mars: "#ff9a72", jupiter: "#ffe9c2", saturn: "#f2dc9a" };

/**
 * Draw the Moon's disc with its phase at a point: the dark side faintly lit (earthshine), the lit part bright, turned so the lit side faces the Sun.
 *
 * @param ctx - A 2D canvas context.
 * @param x - The disc's centre x.
 * @param y - The disc's centre y.
 * @param radius - The disc's radius in pixels.
 * @param phaseAngle - The angle Sun-Moon-Earth in degrees: 0 full, 90 half, 180 new.
 * @param limbAngle - The direction of the lit side on the screen in radians (0 to the right, the angle running clockwise as the canvas does).
 * @param darkness - How much of the dark side is drawn, 0 (none: in daylight the dark side is just sky) to 1 (a dim disc, earthshine, at night).
 *
 * @example
 * ```ts no-run
 * import { drawMoonDisc } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * const canvas = document.createElement("canvas");
 * drawMoonDisc(canvas.getContext("2d")!, 50, 50, 20, 120, 0); // a crescent lit on its right
 * ```
 */
export function drawMoonDisc(ctx: Context, x: number, y: number, radius: number, phaseAngle: number, limbAngle: number, darkness = 1): void {
  const cos = Math.cos((phaseAngle * Math.PI) / 180);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(limbAngle);
  // the dark side, lit a little by the Earth
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(42, 51, 80, ${darkness.toFixed(3)})`;
  ctx.fill();
  // the lit part: the half disc on the Sun's side, then back along the terminator (x = -cos(phase angle) times the radius at the middle)
  ctx.beginPath();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / steps;
    const px = radius * Math.cos(t);
    const py = radius * Math.sin(t);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = steps; i >= 0; i--) {
    const t = -Math.PI / 2 + (Math.PI * i) / steps;
    ctx.lineTo(-cos * radius * Math.cos(t), radius * Math.sin(t));
  }
  ctx.closePath();
  ctx.fillStyle = "#f4f0dc";
  ctx.fill();
  ctx.restore();
}

/** Draw the Sun: a wide soft glow and a bright disc. */
export function drawSun(ctx: Context, x: number, y: number, radius: number): void {
  const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 6);
  glow.addColorStop(0, "rgba(255, 236, 170, 0.75)");
  glow.addColorStop(1, "rgba(255, 200, 120, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#fff8d8";
  ctx.fill();
}

/** A soft pale halo round the Moon, brighter the more of it is lit. */
export function drawMoonGlow(ctx: Context, x: number, y: number, radius: number, illuminated: number): void {
  const glow = ctx.createRadialGradient(x, y, radius, x, y, radius * 4.5);
  glow.addColorStop(0, `rgba(210, 225, 255, ${(0.08 + 0.3 * illuminated).toFixed(3)})`);
  glow.addColorStop(1, "rgba(210, 225, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 4.5, 0, Math.PI * 2);
  ctx.fill();
}

/** The dot of a planet: bigger the brighter it is (Venus about 4.5 pixels in radius, a magnitude 1 planet 2.2), with a faint glow. */
export function planetRadius(magnitude: number): number {
  return Math.max(1.8, Math.min(5, 2.6 + (-magnitude) * 0.55 + 0.4));
}

/** Draw one planet's dot. */
export function drawPlanet(ctx: Context, planet: PlanetInSky, x: number, y: number): void {
  const radius = planetRadius(planet.magnitude);
  const colour = PLANET_COLOURS[planet.id] ?? "#fff";
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.2);
  glow.addColorStop(0, colour);
  glow.addColorStop(0.3, `${colour}66`);
  glow.addColorStop(1, `${colour}00`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
}

/**
 * Write a text with a dark edge round it so it reads over stars and over the sky's light: the way the names in the sky are drawn.
 *
 * @param ctx - A 2D canvas context, its font, alignment and baseline already set.
 * @param text - The text.
 * @param x - Where it is drawn, by the context's alignment.
 * @param y - Its baseline.
 * @param fill - The colour of the letters.
 *
 * @example
 * ```ts no-run
 * import { halo } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * halo(document.createElement("canvas").getContext("2d")!, "Mars", 20, 20, "#fff");
 * ```
 */
export function halo(ctx: Context, text: string, x: number, y: number, fill: string): void {
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(4, 7, 18, 0.85)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/**
 * A thin white ring round a point: what a tap on a body draws.
 *
 * @param ctx - A 2D canvas context.
 * @param x - The ring's centre x.
 * @param y - The ring's centre y.
 * @param radius - Its radius in pixels.
 *
 * @example
 * ```ts no-run
 * import { ring } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * ring(document.createElement("canvas").getContext("2d")!, 50, 50, 20);
 * ```
 */
export function ring(ctx: Context, x: number, y: number, radius: number): void {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}
