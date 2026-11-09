// The demo's page, made from demo/index.html and the family's shared head, header, footer and language chooser (family-template.mjs). The Pages build (site.ts) writes it into site/,
// and the dev server serves the same files, so the tests play the page that is published.
import { readFileSync } from "node:fs";
import { FAMILY_SCRIPT, familyFooter, familyHead, familyHeader, familyUnreviewed } from "./family-template.mjs";
import { ALL_WORDS } from "./gallery-words.ts";
import { WORDS } from "./page-words.ts";

const id = "hoshi-stars";
const LINKS = [{ href: "whole-sky.html", say: "pageWholeSky" }, { href: "constellations.html", say: "pageGallery" }, { href: "constellation-list.html", say: "pageList" }, { href: "constellation-3d.html", say: "pageSpace" }, { href: "kids.html", say: "pageKids" }, { href: "docs/index.html", say: "pageDocs" }, { href: "embed.html", say: "pageEmbed" }];

/** The page's text with the family's blocks put in where its comments say, in English: the language chooser changes the words in the browser. */
export function renderIndex(): string {
  const html = readFileSync(new URL("../demo/index.html", import.meta.url), "utf8");
  return html
    .replace("<!--family:head-->", familyHead({ id, title: WORDS.en.title, description: WORDS.en.description }))
    .replace("<!--family:header-->", familyHeader({ id, links: LINKS }))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", familyFooter({ id }))
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/demo.js"></script>`);
}

/** The printable sheets' page. */
export function renderKids(): string {
  const html = readFileSync(new URL("../demo/kids.html", import.meta.url), "utf8");
  return html
    .replace("<!--family:head-->", familyHead({ id, title: WORDS.en.kd_title, description: WORDS.en.kd_description }))
    .replace("<!--family:header-->", familyHeader({ id, links: LINKS }))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", familyFooter({ id }))
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/kids.js"></script>`);
}

/** One of the constellation pages (gallery.html, constellation.html), made as the others are. `title` and `description` are the English words' keys. */
export function renderConstellationPage(file: string, title: string, description: string, script: string): string {
  const html = readFileSync(new URL(`../demo/${file}`, import.meta.url), "utf8");
  const words = ALL_WORDS.en as Record<string, string>;
  return html
    .replace("<!--family:head-->", familyHead({ id, title: words[title]!.replace("{name}", "Constellation"), description: words[description]!.replace("{name}", "A constellation").replace("({abbreviation})", "") }))
    .replace("<!--family:header-->", familyHeader({ id, links: LINKS }))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", familyFooter({ id }))
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/${script}.js"></script>`);
}

/** The constellation in 3D page. */
export function renderSpace(): string {
  const html = readFileSync(new URL("../demo/constellation-3d.html", import.meta.url), "utf8");
  const words = ALL_WORDS.en as Record<string, string>;
  return html
    .replace("<!--family:head-->", familyHead({ id, title: words["sp_title"]!, description: words["sp_description"]! }))
    .replace("<!--family:header-->", familyHeader({ id, links: LINKS }))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", familyFooter({ id }))
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/constellation-3d.js"></script>`);
}

/** The classic script that defines familyLanguage and fills the header. An external file, so the page's script policy stays 'self'. It tells the page's own script when the language changes. */
export function familyBoot(): string {
  return `${FAMILY_SCRIPT}\nfamilyLanguage({ id: ${JSON.stringify(id)}, words: ${JSON.stringify(ALL_WORDS)}, onChange: function (lang) { document.dispatchEvent(new CustomEvent("hoshi-language", { detail: { lang: lang } })); } });\n`;
}
