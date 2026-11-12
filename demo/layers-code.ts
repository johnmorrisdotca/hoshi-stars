// The text that puts the sky out to a distance in a page, for each way a page is made. The package gives numbers, not pictures, so the code to copy reads `/distance` and draws the bright stars within the limit, each in the colour of its band,
// on a map of the whole sky (Hammer) as SVG; the live 3D view is the demo's, in an iframe (`embed-layers.html`). The tests run the module's lines against the package.
import { embedSnippet } from "@johnmorrisdotca/kazoku-ui/embed-panel";
import { layersByDistance, limitFromText, limitText, starInput } from "../src/distance.ts";
import { project } from "../src/projection.ts";
import { stars } from "../src/stars.ts";
import { fitScale } from "../src/chart/chart.ts";
import { BAND_COLOURS, UNCERTAIN_COLOUR } from "./distance-layers.ts";

declare const __HOSHI_VERSION__: string | undefined;

const PACKAGE = "@johnmorrisdotca/hoshi-stars";
const SITE = "https://johnmorrisdotca.github.io/hoshi-stars/";
const cdn = (): string => `https://cdn.jsdelivr.net/npm/${PACKAGE}@${typeof __HOSHI_VERSION__ === "string" ? __HOSHI_VERSION__ : "latest"}`;

/** The shape of the drawn map for a width: half as tall as wide, as the whole sky is. */
export const layersHeightFor = (width: number): number => Math.round(width / 2);

/** What the sky by distance is as a handful of choices: the limit in light-years (`Infinity` for all), how far it is turned and the language. */
export interface LayersChoice {
  limit: number;
  yaw: number;
  tilt: number;
  lang: "en" | "ja";
}

/** The query of the 3D embed page for a choice: only what differs from the defaults (100 light-years, no turn, English). */
export function layersQuery(choice: LayersChoice): string {
  const query = new URLSearchParams({ dist: limitText(choice.limit) });
  if (choice.yaw !== 0) query.set("yaw", String(choice.yaw));
  if (choice.tilt !== 0) query.set("tilt", String(choice.tilt));
  if (choice.lang === "ja") query.set("lang", "ja");
  return query.toString();
}

/** What the 3D embed page reads from its address, with every missing or bad part at its default. */
export function layersChoiceOf(query: URLSearchParams): LayersChoice {
  const number = (name: string, low: number, high: number): number => Math.max(low, Math.min(high, Number(query.get(name)) || 0));
  return { limit: limitFromText(query.get("dist")) ?? 100, yaw: number("yaw", -180, 180), tilt: number("tilt", -85, 85), lang: query.get("lang") === "ja" ? "ja" : "en" };
}

/** The address of the 3D embed page for a choice: `embed-layers.html?...` after `base`. */
export const layersFrameAddress = (base: string, choice: LayersChoice): string => `${base}embed-layers.html?${layersQuery(choice)}`;

/** The `iframe` way: the live 3D view at the size chosen. `preview` makes the address relative so the demo's own picture works; the copied code names the published demo. */
export function layersFrameCode(choice: LayersChoice, title: string, width: number, preview: boolean): string {
  return embedSnippet("iframe", { package: PACKAGE, cdn: cdn(), tag: "hoshi-distance", element: "", entries: [], attrs: [], name: "distance", iframe: { src: layersFrameAddress(preview ? "" : SITE, choice), title, width, height: Math.round(width * 0.75) } });
}

interface Import {
  names: string;
  sub: string;
}

/** What the map needs from the package and the lines that draw it, for `choice` at `width` pixels. */
export function layersLines(choice: LayersChoice, width: number): { imports: Import[]; body: string } {
  const height = layersHeightFor(width);
  const scale = Math.round(fitScale("hammer", width, height) * 100) / 100;
  const limit = Number.isFinite(choice.limit) ? String(choice.limit) : "Infinity";
  const imports: Import[] = [{ names: "stars", sub: "" }, { names: "layersByDistance, starInput", sub: "/distance" }, { names: "project", sub: "/projection" }];
  const body = [
    `function distanceSky() {`,
    `  // the bright stars out to ${Number.isFinite(choice.limit) ? `${choice.limit} light-years` : "any distance"}: each in the colour of its band; a star whose distance is uncertain is a ring; a star with no distance is left out`,
    `  const layers = layersByDistance(stars().map(starInput), { limit: ${limit} });`,
    `  const colours = ${JSON.stringify(BAND_COLOURS)};`,
    `  const view = { centre: { rightAscension: 180, declination: 0 }, scale: ${scale} };`,
    `  let svg = \`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#0b1020"/>\`;`,
    `  for (const thing of layers.things) {`,
    `    const at = project("hammer", thing, view);`,
    `    if (!at) continue;`,
    `    const x = (${width / 2} + at.x).toFixed(1);`,
    `    const y = (${height / 2} - at.y).toFixed(1);`,
    `    const r = Math.max(1.6, 6.8 - thing.magnitude).toFixed(1);`,
    `    svg += thing.uncertain ? \`<circle cx="\${x}" cy="\${y}" r="\${r}" fill="none" stroke="${UNCERTAIN_COLOUR}"/>\` : \`<circle cx="\${x}" cy="\${y}" r="\${r}" fill="\${colours[thing.band]}"/>\`;`,
    `  }`,
    `  return svg + "</svg>";`,
    `}`,
  ].join("\n");
  return { imports, body };
}

const importLines = (imports: Import[], from: (sub: string) => string): string => imports.map((one) => `import { ${one.names} } from "${from(one.sub)}";`).join("\n");

/**
 * The code for one of the family's ways a page is made: `html`, `module`, `react`, `vue`, `angular` or `svelte`. The `iframe` way is `layersFrameCode`.
 *
 * @param kind - The way.
 * @param choice - The sky.
 * @param width - The width in pixels.
 * @returns The text, or `undefined` for a way this file does not write.
 */
export function layersCode(kind: string, choice: LayersChoice, width: number): string | undefined {
  const { imports, body } = layersLines(choice, width);
  const from = (sub: string): string => `${PACKAGE}${sub}`;
  switch (kind) {
    case "html":
      return `<div id="sky"></div>\n<script type="module">\n  ${importLines(imports, (sub) => `${cdn()}${sub}/+esm`).replaceAll("\n", "\n  ")}\n\n  ${body.replaceAll("\n", "\n  ")}\n\n  document.getElementById("sky").innerHTML = distanceSky();\n</script>`;
    case "module":
      return `${importLines(imports, from)}\n\n${body}\n\nelement.innerHTML = distanceSky();`;
    case "react":
      return `${importLines(imports, from)}\n\n${body}\n\nexport function DistanceSky() {\n  return <div dangerouslySetInnerHTML={{ __html: distanceSky() }} />;\n}`;
    case "vue":
      return `<script setup>\n${importLines(imports, from)}\n\n${body}\n\nconst svg = distanceSky();\n</script>\n\n<template>\n  <div v-html="svg"></div>\n</template>`;
    case "angular":
      return `import { Component, inject } from "@angular/core";\nimport { DomSanitizer } from "@angular/platform-browser";\n${importLines(imports, from)}\n\n${body}\n\n@Component({\n  selector: "app-distance-sky",\n  standalone: true,\n  template: \`<div [innerHTML]="svg"></div>\`,\n})\nexport class DistanceSkyComponent {\n  svg = inject(DomSanitizer).bypassSecurityTrustHtml(distanceSky());\n}`;
    case "svelte":
      return `<script>\n  ${importLines(imports, from).replaceAll("\n", "\n  ")}\n\n  ${body.replaceAll("\n", "\n  ")}\n\n  const svg = distanceSky();\n</script>\n\n{@html svg}`;
    default:
      return undefined;
  }
}

/** The map the code to copy draws, made here for the panel's picture: the same lines run against the package. */
export function layersSvg(choice: LayersChoice, width: number): string {
  const height = layersHeightFor(width);
  const layers = layersByDistance(stars().map(starInput), { limit: choice.limit });
  const view = { centre: { rightAscension: 180, declination: 0 }, scale: Math.round(fitScale("hammer", width, height) * 100) / 100 };
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#0b1020"/>`;
  for (const thing of layers.things) {
    const at = project("hammer", thing, view);
    if (!at) continue;
    const x = (width / 2 + at.x).toFixed(1);
    const y = (height / 2 - at.y).toFixed(1);
    const r = Math.max(1.6, 6.8 - (thing.magnitude ?? 6)).toFixed(1);
    svg += thing.uncertain ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${UNCERTAIN_COLOUR}"/>` : `<circle cx="${x}" cy="${y}" r="${r}" fill="${BAND_COLOURS[thing.band]}"/>`;
  }
  return `${svg}</svg>`;
}
