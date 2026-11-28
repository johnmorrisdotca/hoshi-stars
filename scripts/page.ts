// The demo's page, made from demo/index.html and the family's shared head, header, footer and language chooser (family-template.mjs). The Pages build (site.ts) writes it into site/,
// and the dev server serves the same files, so the tests play the page that is published.
import { readFileSync } from "node:fs";
import { pageCreditsHtml, pageHeaderHtml, type PageTexts } from "@johnmorrisdotca/kazoku-ui/page-frame";
import { FAMILY_SCRIPT, familyFooter, familyHead, familyHeader, familyUnreviewed } from "./family-template.mjs";
import { ALL_WORDS } from "./gallery-words.ts";
import { WORDS } from "./page-words.ts";

const id = "hoshi-stars";
/** Where every data credit is written in full. */
const NOTICE = "https://github.com/johnmorrisdotca/hoshi-stars/blob/main/NOTICE.md";

/** The family's footer, with a link to every data credit beside the one-line credit, so a reader need not open anything to find the sources. */
const footer = (): string => familyFooter({ id }).replace('<span data-say="foot"></span>', `<span><span data-say="foot"></span> <a href="${NOTICE}" data-say="creditsAll"></a></span>`);

/** The family's page frame, in place of `<!--frame:header-->` and `<!--frame:credits-->`. Japanese words are the page's own. */
function frame(html: string, title: string, description: string, jaTitle?: string, jaDescription?: string, embed = false): string {
  const what = (value: string, name: string): string => (value.startsWith(name) ? value.slice(name.length).replace(/^[:\s]+/, "") || value : value);
  const texts: PageTexts = { en: { name: "Hoshi Stars 星", what: what(title, "Hoshi Stars 星"), description } };
  if (jaTitle && jaDescription) texts.ja = { name: "星 Hoshi Stars", what: what(jaTitle, "星 Hoshi Stars"), description: jaDescription };
  const credits = pageCreditsHtml({ en: WORDS.en.foot, ja: WORDS.ja.foot }, { href: NOTICE, embed });
  const header = embed ? "" : pageHeaderHtml(texts, { meta: true, sheets: "kids.html" });
  return html.replace("<!--frame:header-->", header).replace("<!--frame:credits-->", credits);
}

/** A page that is copied as it stands (a star, a flight, an embed): the frame uses the title it already has. */
export function frameFile(file: string, embed = false): string {
  const html = readFileSync(new URL(`../demo/${file}`, import.meta.url), "utf8");
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() || "Hoshi Stars 星";
  const description = html.match(/name="description" content="([^"]*)"/)?.[1] || title;
  return frame(html, title, description, undefined, undefined, embed);
}
const LINKS = [
  { href: "index.html", say: "pageMap" },
  { href: "whole-sky.html", say: "pageWholeSky" },
  { href: "constellations.html", say: "pageGallery", also: ["constellation.html"] },
  { href: "constellation-list.html", say: "pageList" },
  { href: "constellation-3d.html", say: "pageSpace" },
  { href: "layers-3d.html", say: "pageDistance" },
  { href: "flight.html", say: "pageFlight" },
  { href: "tonight.html", say: "pageTonight" },
  { href: "my-sky.html", say: "pageMySky" },
  { href: "life.html", say: "pageLife" },
  { href: "markers.html", say: "pageMarkers" },
  { href: "kids.html", say: "pageKids", group: "resources" as const },
  { href: "birthday.html", say: "pageBirthday", group: "resources" as const },
  { href: "quiz.html", say: "pageQuiz", group: "resources" as const },
  { href: "planisphere.html", say: "pageWheel", group: "resources" as const },
  { href: "tap-dots.html", say: "pageTap", group: "resources" as const },
  { href: "docs/index.html", say: "pageDocs" },
  { href: "embed.html", say: "pageEmbed" },
];

/** The family's header for one built page. `current` is that page's file, and a constellation's own page counts as Constellations. */
const header = (current: string): string => familyHeader({ id, links: LINKS, current });

/** The page's text with the family's blocks put in where its comments say, in English: the language chooser changes the words in the browser. */
export function renderIndex(): string {
  const html = readFileSync(new URL("../demo/index.html", import.meta.url), "utf8");
  return frame(html, WORDS.en.title, WORDS.en.description, WORDS.ja.title, WORDS.ja.description)
    .replace("<!--family:head-->", familyHead({ id, title: WORDS.en.title, description: WORDS.en.description }))
    .replace("<!--family:header-->", header("index.html"))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", footer())
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/demo.js"></script>`);
}

/** The printable sheets' page. */
export function renderKids(): string {
  const html = readFileSync(new URL("../demo/kids.html", import.meta.url), "utf8");
  return frame(html, WORDS.en.kd_title, WORDS.en.kd_description, WORDS.ja.kd_title, WORDS.ja.kd_description)
    .replace("<!--family:head-->", familyHead({ id, title: WORDS.en.kd_title, description: WORDS.en.kd_description }))
    .replace("<!--family:header-->", header("kids.html"))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", footer())
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/kids.js"></script>`);
}

/** The tonight page: the stars you can see from a place now. */
export function renderTonight(): string {
  const html = readFileSync(new URL("../demo/tonight.html", import.meta.url), "utf8");
  return frame(html, WORDS.en.tn_title, WORDS.en.tn_description, WORDS.ja.tn_title, WORDS.ja.tn_description)
    .replace("<!--family:head-->", familyHead({ id, title: WORDS.en.tn_title, description: WORDS.en.tn_description }))
    .replace("<!--family:header-->", header("tonight.html"))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", footer())
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/tonight.js"></script>`);
}

/** The my sky page: the sky as someone standing outside sees it, in the `<hoshi-my-sky>` element. */
export function renderMySky(): string {
  const html = readFileSync(new URL("../demo/my-sky.html", import.meta.url), "utf8");
  return frame(html, WORDS.en.ms_title, WORDS.en.ms_description, WORDS.ja.ms_title, WORDS.ja.ms_description)
    .replace("<!--family:head-->", familyHead({ id, title: WORDS.en.ms_title, description: WORDS.en.ms_description }))
    .replace("<!--family:header-->", header("my-sky.html"))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", footer())
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/my-sky.js"></script>`);
}

/** The life of a star page: the Hertzsprung-Russell diagram of the graded stars. */
export function renderLife(): string {
  const html = readFileSync(new URL("../demo/life.html", import.meta.url), "utf8");
  return frame(html, WORDS.en.hr_title, WORDS.en.hr_description, WORDS.ja.hr_title, WORDS.ja.hr_description)
    .replace("<!--family:head-->", familyHead({ id, title: WORDS.en.hr_title, description: WORDS.en.hr_description }))
    .replace("<!--family:header-->", header("life.html"))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", footer())
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/life.js"></script>`);
}

/** The planisphere page: a star wheel with a horizon window to turn. */
export function renderPlanisphere(): string {
  const html = readFileSync(new URL("../demo/planisphere.html", import.meta.url), "utf8");
  return frame(html, WORDS.en.pl_title, WORDS.en.pl_description, WORDS.ja.pl_title, WORDS.ja.pl_description)
    .replace("<!--family:head-->", familyHead({ id, title: WORDS.en.pl_title, description: WORDS.en.pl_description }))
    .replace("<!--family:header-->", header("planisphere.html"))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", footer())
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/planisphere.js"></script>`);
}

/** The tap the dots page: the connect-the-dots figures to tap in order. */
export function renderTap(): string {
  const html = readFileSync(new URL("../demo/tap-dots.html", import.meta.url), "utf8");
  return frame(html, WORDS.en.td_title, WORDS.en.td_description, WORDS.ja.td_title, WORDS.ja.td_description)
    .replace("<!--family:head-->", familyHead({ id, title: WORDS.en.td_title, description: WORDS.en.td_description }))
    .replace("<!--family:header-->", header("tap-dots.html"))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", footer())
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/tap-dots.js"></script>`);
}

/** One of the constellation pages (gallery.html, constellation.html), made as the others are. `title` and `description` are the English words' keys. */
export function renderConstellationPage(file: string, title: string, description: string, script: string): string {
  const html = readFileSync(new URL(`../demo/${file}`, import.meta.url), "utf8");
  const words = ALL_WORDS.en as Record<string, string>;
  const japanese = ALL_WORDS.ja as Record<string, string>;
  const pageTitle = words[title]!.replace("{name}", "Constellation");
  const pageDescription = words[description]!.replace("{name}", "A constellation").replace("({abbreviation})", "");
  const jaTitle = japanese[title]?.replace("{name}", "星座");
  const jaDescription = japanese[description]?.replace("{name}", "星座").replace("({abbreviation})", "");
  const published = file === "gallery.html" ? "constellations.html" : file;
  return frame(html, pageTitle, pageDescription, jaTitle, jaDescription)
    .replace("<!--family:head-->", familyHead({ id, title: pageTitle, description: pageDescription }))
    .replace("<!--family:header-->", header(published))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", footer())
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/${script}.js"></script>`);
}

/** The constellation in 3D page. */
export function renderSpace(): string {
  const html = readFileSync(new URL("../demo/constellation-3d.html", import.meta.url), "utf8");
  const words = ALL_WORDS.en as Record<string, string>;
  const japanese = ALL_WORDS.ja as Record<string, string>;
  return frame(html, words["sp_title"]!, words["sp_description"]!, japanese["sp_title"], japanese["sp_description"])
    .replace("<!--family:head-->", familyHead({ id, title: words["sp_title"]!, description: words["sp_description"]! }))
    .replace("<!--family:header-->", header("constellation-3d.html"))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", footer())
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/constellation-3d.js"></script>`);
}

/** The sky by distance in 3D page. */
export function renderLayers(): string {
  const html = readFileSync(new URL("../demo/layers-3d.html", import.meta.url), "utf8");
  const words = ALL_WORDS.en as Record<string, string>;
  const japanese = ALL_WORDS.ja as Record<string, string>;
  return frame(html, words["ly_title"]!, words["ly_description"]!, japanese["ly_title"], japanese["ly_description"])
    .replace("<!--family:head-->", familyHead({ id, title: words["ly_title"]!, description: words["ly_description"]! }))
    .replace("<!--family:header-->", header("layers-3d.html"))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", footer())
    .replace("<!--family:scripts-->", `<script src="family-boot.js"></script>\n    <script type="module" src="kazoku-parts.js"></script>\n    <script type="module" src="js/layers-3d.js"></script>`);
}

/** The classic script that defines familyLanguage and fills the header. An external file, so the page's script policy stays 'self'. It tells the page's own script when the language changes. */
export function familyBoot(): string {
  return `${FAMILY_SCRIPT}\nfamilyLanguage({ id: ${JSON.stringify(id)}, words: ${JSON.stringify(ALL_WORDS)}, onChange: function (lang) { document.dispatchEvent(new CustomEvent("hoshi-language", { detail: { lang: lang } })); } });\n`;
}
