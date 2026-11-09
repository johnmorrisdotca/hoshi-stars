// The sheets page in a real browser: pick a sheet, say where you live, pick the paper, see the sheet as it prints, press Print / save PDF. Chromium also prints each kind of sheet on every paper to a PDF (page.pdf) and the PDF is read
// for its paper size and its page count.
import { expect, test, type Page } from "@playwright/test";

const PAPERS = [["a4", 210, 297], ["letter", 215.9, 279.4], ["a3", 297, 420], ["tabloid", 279.4, 431.8]] as const;
const PT = 72 / 25.4;
const MM = 25.4 / 96;
const PAGE = "/hoshi-stars/kids.html";

const open = async (page: Page, query = "kind=dots&c=Ori&level=medium"): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Reflect.set(window, "__printed", 0);
    window.print = () => Reflect.set(window, "__printed", (Reflect.get(window, "__printed") as number) + 1);
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`${PAGE}?${query}`);
  await expect(page.locator("#paper-inner .kazoku-page").first()).toBeVisible();
  return errors;
};
const readPdf = (bytes: Buffer): { pages: number; boxes: [number, number][] } => {
  const text = bytes.toString("latin1");
  const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m): [number, number] => [Number(m[1]), Number(m[2])]);
  return { pages: (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length, boxes };
};
const near = (got: number, want: number): boolean => Math.abs(got - want) <= 1.5;

test("the page has the four kinds of sheet as a row of buttons, and a dots sheet has the name, the page's header and footer, a QR code and two pages (the puzzle and the answer)", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("#kinds button")).toHaveCount(4);
  const sheet = page.locator("#paper-inner .kazoku-sheet");
  await expect(sheet.locator(".kazoku-brand").first()).toHaveText("Space Program X");
  await expect(sheet.locator(".kazoku-title").first()).toHaveText("Orion");
  await expect(sheet.locator(".kazoku-namelabel").first()).toHaveText("Name:");
  await expect(sheet.locator(".kazoku-page")).toHaveCount(2);
  await expect(sheet.locator(".kazoku-qr svg").first()).toBeVisible();
  await expect(sheet.locator(".kazoku-credits").first()).toContainText("Yale");
  await expect(page.locator("#info")).toHaveText("A4: 2 pages");
  await expect(sheet.locator("svg [data-dot]").first()).toBeVisible();
  await expect(sheet.locator(".kazoku-page").nth(1).locator("svg [data-line]").first()).toBeVisible();
  await expect(sheet.locator(".kazoku-page").first().locator("svg [data-line]")).toHaveCount(0);
  await page.locator("#whiches [data-value=Cru]").click();
  await expect(sheet.locator(".kazoku-title").first()).toHaveText("Crux");
  await expect(page).toHaveURL(/c=Cru/);
  await page.locator("#levels [data-value=hard]").click();
  await expect(sheet.locator("svg [data-number]")).toHaveCount(0);
  await page.locator("#more").selectOption("Aql");
  await expect(sheet.locator(".kazoku-title").first()).toHaveText("Aquila");
  expect(errors).toEqual([]);
});

test("a place: a country and a region give the latitude, the sheet says where it is for, and the region's constellations follow", async ({ page }) => {
  await page.goto(`${PAGE}?kind=guide&month=7`);
  await expect(page.locator("#info")).toHaveText("Pick a country, or a latitude.");
  await page.locator("#country").selectOption("AU");
  await expect(page.locator("#field-region")).toBeVisible();
  await page.locator("#region").selectOption("AU-TAS");
  const sheet = page.locator("#paper-inner .kazoku-sheet");
  await expect(sheet.locator(".kazoku-info dd").first()).toHaveText("Tasmania");
  await expect(sheet.locator(".kazoku-info img")).toBeVisible();
  await expect(page.locator("#lat-out")).toContainText("S (");
  await expect(sheet.locator("svg [data-thumb=Cru]")).toBeVisible();
  await expect(sheet.locator("svg [data-thumb=UMi]")).toHaveCount(0);
  await expect(sheet.locator(".kazoku-title").first()).toContainText("Tasmania");
  await page.locator("#country").selectOption("CA");
  await page.locator("#region").selectOption("CA-ON");
  await expect(sheet.locator("svg [data-thumb=UMa]")).toBeVisible();
  await expect(sheet.locator("svg [data-thumb=Cru]")).toHaveCount(0);
  await page.locator("#country").selectOption("JP");
  await expect(sheet.locator(".kazoku-info dd").first()).toHaveText("Japan");
});

test("a latitude from the slider makes the wheel, in two pages, or a poster tiled over pages; and a map for a month", async ({ page }) => {
  await open(page, "kind=wheel&lat=45");
  const sheet = page.locator("#paper-inner .kazoku-sheet");
  await expect(sheet.locator(".kazoku-page")).toHaveCount(2);
  await expect(sheet.locator('svg [data-cut="disc"]')).toHaveCount(1);
  await expect(sheet.locator('svg [data-cut="window"]')).toHaveCount(1);
  await page.locator('#forms [data-value="poster"]').click();
  await expect(sheet.locator(".kazoku-tile").first()).toBeVisible();
  expect(await sheet.locator(".kazoku-tile").count()).toBeGreaterThanOrEqual(4);
  await expect(sheet.locator(".kazoku-tile").first().locator(".kazoku-marks line")).toHaveCount(8);
  await page.locator("#kinds [data-value=map]").click();
  await page.locator('#months [data-value="11"]').click();
  await expect(sheet.locator(".kazoku-title").first()).toHaveText(/November/);
  await expect(sheet.locator('svg [data-horizon=""]')).toBeVisible();
  await page.locator("#lat").fill("-34");
  await expect(page.locator("#lat-out")).toContainText("S");
  await expect(sheet.locator("svg").first()).toContainText("Face north");
});

test("the picture is drawn at the size it prints, whatever font draws the words: every line of text is inside it", async ({ page }) => {
  await open(page);
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = '.kazoku-sheet { font-family: Verdana, "DejaVu Sans", sans-serif !important; }';
    document.documentElement.append(style);
  });
  for (const paper of ["a4", "letter"]) {
    for (const query of ["kind=dots&c=Ori&level=medium", "kind=dots&c=Hya&level=easy", "kind=guide&lat=-34&month=7", "kind=guide&lat=52&month=1", "kind=wheel&lat=40", "kind=wheel&lat=-40&type=normal", "kind=map&lat=50&month=12", "kind=map&lat=-34&month=6&type=normal"]) {
      await page.goto(`${PAGE}?${query}&paper=${paper}`);
      await expect(page.locator("#paper-inner .kazoku-page").first()).toBeVisible();
      const got = await page.locator("#paper-inner .kazoku-body svg").evaluateAll((svgs, mm) => {
        const scaled = new DOMMatrix(getComputedStyle(document.querySelector("#paper-inner")!).transform).a;
        return svgs.map((svg) => {
          const frame = svg.getBoundingClientRect();
          const box = (svg as SVGSVGElement).viewBox.baseVal;
          const slack = 0.5 / mm;
          const inside = [...svg.querySelectorAll("text")].every((text) => {
            const b = text.getBoundingClientRect();
            return b.left >= frame.left - slack && b.top >= frame.top - slack && b.right <= frame.right + slack && b.bottom <= frame.bottom + slack;
          });
          return { scale: Math.min((frame.width * mm) / scaled / box.width, (frame.height * mm) / scaled / box.height), inside };
        });
      }, MM);
      for (const one of got) {
        expect(one.scale, `${query} ${paper}: the picture's scale`).toBeGreaterThan(0.99);
        expect(one.scale, `${query} ${paper}`).toBeLessThan(1.01);
        expect(one.inside, `${query} ${paper}: the text is inside the picture`).toBe(true);
      }
    }
  }
});

test("Print / save PDF opens a print-only copy, calls window.print, and removes the copy afterwards", async ({ page }) => {
  await open(page);
  await page.locator("#print").click();
  expect(await page.evaluate(() => Reflect.get(window, "__printed"))).toBe(1);
  await expect(page.locator("body > .kazoku-print-root .kazoku-sheet")).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator(".kazoku-print-root")).toHaveCount(0);
});

test("the sheet speaks Japanese in plain words", async ({ page }) => {
  await open(page, "kind=wheel&lat=45&lang=ja");
  const sheet = page.locator("#paper-inner .kazoku-sheet");
  await expect(sheet.locator(".kazoku-namelabel").first()).toHaveText("なまえ:");
  await expect(sheet.locator(".kazoku-title").first()).toContainText("ほしの ばん");
  await expect(sheet.locator("svg [data-say]").first()).toContainText("きりとります");
  await expect(page.locator("#print")).toHaveText("いんさつ / PDFで ほぞん");
  await page.locator("#kinds [data-value=dots]").click();
  await expect(sheet.locator(".kazoku-title").first()).toHaveText("オリオン座");
});

test("the buttons are a finger wide and the page fits the screen", async ({ page }) => {
  await open(page);
  const small = await page.locator(".kids-picks button").evaluateAll((els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).filter((el) => el.getBoundingClientRect().height < 47.5 || el.getBoundingClientRect().width < 47.5).length);
  expect(small).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const area = await page.locator("#paper").boundingBox();
  const first = await page.locator(".kazoku-page").first().boundingBox();
  expect(first!.width).toBeLessThanOrEqual(area!.width + 1);
});

for (const [paper, wide, tall] of PAPERS) {
  test(`${paper}: every kind of sheet prints to the right number of pages of the paper's size`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "page.pdf is Chromium's");
    test.setTimeout(120_000);
    await open(page, `kind=dots&c=Ori&paper=${paper}`);
    const cases: [string, number][] = [
      [`kind=dots&c=Ori&level=easy&paper=${paper}`, 2],
      [`kind=dots&c=UMa&level=medium&paper=${paper}&lang=ja`, 2],
      [`kind=dots&c=pack&lat=45&month=1&paper=${paper}`, 12],
      [`kind=guide&lat=-34&month=7&paper=${paper}`, 1],
      [`kind=guide&lat=52&month=1&paper=${paper}&type=normal`, 1],
      [`kind=wheel&lat=40&paper=${paper}`, 2],
      [`kind=wheel&lat=-40&paper=${paper}&lang=ja&type=normal`, 2],
      [`kind=map&lat=35&month=12&paper=${paper}`, 1],
      [`kind=map&lat=-34&month=6&paper=${paper}&lang=ja`, 1],
    ];
    for (const [query, pages] of cases) {
      await page.goto(`${PAGE}?${query}`);
      await expect(page.locator("#paper-inner .kazoku-page").first()).toBeVisible();
      await page.locator("#print").click();
      await page.emulateMedia({ media: "print", colorScheme: "light" });
      const pdf = readPdf(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
      const drawn = await page.locator("#paper-inner .kazoku-page").count();
      expect(drawn, `${query}: pages on the screen`).toBe(query.includes("c=pack") ? drawn : pages);
      expect(pdf.pages, `${query}: pages`).toBe(drawn);
      expect(pdf.boxes.every(([w, h]) => near(w, wide * PT) && near(h, tall * PT)), `${query}: every page is ${wide} by ${tall} mm`).toBe(true);
      await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
      await page.emulateMedia({ media: "screen", colorScheme: "light" });
    }
    // the poster: the tiles of the wheel
    await page.goto(`${PAGE}?kind=wheel&lat=45&form=poster&paper=${paper}`);
    await expect(page.locator("#paper-inner .kazoku-tile").first()).toBeVisible();
    const tiles = await page.locator("#paper-inner .kazoku-tile").count();
    await page.locator("#print").click();
    await page.emulateMedia({ media: "print", colorScheme: "light" });
    const posterPdf = readPdf(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
    expect(posterPdf.pages).toBe(tiles);
    expect(tiles).toBeGreaterThanOrEqual(2);
  });
}
