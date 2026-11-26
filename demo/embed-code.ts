// The text that puts a star chart in a page, for each way a page is made. The package gives numbers, not pictures, so every way ends in the same few lines: the Milky Way's bands, the stars and the constellation
// lines, projected with `/projection` and written as SVG. The tests run the module's lines and compare their stars with the chart the demo draws.
import { embedSnippet } from "@johnmorrisdotca/kazoku-ui/embed-panel";
import { fitScale, growOf } from "../src/chart/chart.ts";
import { frameQuery, type Choice } from "./choice.ts";
import { BAND_COLOURS, UNCERTAIN_COLOUR } from "./distance-layers.ts";

declare const __HOSHI_VERSION__: string | undefined;

const PACKAGE = "@johnmorrisdotca/hoshi-stars";
const SITE = "https://johnmorrisdotca.github.io/hoshi-stars/";
const cdn = (): string => `https://cdn.jsdelivr.net/npm/${PACKAGE}@${typeof __HOSHI_VERSION__ === "string" ? __HOSHI_VERSION__ : "latest"}`;

/** The shape of the drawn chart for a width: three to four. */
export const heightFor = (width: number): number => Math.round((width * 3) / 4);

interface Import {
  names: string;
  sub: string;
}

/** The Milky Way, under the stars: the same ribbons, fills and blur as the chart, for a map of one side of the sky. */
function milkyLines(choice: Choice, width: number, height: number): string[] {
  const aside = choice.dec > 89 ? choice.dec - 1 : choice.dec + 1;
  const levels = JSON.stringify([0.04, 0.08, 0.13, 0.2, 0.3, 0.42, 0.58, 0.76]);
  const fills = JSON.stringify(["#6a80c8", "#7a90d2", "#8da1dc", "#a6b6e6", "#c3cdee", "#e0e4f2", "#f7eedd", "#fff3d8"]);
  const opacities = JSON.stringify([0.16, 0.14, 0.14, 0.14, 0.15, 0.16, 0.18, 0.2]);
  return [
    `  {`,
    `    const bands = milkyWayBands(${levels}, { step: ${choice.zoom >= 1.8 ? 1 : 2} });`,
    `    const fills = ${fills};`,
    `    const opacities = ${opacities};`,
    `    const here = place({ rightAscension: ${choice.ra}, declination: ${choice.dec} });`,
    `    const aside = place({ rightAscension: ${choice.ra}, declination: ${aside} });`,
    `    const perDegree = here && aside ? Math.hypot(here[0] - aside[0], here[1] - aside[1]) : 4;`,
    `    const blur = Math.max(1.2, Math.min(16, perDegree * 0.9));`,
    `    const margin = 60 + blur * 3;`,
    `    let glow = "";`,
    `    bands.forEach((band, i) => {`,
    `      let d = "";`,
    `      for (const strip of band.strips) {`,
    `        const upper = strip.upper.map(place);`,
    `        const lower = strip.lower.map(place);`,
    `        let run = [];`,
    `        const flush = () => {`,
    `          if (run.length >= 2) {`,
    `            const points = [...run.map((k) => upper[k]), ...run.slice().reverse().map((k) => lower[k])];`,
    `            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;`,
    `            for (const [x, y] of points) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }`,
    `            if (x1 >= -margin && x0 <= ${width} + margin && y1 >= -margin && y0 <= ${height} + margin) d += "M" + points.map(([x, y]) => x.toFixed(1) + " " + y.toFixed(1)).join("L") + "Z";`,
    `          }`,
    `          run = [];`,
    `        };`,
    `        for (let k = 0; k < upper.length; k += 1) upper[k] === undefined || lower[k] === undefined ? flush() : run.push(k);`,
    `        flush();`,
    `      }`,
    `      if (d !== "") glow += '<path d="' + d + '" fill="' + fills[i] + '" fill-opacity="' + opacities[i] + '"/>';`,
    `    });`,
    `    svg += '<defs><filter id="hoshi-milky-blur" filterUnits="userSpaceOnUse" x="-30" y="-30" width="${width + 60}" height="${height + 60}"><feGaussianBlur stdDeviation="' + blur.toFixed(1) + '"/></filter></defs><g data-layer="milky" filter="url(#hoshi-milky-blur)">' + glow + "</g>";`,
    `  }`,
  ];
}

/** What the chart needs from the package and the lines that draw it, for `choice` at `width` pixels. */
export function chartLines(choice: Choice, width: number): { imports: Import[]; body: string } {
  const height = heightFor(width);
  const withLines = choice.layers.has("lines");
  const withMilky = choice.layers.has("milky");
  // a limit in light-years: the bright stars within it, each in the colour of its band, an uncertain one as a ring (the demo adds the nearby stars and the galaxies, which are separate tables)
  const layered = choice.limit !== undefined && choice.from === undefined;
  const hr = choice.from === undefined ? undefined : Number(choice.from.slice(2));
  const culture = choice.cultureId === "japanese" || choice.cultureId === "chinese" ? choice.cultureId : undefined;
  const filtered = choice.filter !== undefined && !layered;
  const imports: Import[] = [
    hr === undefined ? { names: layered ? "stars" : filtered ? "starColour, starDistance, stars" : "starColour, stars", sub: "" } : { names: "blackBodyColour, starByHr, starTemperatureK", sub: "" },
    ...(layered ? [{ names: "layersByDistance, starInput", sub: "/distance" }] : []),
    ...(hr === undefined ? [] : [{ names: "skyFrom", sub: "/sky-from" }]),
    ...(filtered ? [{ names: "starPasses", sub: "/star-filter" }] : []),
    ...(withMilky ? [{ names: "milkyWayBands", sub: "/milky-way" }] : []),
    ...(withLines ? [{ names: "figures", sub: "/lines" }] : []),
    ...(withLines && culture !== undefined ? [{ names: culture, sub: `/cultures/${culture}` }] : []),
    { names: "project", sub: "/projection" },
  ];
  const scale = Math.round(fitScale(choice.projection, width, height) * choice.zoom * 100) / 100;
  const lines = [
    `function skyChart() {`,
    ...(hr === undefined ? [] : [`  const sky = skyFrom(starByHr(${hr}), { magnitude: ${choice.magnitude} });`, `  const seen = new Map(sky.map((star) => [star.id, star]));`]),
    ...(filtered ? [`  const filter = ${JSON.stringify(choice.filter)};`] : []),
    `  const view = { centre: { rightAscension: ${choice.ra.toFixed(2)}, declination: ${choice.dec.toFixed(2)} }, scale: ${scale} };`,
    `  const place = (point) => {`,
    `    const at = project("${choice.projection}", point, view);`,
    `    return at && [${width / 2} + at.x, ${height / 2} - at.y];`,
    `  };`,
    `  let svg = \`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#0b1020"/>\`;`,
    ...(withMilky ? milkyLines(choice, width, height) : []),
    ...(withLines
      ? [
          `  let d = "";`,
          `  for (const { segments } of figures(${culture ?? ""})) {`,
          `    for (const [a, b] of segments) {`,
          ...(hr === undefined ? [`      const from = place(a);`, `      const to = place(b);`] : [`      const from = seen.has(\`hr-\${a.hr}\`) && place(seen.get(\`hr-\${a.hr}\`));`, `      const to = seen.has(\`hr-\${b.hr}\`) && place(seen.get(\`hr-\${b.hr}\`));`]),
          `      if (from && to && Math.hypot(to[0] - from[0], to[1] - from[1]) < ${width / 2}) d += \`M\${from[0].toFixed(1)} \${from[1].toFixed(1)}L\${to[0].toFixed(1)} \${to[1].toFixed(1)}\`;`,
          `    }`,
          `  }`,
          `  svg += \`<path d="\${d}" fill="none" stroke="#6f93e0" stroke-width="1.2" stroke-opacity=".8"/>\`;`,
        ]
      : []),
    ...(layered
      ? [
          `  const layers = layersByDistance(stars().map(starInput), { limit: ${Number.isFinite(choice.limit!) ? choice.limit : "Infinity"} });`,
          `  const colours = ${JSON.stringify(BAND_COLOURS)};`,
          `  for (const thing of layers.things) {`,
          `    const at = place(thing);`,
          `    const r = (Math.max(1.8, (6 - Math.max(thing.magnitude, -2)) * 0.5 + 1.3) * ${growOf(choice.zoom)}).toFixed(1);`,
          `    if (at) svg += thing.uncertain ? \`<circle cx="\${at[0].toFixed(1)}" cy="\${at[1].toFixed(1)}" r="\${(Number(r) + 1).toFixed(1)}" fill="none" stroke="${UNCERTAIN_COLOUR}"/>\` : \`<circle cx="\${at[0].toFixed(1)}" cy="\${at[1].toFixed(1)}" r="\${r}" fill="\${colours[thing.band]}"/>\`;`,
          `  }`,
        ]
      : hr === undefined
      ? [
          `  for (const star of stars({ magnitude: ${choice.magnitude} })) {`,
          ...(filtered ? [`    if (!starPasses(filter, star.magnitude, starDistance(star)?.lightYears)) continue;`] : []),
          `    const at = place(star);`,
          `    if (at) svg += \`<circle cx="\${at[0].toFixed(1)}" cy="\${at[1].toFixed(1)}" r="\${(Math.max(0.7, (${choice.magnitude} - star.magnitude) * 0.55 + 1.1) * ${growOf(choice.zoom)}).toFixed(1)}" fill="\${starColour(star)}"/>\`;`,
          `  }`,
        ]
      : [
          `  for (const star of sky) {`,
          ...(filtered ? [`    if (!starPasses(filter, star.magnitude, star.lightYears)) continue;`] : []),
          `    const at = place(star);`,
          `    const colour = star.colourIndex === undefined ? "#ffffff" : blackBodyColour(starTemperatureK(star.colourIndex));`,
          `    if (at) svg += \`<circle cx="\${at[0].toFixed(1)}" cy="\${at[1].toFixed(1)}" r="\${(Math.max(0.7, (${choice.magnitude} - Math.max(star.magnitude, -2)) * 0.55 + 1.1) * ${growOf(choice.zoom)}).toFixed(1)}" fill="\${colour}"/>\`;`,
          `  }`,
        ]),
    `  return svg + "</svg>";`,
    `}`,
  ];
  return { imports, body: lines.join("\n") };
}

const importLines = (imports: Import[], from: (sub: string) => string): string => imports.map((one) => `import { ${one.names} } from "${from(one.sub)}";`).join("\n");

/**
 * The code for one of the family's ways a page is made: `html`, `module`, `react`, `vue`, `angular` or `svelte`. The `iframe` way is `frameCode`.
 *
 * @param kind - The way.
 * @param choice - The chart.
 * @param width - The width in pixels.
 * @returns The text, or `undefined` for a way this file does not write.
 */
export function embedCode(kind: string, choice: Choice, width: number): string | undefined {
  const { imports, body } = chartLines(choice, width);
  const from = (sub: string): string => `${PACKAGE}${sub}`;
  switch (kind) {
    case "html":
      return `<div id="sky"></div>\n<script type="module">\n  ${importLines(imports, (sub) => `${cdn()}${sub}/+esm`).replaceAll("\n", "\n  ")}\n\n  ${body.replaceAll("\n", "\n  ")}\n\n  document.getElementById("sky").innerHTML = skyChart();\n</script>`;
    case "module":
      return `${importLines(imports, from)}\n\n${body}\n\nelement.innerHTML = skyChart();`;
    case "react":
      return `${importLines(imports, from)}\n\n${body}\n\nexport function Sky() {\n  return <div dangerouslySetInnerHTML={{ __html: skyChart() }} />;\n}`;
    case "vue":
      return `<script setup>\n${importLines(imports, from)}\n\n${body}\n\nconst svg = skyChart();\n</script>\n\n<template>\n  <div v-html="svg"></div>\n</template>`;
    case "angular":
      return `import { Component, inject } from "@angular/core";\nimport { DomSanitizer } from "@angular/platform-browser";\n${importLines(imports, from)}\n\n${body}\n\n@Component({\n  selector: "app-sky",\n  standalone: true,\n  template: \`<div [innerHTML]="svg"></div>\`,\n})\nexport class SkyComponent {\n  svg = inject(DomSanitizer).bypassSecurityTrustHtml(skyChart());\n}`;
    case "svelte":
      return `<script>\n  ${importLines(imports, from).replaceAll("\n", "\n  ")}\n\n  ${body.replaceAll("\n", "\n  ")}\n\n  const svg = skyChart();\n</script>\n\n{@html svg}`;
    default:
      return undefined;
  }
}

/** The address of the embed page for a choice: `embed.html?...` after `base`. */
export const frameAddress = (base: string, choice: Choice): string => `${base}embed.html?${frameQuery(choice)}`;

/** The `iframe` way: the embed page at the size chosen. `preview` makes the address relative so the demo's own picture works; the copied code names the published demo. */
export function frameCode(choice: Choice, title: string, width: number, preview: boolean): string {
  return embedSnippet("iframe", { package: PACKAGE, cdn: cdn(), tag: "hoshi-sky", element: "", entries: [], attrs: [], name: "sky", iframe: { src: frameAddress(preview ? "" : SITE, choice), title, width, height: heightFor(width) } });
}
