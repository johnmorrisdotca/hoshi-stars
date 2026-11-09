// The text that puts a star chart in a page, for each way a page is made. The package gives numbers, not pictures, so every way ends in the same few lines: the stars and the constellation
// lines, projected with `/projection` and written as SVG. The tests run the module's lines and compare their stars with the chart the demo draws.
import { embedSnippet } from "@johnmorrisdotca/kazoku-ui/embed-panel";
import { fitScale, growOf } from "../src/chart/draw.ts";
import { frameQuery, type Choice } from "./choice.ts";

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

/** What the chart needs from the package and the lines that draw it, for `choice` at `width` pixels. */
export function chartLines(choice: Choice, width: number): { imports: Import[]; body: string } {
  const height = heightFor(width);
  const withLines = choice.layers.has("lines");
  const imports: Import[] = [{ names: "starColour, stars", sub: "" }, ...(withLines ? [{ names: "figures", sub: "/lines" }] : []), { names: "project", sub: "/projection" }];
  const scale = Math.round(fitScale(choice.projection, width, height) * choice.zoom * 100) / 100;
  const lines = [
    `function skyChart() {`,
    `  const view = { centre: { rightAscension: ${choice.ra.toFixed(2)}, declination: ${choice.dec.toFixed(2)} }, scale: ${scale} };`,
    `  const place = (point) => {`,
    `    const at = project("${choice.projection}", point, view);`,
    `    return at && [${width / 2} + at.x, ${height / 2} - at.y];`,
    `  };`,
    `  let svg = \`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#0b1020"/>\`;`,
    ...(withLines
      ? [
          `  let d = "";`,
          `  for (const { segments } of figures()) {`,
          `    for (const [a, b] of segments) {`,
          `      const from = place(a);`,
          `      const to = place(b);`,
          `      if (from && to && Math.hypot(to[0] - from[0], to[1] - from[1]) < ${width / 2}) d += \`M\${from[0].toFixed(1)} \${from[1].toFixed(1)}L\${to[0].toFixed(1)} \${to[1].toFixed(1)}\`;`,
          `    }`,
          `  }`,
          `  svg += \`<path d="\${d}" fill="none" stroke="#6f93e0" stroke-width="1.2" stroke-opacity=".8"/>\`;`,
        ]
      : []),
    `  for (const star of stars({ magnitude: ${choice.magnitude} })) {`,
    `    const at = place(star);`,
    `    if (at) svg += \`<circle cx="\${at[0].toFixed(1)}" cy="\${at[1].toFixed(1)}" r="\${(Math.max(0.7, (${choice.magnitude} - star.magnitude) * 0.55 + 1.1) * ${growOf(choice.zoom)}).toFixed(1)}" fill="\${starColour(star)}"/>\`;`,
    `  }`,
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
