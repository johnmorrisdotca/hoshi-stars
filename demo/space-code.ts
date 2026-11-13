// The text that puts a constellation in space in a page. The package gives numbers, not pictures, so the code to copy reads `/constellation-3d` and draws the figure seen from the side (the Earth on the left, distance to the right, the
// sky sideways) as SVG, for every way a page is made; the live 3D view is the demo's, in an iframe (`embed-3d.html`). The tests run the module's lines against the package.
import { embedSnippet } from "@johnmorrisdotca/kazoku-ui/embed-panel";
import { constellationIn3D, type Point3, type StarIn3D } from "../src/constellation-3d.ts";
import type { NearbyStar } from "../src/nearby.ts";
import { starByHr, starColour, type Star } from "../src/stars.ts";
import { nearViewpointOf } from "./near-viewpoints.ts";

declare const __HOSHI_VERSION__: string | undefined;

const PACKAGE = "@johnmorrisdotca/hoshi-stars";
const SITE = "https://johnmorrisdotca.github.io/hoshi-stars/";
const cdn = (): string => `https://cdn.jsdelivr.net/npm/${PACKAGE}@${typeof __HOSHI_VERSION__ === "string" ? __HOSHI_VERSION__ : "latest"}`;

/** The shape of the drawn side view for a width: three to four. */
export const spaceHeightFor = (width: number): number => Math.round((width * 3) / 4);

/** What a constellation in space is as a handful of choices, and how they are written into an address. */
export interface SpaceChoice {
  /** The IAU abbreviation. */
  c: string;
  /** The star the figure is seen from: a Bright Star Catalogue number, or the text of a nearby star an address writes (`GCTP3278`, Proxima Centauri); left out for the Earth. */
  from: number | string | undefined;
  yaw: number;
  tilt: number;
  lang: "en" | "ja";
}

/** The query of the embed page for a choice: only what differs from the defaults (Orion, from the Earth, no turn, English). */
export function spaceQuery(choice: SpaceChoice): string {
  const query = new URLSearchParams();
  query.set("c", choice.c);
  if (choice.from !== undefined) query.set("from", typeof choice.from === "number" ? `HR${choice.from}` : choice.from);
  if (choice.yaw !== 0) query.set("yaw", String(choice.yaw));
  if (choice.tilt !== 0) query.set("tilt", String(choice.tilt));
  if (choice.lang === "ja") query.set("lang", "ja");
  return query.toString();
}

/** The address of the 3D embed page for a choice: `embed-3d.html?...` after `base`. */
export const spaceFrameAddress = (base: string, choice: SpaceChoice): string => `${base}embed-3d.html?${spaceQuery(choice)}`;

/** The `iframe` way: the live 3D view at the size chosen. `preview` makes the address relative so the demo's own picture works; the copied code names the published demo. */
export function frameCode(choice: SpaceChoice, title: string, width: number, preview: boolean): string {
  return embedSnippet("iframe", { package: PACKAGE, cdn: cdn(), tag: "hoshi-space", element: "", entries: [], attrs: [], name: "space", iframe: { src: spaceFrameAddress(preview ? "" : SITE, choice), title, width, height: spaceHeightFor(width) } });
}

interface Import {
  names: string;
  sub: string;
}

/** What the side view needs from the package and the lines that draw it, for `choice` at `width` pixels. */
export function spaceLines(choice: SpaceChoice, width: number): { imports: Import[]; body: string } {
  const height = spaceHeightFor(width);
  const from = choice.from !== undefined;
  const near = typeof choice.from === "string" ? nearViewpointOf(choice.from) : undefined;
  const imports: Import[] = [{ names: from && near === undefined ? "starByHr, starColour" : "starColour", sub: "" }, { names: "constellationIn3D", sub: "/constellation-3d" }];
  if (near !== undefined) imports.push({ names: "nearbyStarByName", sub: "/nearby" });
  const body = [
    `function spaceView() {`,
    `  const figure = constellationIn3D(${JSON.stringify(choice.c)}${near !== undefined ? `, { from: nearbyStarByName(${JSON.stringify(near.query)}) }` : from ? `, { from: starByHr(${choice.from}) }` : ""});`,
    `  const { centre, up } = figure.frame;`,
    `  const side = [centre[1] * up[2] - centre[2] * up[1], centre[2] * up[0] - centre[0] * up[2], centre[0] * up[1] - centre[1] * up[0]];`,
    `  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];`,
    `  const along = (star, t) => star.sight.origin.map((o, i) => o + star.sight.direction[i] * t);`,
    `  // a range with no end, or a long one, is shown to three times the best distance`,
    `  const farOf = (star) => Math.min(star.sight.far, star.sight.best * 3);`,
    `  const placed = figure.stars.filter((star) => star.position);`,
    `  const reach = Math.max(10, ...placed.map((star) => dot(along(star, star.range ? farOf(star) : star.sight.best), centre)));`,
    `  const k = (${width} - 60) / reach;`,
    `  const x = (p) => 30 + dot(p, centre) * k;`,
    `  const y = (p) => ${height / 2} - dot(p, side) * k;`,
    `  let svg = \`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#0b1020"/>\`;`,
    `  svg += \`<line x1="30" y1="${height / 2}" x2="\${30 + reach * k}" y2="${height / 2}" stroke="#46578c" stroke-width="1"/>\`;`,
    `  for (const [a, b] of figure.segments) {`,
    `    const from = figure.stars[a].position;`,
    `    const to = figure.stars[b].position;`,
    `    if (from && to) svg += \`<line x1="\${x(from).toFixed(1)}" y1="\${y(from).toFixed(1)}" x2="\${x(to).toFixed(1)}" y2="\${y(to).toFixed(1)}" stroke="#6f93e0" stroke-opacity=".6"/>\`;`,
    `  }`,
    `  for (const star of figure.stars) {`,
    `    const colour = starColour(star.star);`,
    `    if (!star.position) {`,
    `      // no distance: the line of sight only, never a guess`,
    `      const end = along(star, reach);`,
    `      svg += \`<line x1="\${x(star.sight.origin).toFixed(1)}" y1="\${y(star.sight.origin).toFixed(1)}" x2="\${x(end).toFixed(1)}" y2="\${y(end).toFixed(1)}" stroke="\${colour}" stroke-dasharray="2 4" stroke-opacity=".7"/>\`;`,
    `      continue;`,
    `    }`,
    `    if (star.range) {`,
    `      const near = along(star, star.sight.near);`,
    `      const far = along(star, farOf(star));`,
    `      svg += \`<line x1="\${x(near).toFixed(1)}" y1="\${y(near).toFixed(1)}" x2="\${x(far).toFixed(1)}" y2="\${y(far).toFixed(1)}" stroke="\${colour}" stroke-opacity="\${star.wide ? 0.35 : 0.9}" stroke-width="\${star.wide ? 5 : 1.5}"/>\`;`,
    `    }`,
    `    // a star whose error bar is wider than its distance has no dot: it could be anywhere along its range`,
    `    if (!star.wide) svg += \`<circle cx="\${x(star.position).toFixed(1)}" cy="\${y(star.position).toFixed(1)}" r="\${Math.max(2, 5 - star.star.magnitude).toFixed(1)}" fill="\${colour}"/>\`;`,
    `  }`,
    `  return svg + "</svg>";`,
    `}`,
  ];
  return { imports, body: body.join("\n") };
}

const importLines = (imports: Import[], from: (sub: string) => string): string => imports.map((one) => `import { ${one.names} } from "${from(one.sub)}";`).join("\n");

/**
 * The code for one of the family's ways a page is made: `html`, `module`, `react`, `vue`, `angular` or `svelte`. The `iframe` way is `frameCode`.
 *
 * @param kind - The way.
 * @param choice - The constellation, and the star it is seen from.
 * @param width - The width in pixels.
 * @returns The text, or `undefined` for a way this file does not write.
 */
export function spaceCode(kind: string, choice: SpaceChoice, width: number): string | undefined {
  const { imports, body } = spaceLines(choice, width);
  const from = (sub: string): string => `${PACKAGE}${sub}`;
  switch (kind) {
    case "html":
      return `<div id="space"></div>\n<script type="module">\n  ${importLines(imports, (sub) => `${cdn()}${sub}/+esm`).replaceAll("\n", "\n  ")}\n\n  ${body.replaceAll("\n", "\n  ")}\n\n  document.getElementById("space").innerHTML = spaceView();\n</script>`;
    case "module":
      return `${importLines(imports, from)}\n\n${body}\n\nelement.innerHTML = spaceView();`;
    case "react":
      return `${importLines(imports, from)}\n\n${body}\n\nexport function Space() {\n  return <div dangerouslySetInnerHTML={{ __html: spaceView() }} />;\n}`;
    case "vue":
      return `<script setup>\n${importLines(imports, from)}\n\n${body}\n\nconst svg = spaceView();\n</script>\n\n<template>\n  <div v-html="svg"></div>\n</template>`;
    case "angular":
      return `import { Component, inject } from "@angular/core";\nimport { DomSanitizer } from "@angular/platform-browser";\n${importLines(imports, from)}\n\n${body}\n\n@Component({\n  selector: "app-space",\n  standalone: true,\n  template: \`<div [innerHTML]="svg"></div>\`,\n})\nexport class SpaceComponent {\n  svg = inject(DomSanitizer).bypassSecurityTrustHtml(spaceView());\n}`;
    case "svelte":
      return `<script>\n  ${importLines(imports, from).replaceAll("\n", "\n  ")}\n\n  ${body.replaceAll("\n", "\n  ")}\n\n  const svg = spaceView();\n</script>\n\n{@html svg}`;
    default:
      return undefined;
  }
}

/**
 * The side view the copied code makes, drawn by this file's own lines (the page's content policy forbids running the text), for the demo's preview. A test runs the copied lines against the package and
 * holds the two pictures equal.
 *
 * @param choice - The constellation and the star it is seen from.
 * @param width - The width in pixels.
 * @param seenFrom - The star `choice.from` names, when it is a nearby star: the page loads the nearby table only for it, so it is handed in here. A bright star is found from its number.
 * @returns The SVG text.
 */
export function spaceSvg(choice: SpaceChoice, width: number, seenFrom?: Star | NearbyStar): string {
  const height = spaceHeightFor(width);
  const from = seenFrom ?? (typeof choice.from === "number" ? starByHr(choice.from) : undefined);
  const figure = constellationIn3D(choice.c, from === undefined ? {} : { from });
  const { centre, up } = figure.frame;
  const side = [centre[1] * up[2] - centre[2] * up[1], centre[2] * up[0] - centre[0] * up[2], centre[0] * up[1] - centre[1] * up[0]] as const;
  const dot = (a: readonly number[], b: readonly number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const along = (star: StarIn3D, t: number): Point3 => [star.sight.origin[0] + star.sight.direction[0] * t, star.sight.origin[1] + star.sight.direction[1] * t, star.sight.origin[2] + star.sight.direction[2] * t];
  const farOf = (star: StarIn3D): number => Math.min(star.sight.far!, star.sight.best! * 3);
  const placed = figure.stars.filter((star) => star.position !== undefined);
  const reach = Math.max(10, ...placed.map((star) => dot(along(star, star.range !== undefined ? farOf(star) : star.sight.best!), centre)));
  const k = (width - 60) / reach;
  const x = (p: Point3): number => 30 + dot(p, centre) * k;
  const y = (p: Point3): number => height / 2 - dot(p, side) * k;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#0b1020"/>`;
  svg += `<line x1="30" y1="${height / 2}" x2="${30 + reach * k}" y2="${height / 2}" stroke="#46578c" stroke-width="1"/>`;
  for (const [a, b] of figure.segments) {
    const from = figure.stars[a]!.position;
    const to = figure.stars[b]!.position;
    if (from !== undefined && to !== undefined) svg += `<line x1="${x(from).toFixed(1)}" y1="${y(from).toFixed(1)}" x2="${x(to).toFixed(1)}" y2="${y(to).toFixed(1)}" stroke="#6f93e0" stroke-opacity=".6"/>`;
  }
  for (const star of figure.stars) {
    const colour = starColour(star.star);
    if (star.position === undefined) {
      const end = along(star, reach);
      svg += `<line x1="${x(star.sight.origin).toFixed(1)}" y1="${y(star.sight.origin).toFixed(1)}" x2="${x(end).toFixed(1)}" y2="${y(end).toFixed(1)}" stroke="${colour}" stroke-dasharray="2 4" stroke-opacity=".7"/>`;
      continue;
    }
    if (star.range !== undefined) {
      const near = along(star, star.sight.near!);
      const far = along(star, farOf(star));
      svg += `<line x1="${x(near).toFixed(1)}" y1="${y(near).toFixed(1)}" x2="${x(far).toFixed(1)}" y2="${y(far).toFixed(1)}" stroke="${colour}" stroke-opacity="${star.wide ? 0.35 : 0.9}" stroke-width="${star.wide ? 5 : 1.5}"/>`;
    }
    if (!star.wide) svg += `<circle cx="${x(star.position).toFixed(1)}" cy="${y(star.position).toFixed(1)}" r="${Math.max(2, 5 - star.star.magnitude).toFixed(1)}" fill="${colour}"/>`;
  }
  return svg + "</svg>";
}
