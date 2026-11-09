// The ready-made PDFs of the printable sheets, printed from the built demo (site/kids.html) by Chromium's page.pdf into site/pdf/, with a list page for each language:
//   pnpm site && node scripts/make-pdfs.mjs
// A4 and US Letter, English and Japanese: connect-the-dots for twelve famous constellations at every level, the star wheel for each band of latitude (big and round type, and normal), and the constellations for your sky and the sky map for
// January, April, July and October in four bands. The server is this package's picture-script port, 8252; one headless browser under the browser lock, closed when the last PDF is written.
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";
import { SOFTWARE_GL_ARGS, withBrowserLock } from "@johnmorrisdotca/kazoku-ui/testing";

const PORT = Number(process.env.PDF_PORT ?? 8252);
const site = new URL("../site/", import.meta.url).pathname;
const PAPERS = ["a4", "letter"];
const LANGS = ["en", "ja"];
const FAMOUS = { UMa: ["Ursa Major", "おおぐま座"], UMi: ["Ursa Minor", "こぐま座"], Cas: ["Cassiopeia", "カシオペヤ座"], Ori: ["Orion", "オリオン座"], Cru: ["Crux", "みなみじゅうじ座"], Leo: ["Leo", "しし座"], Sco: ["Scorpius", "さそり座"], Cyg: ["Cygnus", "はくちょう座"], Lyr: ["Lyra", "こと座"], Aql: ["Aquila", "わし座"], Gem: ["Gemini", "ふたご座"], Tau: ["Taurus", "おうし座"] };
const LEVELS = ["easy", "medium", "hard"];
const BANDS = [[25, "20 to 30 N", "きた 20〜30ど"], [35, "30 to 40 N", "きた 30〜40ど"], [45, "40 to 50 N", "きた 40〜50ど"], [55, "50 to 60 N", "きた 50〜60ど"], [65, "60 to 70 N", "きた 60〜70ど"], [-25, "20 to 30 S", "みなみ 20〜30ど"], [-35, "30 to 40 S", "みなみ 30〜40ど"], [-45, "40 to 50 S", "みなみ 40〜50ど"], [-55, "50 to 60 S", "みなみ 50〜60ど"], [-65, "60 to 70 S", "みなみ 60〜70ど"]];
const SKY_BANDS = BANDS.filter(([lat]) => [35, 45, 55, -35].includes(lat));
const MONTHS = [[1, "January", "1がつ"], [4, "April", "4がつ"], [7, "July", "7がつ"], [10, "October", "10がつ"]];
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };

const server = createServer((req, res) => {
  void (async () => {
    let url = (req.url ?? "/").split("?")[0].replace(/^\/hoshi-stars\/?/, "/");
    if (url === "/") url = "/index.html";
    try {
      const path = join(site, normalize(url));
      res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
      res.end(await readFile(path));
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  })();
}).listen(PORT);

/** Every PDF: its file name, the page's address and the words that list it. */
const jobs = [];
for (const lang of LANGS) {
  for (const paper of PAPERS) {
    const add = (section, file, query, en, ja) => jobs.push({ lang, paper, section, file: `hoshi-stars-${file}-${paper}-${lang}.pdf`, query: `${query}&paper=${paper}&lang=${lang}`, label: lang === "ja" ? ja : en });
    for (const [code, [en, ja]] of Object.entries(FAMOUS)) for (const level of LEVELS) add("dots", `dots-${code}-${level}`, `kind=dots&c=${code}&level=${level}`, `${en}, ${level}`, `${ja}, ${{ easy: "かんたん", medium: "ふつう", hard: "むずかしい" }[level]}`);
    for (const [lat, en, ja] of BANDS) for (const type of ["kid", "normal"]) add("wheel", `wheel-${lat}-${type}`, `kind=wheel&lat=${lat}&type=${type}`, `${en}, ${type === "kid" ? "big and round" : "normal"}`, `${ja}, ${type === "kid" ? "おおきくて まるい" : "ふつう"}`);
    for (const [lat, en, ja] of SKY_BANDS) for (const [month, mEn, mJa] of MONTHS) {
      add("guide", `guide-${lat}-${month}`, `kind=guide&lat=${lat}&month=${month}`, `${en}, ${mEn}`, `${ja}, ${mJa}`);
      add("map", `map-${lat}-${month}`, `kind=map&lat=${lat}&month=${month}`, `${en}, ${mEn}`, `${ja}, ${mJa}`);
    }
  }
}

await mkdir(join(site, "pdf"), { recursive: true });
let written = 0;
await withBrowserLock(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_GL_ARGS });
  try {
    for (const lang of LANGS) {
      for (const paper of PAPERS) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: lang === "ja" ? "ja-JP" : "en-US", reducedMotion: "reduce" });
        await page.addInitScript(() => { window.print = () => {}; });
        await page.emulateMedia({ colorScheme: "light" });
        for (const job of jobs.filter((one) => one.lang === lang && one.paper === paper)) {
          await page.goto(`http://127.0.0.1:${PORT}/hoshi-stars/kids.html?${job.query}`);
          await page.locator("#paper-inner .kazoku-page").first().waitFor();
          await page.locator("#print").click();
          await page.emulateMedia({ media: "print", colorScheme: "light" });
          await writeFile(join(site, "pdf", job.file), await page.pdf({ preferCSSPageSize: true, printBackground: true }));
          written += 1;
          await page.evaluate(() => window.dispatchEvent(new window.Event("afterprint")));
          await page.emulateMedia({ media: "screen", colorScheme: "light" });
        }
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
});

const SAY = {
  en: { title: "Printable sheets: PDFs", intro: "Print on A4 or US Letter. The dots, the star wheel (cut out the disc and the plate), the constellations for your sky and the sky map for a month.", back: "Back to the page where you pick a sheet", paper: { a4: "A4", letter: "US Letter" }, other: "日本語 (Japanese)", otherPage: "ja.html", page: "kids.html", sections: { dots: "Connect the dots", wheel: "Star wheel, by latitude band", guide: "Constellations for your sky, by latitude band and month", map: "Sky map, by latitude band and month" } },
  ja: { title: "印刷するシートの PDF", intro: "A4 か USレターで いんさつします。てんつなぎ、ほしの ばん (まるい ばんと まどの いたを きりぬきます)、すんでいる ところの ほしざ、つきごとの ほしぞらの ちずです。", back: "シートを えらぶ ページに もどる", paper: { a4: "A4", letter: "USレター" }, other: "English", otherPage: "./", page: "kids.html?lang=ja", sections: { dots: "てんつなぎ", wheel: "ほしの ばん (いどの おびごと)", guide: "すんでいる ところの ほしざ (いどの おびと つきごと)", map: "ほしぞらの ちず (いどの おびと つきごと)" } },
};
for (const lang of LANGS) {
  const say = SAY[lang];
  const sections = Object.keys(say.sections).map((section) => {
    const labels = [...new Set(jobs.filter((job) => job.lang === lang && job.section === section).map((job) => job.label))];
    const rows = labels.map((label) => `<tr><th scope="row">${label}</th>${PAPERS.map((paper) => `<td><a href="${jobs.find((job) => job.lang === lang && job.section === section && job.label === label && job.paper === paper).file}">${say.paper[paper]}</a></td>`).join("")}</tr>`).join("\n");
    return `<h2>${say.sections[section]}</h2>\n<table><tbody>\n${rows}\n</tbody></table>`;
  });
  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${say.title} · Hoshi Stars</title>
<style>:root{color-scheme:light dark}body{margin:0 auto;max-width:48rem;padding:1rem 16px;font:1rem/1.5 system-ui,"Hiragino Sans","Noto Sans JP",sans-serif}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.3rem .6rem;border-bottom:1px solid #8886}a{display:inline-block;min-height:48px;line-height:48px;padding:0 .5rem}</style></head>
<body><h1>${say.title}</h1><p>${say.intro}</p><p><a href="../${say.page}">${say.back}</a> · <a href="${say.otherPage}">${say.other}</a></p>
${sections.join("\n")}
</body></html>
`;
  await writeFile(join(site, "pdf", lang === "en" ? "index.html" : "ja.html"), html, "utf8");
}
console.log(`pdfs: ${written} written to site/pdf/`);
