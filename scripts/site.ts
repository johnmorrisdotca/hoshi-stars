// Builds the static demo for GitHub Pages into ./site: the page, the embed page, their styles and scripts. Every address in it is relative, so it works at the Pages address
// (https://johnmorrisdotca.github.io/hoshi-stars/) and anywhere else. `pnpm site` builds the package first.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { publishThumbnails, thumbnailHead } from "./family-thumbnail.mjs";
import { familyBoot, renderIndex } from "./page.ts";

/** What the family's card shows (scripts/images.ts makes it): the words of og:image:alt and of the README's top picture. */
const ALT = "Hoshi Stars: a sky chart of Orion with its constellation lines, on the soft band of the Milky Way.";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name: string; version: string };
rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });
writeFileSync(join(site, "index.html"), renderIndex().replace("</head>", `${thumbnailHead(pkg, { alt: ALT })}</head>`));
publishThumbnails(root, site);
writeFileSync(join(site, "family-boot.js"), familyBoot());
for (const file of ["embed.html", "demo.css", "family.css"]) cpSync(join(root, "demo", file), join(site, file));
await build({
  entryPoints: { demo: join(root, "demo", "demo.ts"), embed: join(root, "demo", "embed.ts") },
  outdir: join(site, "js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "none",
  define: { __HOSHI_VERSION__: JSON.stringify(pkg.version) },
  logLevel: "warning",
});
writeFileSync(join(site, "kazoku-parts.src.js"), `import "@johnmorrisdotca/kazoku-ui/language-picker/define";\nimport "@johnmorrisdotca/kazoku-ui/theme-switch/define";\n`);
await build({ entryPoints: [join(site, "kazoku-parts.src.js")], outfile: join(site, "kazoku-parts.js"), bundle: true, format: "esm", minify: true, logLevel: "warning", absWorkingDir: root });
rmSync(join(site, "kazoku-parts.src.js"));
writeFileSync(join(site, ".nojekyll"), "");
console.log("site/ is ready");
