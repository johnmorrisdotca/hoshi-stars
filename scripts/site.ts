// Builds the static demo for GitHub Pages into ./site: the page, the embed page, their styles and scripts. Every address in it is relative, so it works at the Pages address
// (https://johnmorrisdotca.github.io/hoshi-stars/) and anywhere else. `pnpm site` builds the package first.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { publishThumbnails, thumbnailHead } from "./family-thumbnail.mjs";
import { familyBoot, renderConstellationPage, renderIndex, renderKids, renderLayers, renderSpace, renderTonight } from "./page.ts";
import { chinese } from "../src/cultures/chinese.ts";
import { japanese } from "../src/cultures/japanese.ts";
import { writeCultureThumbnails, writeThumbnails } from "./thumbnail-files.ts";

/** What the family's card shows (scripts/images.ts makes it): the words of og:image:alt and of the README's top picture. */
const ALT = "Hoshi Stars: a sky chart of Orion with its constellation lines, on the soft band of the Milky Way.";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name: string; version: string };
rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });
writeFileSync(join(site, "index.html"), renderIndex().replace("</head>", `${thumbnailHead(pkg, { alt: ALT })}</head>`));
publishThumbnails(root, site);
writeFileSync(join(site, "kids.html"), renderKids());
writeFileSync(join(site, "tonight.html"), renderTonight());
writeFileSync(join(site, "constellations.html"), renderConstellationPage("gallery.html", "gl_title", "gl_description", "gallery"));
writeFileSync(join(site, "constellation.html"), renderConstellationPage("constellation.html", "cp_title", "cp_description", "constellation"));
writeFileSync(join(site, "whole-sky.html"), renderConstellationPage("whole-sky.html", "ws_title", "ws_description", "whole-sky"));
writeFileSync(join(site, "constellation-list.html"), renderConstellationPage("constellation-list.html", "ls_title", "ls_description", "list"));
writeFileSync(join(site, "birthday.html"), renderConstellationPage("birthday.html", "bd_title", "bd_description", "birthday"));
writeFileSync(join(site, "quiz.html"), renderConstellationPage("quiz.html", "qz_title", "qz_description", "quiz"));
writeFileSync(join(site, "constellation-3d.html"), renderSpace());
writeFileSync(join(site, "layers-3d.html"), renderLayers());
writeThumbnails(join(site, "thumbnails"));
// The pictures of the Chinese asterisms and the traditional Japanese figures: Pages only, never in the npm package (which ships the 88).
writeCultureThumbnails(join(site, "thumbnails"), chinese);
writeCultureThumbnails(join(site, "thumbnails"), japanese);
// The faint stars (UCAC4, to magnitude 12) in their tiles: the demo reads them from here, and so does anyone who leaves `faintSky`'s default address (scripts/make-faint-data.py makes them).
cpSync(join(root, "faint-tiles"), join(site, "faint-tiles"), { recursive: true });
cpSync(join(root, "pictures"), join(site, "pictures"), { recursive: true });
writeFileSync(join(site, "family-boot.js"), familyBoot());
// Michroma, the family's font for a name on a body (kazoku-ui's body-label, SIL Open Font License 1.1 beside it): copied from kazoku-ui's build so the embed page can load it from its own site, only when its names are on.
cpSync(join(root, "node_modules", "@johnmorrisdotca", "kazoku-ui", "dist", "body-label", "fonts"), join(site, "fonts"), { recursive: true });
for (const file of ["embed.html", "embed-3d.html", "embed-layers.html", "markers.html", "star.html", "demo.css", "family.css", "gallery.css", "whole-sky.css", "space.css"]) cpSync(join(root, "demo", file), join(site, file));
await build({
  entryPoints: { demo: join(root, "demo", "demo.ts"), embed: join(root, "demo", "embed.ts"), star: join(root, "demo", "star.ts"), kids: join(root, "demo", "kids.ts"), tonight: join(root, "demo", "tonight.ts"), gallery: join(root, "demo", "gallery.ts"), quiz: join(root, "demo", "quiz.ts"), constellation: join(root, "demo", "constellation.ts"), list: join(root, "demo", "list.ts"), "whole-sky": join(root, "demo", "whole-sky.ts"), "constellation-3d": join(root, "demo", "constellation-3d.ts"), "embed-3d": join(root, "demo", "embed-3d.ts"), "layers-3d": join(root, "demo", "layers-3d.ts"), "embed-layers": join(root, "demo", "embed-layers.ts"), birthday: join(root, "demo", "birthday.ts"), markers: join(root, "demo", "markers.ts") },
  outdir: join(site, "js"),
  bundle: true,
  splitting: true,
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
