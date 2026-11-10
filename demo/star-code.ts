// The text that puts one star's portrait, or the star next to the Sun, in a page, for each way a page is made; the embed page's address; and the iframe. The package gives numbers and SVG, not a 3D engine, so for the 3D
// star the code to copy draws its portrait (the still the 3D view stands on) and the live, turning star is the demo's, in an iframe (`star.html?view=3d`). The tests run the module's lines against the package.
import { embedSnippet } from "@johnmorrisdotca/kazoku-ui/embed-panel";

declare const __HOSHI_VERSION__: string | undefined;

const PACKAGE = "@johnmorrisdotca/hoshi-stars";
const SITE = "https://johnmorrisdotca.github.io/hoshi-stars/";
const cdn = (): string => `https://cdn.jsdelivr.net/npm/${PACKAGE}@${typeof __HOSHI_VERSION__ === "string" ? __HOSHI_VERSION__ : "latest"}`;

/** One star's picture: its Bright Star Catalogue number and name, which picture, the language, and the dark sky behind it or none. */
export interface StarChoice {
  hr: number;
  name: string;
  view: "portrait" | "3d" | "compare";
  lang: "en" | "ja";
}

/** The shape of the drawn picture for a width: a portrait with its captions is 1.2 times as tall as wide, a comparison 0.86, and the 3D star a square with 420 pixels of view controls, guide button, captions and scale under it. */
export const starHeightFor = (view: StarChoice["view"], width: number): number => (view === "3d" ? Math.round(width) + 420 : Math.round(width * (view === "portrait" ? 1.2 : 0.86)));

/** The lines that make the picture's SVG text, for `choice` at `width` pixels. */
export function starLines(choice: StarChoice, width: number): { imports: Array<{ names: string; sub: string }>; body: string } {
  const call = choice.view === "compare" ? "starComparison" : "starPortrait";
  const options = `{ name: ${JSON.stringify(choice.name)}, size: ${width}${choice.lang === "ja" ? ', lang: "ja"' : ""} }`;
  return {
    imports: [{ names: "starByHr", sub: "" }, { names: "starProfile", sub: "/profile" }, { names: call, sub: "/portrait" }],
    body: `function starPicture() {\n  const profile = starProfile(starByHr(${choice.hr}));\n  return ${call}(profile, ${options}) ?? "";\n}`,
  };
}

/** The code for one of the family's ways a page is made: `html`, `module`, `react`, `vue`, `angular` or `svelte`. The `iframe` way is `starFrameCode`. */
export function starCode(kind: string, choice: StarChoice, width: number): string | undefined {
  const { body, ...rest } = starLines(choice, width);
  const lines = (from: (sub: string) => string): string[] => rest.imports.map((one) => `import { ${one.names} } from "${from(one.sub)}";`);
  const cdnImports = lines((sub) => `${cdn()}${sub}/+esm`);
  const imports = lines((sub) => `${PACKAGE}${sub}`);
  switch (kind) {
    case "html":
      return `<div id="star"></div>\n<script type="module">\n  ${cdnImports.join("\n  ")}\n\n  ${body.replaceAll("\n", "\n  ")}\n\n  document.getElementById("star").innerHTML = starPicture();\n</script>`;
    case "module":
      return `${imports.join("\n")}\n\n${body}\n\nelement.innerHTML = starPicture();`;
    case "react":
      return `${imports.join("\n")}\n\n${body}\n\nexport function Star() {\n  return <div dangerouslySetInnerHTML={{ __html: starPicture() }} />;\n}`;
    case "vue":
      return `<script setup>\n${imports.join("\n")}\n\n${body}\n\nconst svg = starPicture();\n</script>\n\n<template>\n  <div v-html="svg"></div>\n</template>`;
    case "angular":
      return `import { Component, inject } from "@angular/core";\nimport { DomSanitizer } from "@angular/platform-browser";\n${imports.join("\n")}\n\n${body}\n\n@Component({\n  selector: "app-star",\n  standalone: true,\n  template: \`<div [innerHTML]="svg"></div>\`,\n})\nexport class StarComponent {\n  svg = inject(DomSanitizer).bypassSecurityTrustHtml(starPicture());\n}`;
    case "svelte":
      return `<script>\n  ${imports.join("\n  ")}\n\n  ${body.replaceAll("\n", "\n  ")}\n\n  const svg = starPicture();\n</script>\n\n{@html svg}`;
    default:
      return undefined;
  }
}

/** The query of the star embed page for a choice: `star=2061&view=3d&lang=ja` (the default portrait and English are left out). */
export function starQuery(choice: StarChoice): string {
  const query = new URLSearchParams({ star: String(choice.hr) });
  if (choice.view !== "portrait") query.set("view", choice.view);
  if (choice.lang === "ja") query.set("lang", "ja");
  return query.toString();
}

/** What the star embed page reads from its address, with every missing or bad part at its default. `undefined` where there is no usable star number. */
export function starChoiceOf(query: URLSearchParams, nameOf: (hr: number) => string | undefined): StarChoice | undefined {
  const hr = Number(query.get("star"));
  const name = Number.isInteger(hr) && hr > 0 ? nameOf(hr) : undefined;
  if (name === undefined) return undefined;
  const view = query.get("view");
  return { hr, name, view: view === "compare" || view === "3d" ? view : "portrait", lang: query.get("lang") === "ja" ? "ja" : "en" };
}

/** The `iframe` way: the star embed page at the size chosen. `preview` makes the address relative so the demo's own picture works; the copied code names the published demo. */
export function starFrameCode(choice: StarChoice, title: string, width: number, preview: boolean): string {
  const src = `${preview ? "" : SITE}star.html?${starQuery(choice)}`;
  return embedSnippet("iframe", { package: PACKAGE, cdn: cdn(), tag: "hoshi-star", element: "", entries: [], attrs: [], name: "star", iframe: { src, title, width, height: starHeightFor(choice.view, width) } });
}
