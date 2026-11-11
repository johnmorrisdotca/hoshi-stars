// The names on the brightest stars and the faint constellation lines of the package's `sky-labels` tier, as SVG for the chart: the lines go under the stars, the names over them.
import type { FigureLines, StarNames } from "../src/sky-labels.ts";
import { LABEL_STYLE_PROPERTIES, type LabelStyle } from "../src/sky-labels.ts";

const round = (n: number): string => n.toFixed(1);
/** Text made safe for markup, in an element or in an attribute value written between quotes: every character that could end either is escaped. */
export const escapeXml = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const LINE_COLOUR = "#6f93e0";

/** The parts of the look that the address (`label-size=14`) or the page's own CSS custom properties (`--hoshi-label-size`) set, and no others: a part of neither is left to the chosen look and then to the package's default. */
export function lookOf(element: Element, query: URLSearchParams): Partial<LabelStyle> {
  const computed = getComputedStyle(element);
  const out: Record<string, string> = {};
  for (const [part, property] of Object.entries(LABEL_STYLE_PROPERTIES)) {
    const value = (query.get(property.replace(/^--hoshi-/, "")) ?? computed.getPropertyValue(property)).trim();
    if (value !== "") out[part] = value;
  }
  return out as unknown as Partial<LabelStyle>;
}

/** The address parts that set the look: `label-size=14`, `label-case=upper` and one for each part in `LABEL_STYLE_PROPERTIES`. */
export const LOOK_KEYS: readonly string[] = Object.values(LABEL_STYLE_PROPERTIES).map((name) => name.replace(/^--hoshi-/, ""));

const textAttributes = (style: Readonly<LabelStyle>): string =>
  `font-family="${escapeXml(style.font)}" font-size="${style.size}" font-weight="${style.weight}" letter-spacing="${style.letterSpacing}em"${style.case === "small-caps" ? ' font-variant="small-caps"' : ""} fill="${escapeXml(style.colour)}"` +
  (style.halo === "none" || style.haloWidth === 0 ? "" : ` stroke="${escapeXml(style.halo)}" stroke-width="${style.haloWidth}" stroke-linejoin="round" paint-order="stroke"`);

const halo = (style: Readonly<LabelStyle>): string => (style.halo === "none" || style.haloWidth === 0 ? "" : ` stroke="${escapeXml(style.halo)}" stroke-width="${style.haloWidth}" stroke-linejoin="round" paint-order="stroke"`);

/** The figures' lines: every figure at the strength, the picked one at full strength and its name beside it. */
export function figureLinesSvg(lines: FigureLines): string {
  if (lines.settings.strength === 0 || lines.count === 0) return "";
  let faint = "";
  let picked = "";
  let pickedId = "";
  for (const figure of lines.figures) {
    if (figure.end === figure.start) continue;
    const on = lines.opacityOf(figure) === 1;
    let d = "";
    for (let s = figure.start; s < figure.end; s += 1) d += `M${round(lines.segments[s * 4]!)} ${round(lines.segments[s * 4 + 1]!)}L${round(lines.segments[s * 4 + 2]!)} ${round(lines.segments[s * 4 + 3]!)}`;
    if (on) {
      picked = d;
      pickedId = figure.abbreviation;
    } else faint += d;
  }
  let svg = `<path data-faint-lines d="${faint}" fill="none" stroke="${LINE_COLOUR}" stroke-width="1.2" stroke-opacity="${lines.settings.strength}"/>`;
  if (pickedId !== "") svg += `<path data-figure-picked="${escapeXml(pickedId)}" d="${picked}" fill="none" stroke="${LINE_COLOUR}" stroke-width="1.6" stroke-opacity="1"/>`;
  return `<g pointer-events="none">${svg}</g>`;
}

/** The picked figure's name, in the look of the names. */
export function figureNameSvg(lines: FigureLines): string {
  const name = lines.name;
  return name === undefined ? "" : `<text data-figure-name x="${round(name.x)}" y="${round(name.y)}" text-anchor="middle" ${textAttributes(lines.style)}>${escapeXml(name.text)}</text>`;
}

/** The stars' names, each with its short line where the look has one. */
export function starNamesSvg(names: StarNames): string {
  let svg = "";
  for (const label of names.labels) {
    if (label.leader) svg += `<line data-star-name-leader x1="${round(label.leaderX0)}" y1="${round(label.leaderY0)}" x2="${round(label.leaderX1)}" y2="${round(label.leaderY1)}" stroke="${escapeXml(names.style.leaderColour)}" stroke-width="1"/>`;
    if (label.ring > 0) svg += `<circle data-star-name-ring cx="${round(label.x)}" cy="${round(label.y)}" r="${label.ring}" fill="none" stroke="${escapeXml(names.style.ringColour)}" stroke-width="${names.style.ringWidth}"/>`;
    svg += `<text data-star-name="${escapeXml(String(label.hr))}" x="${round(label.textX)}" y="${round(label.textY)}" text-anchor="${label.anchor}" ${textAttributes(names.style)}>${escapeXml(label.text)}</text>`;
    if (label.designation !== "") svg += `<text data-star-designation x="${round(label.designationX)}" y="${round(label.designationY)}" text-anchor="${label.anchor}" font-family="${escapeXml(names.style.designationFont)}" font-size="${names.style.designationSize}" fill="${escapeXml(names.style.designationColour)}"${halo(names.style)}>${escapeXml(label.designation)}</text>`;
  }
  return svg === "" ? "" : `<g pointer-events="none">${svg}</g>`;
}
