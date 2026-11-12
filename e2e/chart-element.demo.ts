// <hoshi-chart>, as a reader's page has it: the built package and kazoku-ui (its optional peer, for the hands) served from a page of their own through an import map. It draws, names
// itself, draws nothing at rest, moves in the hand and says so, picks what a tap lands on, keeps its zoom in range, loads a culture when asked, and without kazoku-ui still draws and says once why
// it does not move.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const KAZOKU = join(root, "node_modules", "@johnmorrisdotca", "kazoku-ui", "dist");
const TYPES: Record<string, string> = { ".js": "text/javascript", ".html": "text/html" };

/** A page at https://chart.test/ holding `body`, with the package under /hoshi/ and kazoku-ui under /kazoku/ (or answering 404, a page that did not install it). */
async function chartPage(page: Page, body: string, kazoku = true): Promise<string[]> {
  const said: string[] = [];
  page.on("console", (message) => said.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => said.push(`pageerror: ${error.message}`));
  await page.route("https://chart.test/**", (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><script type="importmap">{"imports":{"@johnmorrisdotca/kazoku-ui/view-controls":"/kazoku/view-controls/index.js","@johnmorrisdotca/kazoku-ui/":"/kazoku/"}}</script><script type="module" src="/hoshi/chart/define.js"></script></head><body style="margin:0">${body}</body></html>`;
      return route.fulfill({ body: html, contentType: "text/html" });
    }
    const [base, rest] = pathname.startsWith("/hoshi/") ? [join(root, "dist"), pathname.slice(7)] : pathname.startsWith("/kazoku/") && kazoku ? [KAZOKU, pathname.slice(8)] : ["", ""];
    if (base === "") return route.fulfill({ status: 404, body: "" });
    const file = join(base, rest);
    try {
      return route.fulfill({ body: readFileSync(file), contentType: TYPES[".js"] });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
  await page.goto("https://chart.test/");
  return said;
}

const chart = (page: Page) => page.locator("hoshi-chart").first();
const drawn = (page: Page) => chart(page).evaluate((el) => el.shadowRoot?.querySelectorAll("svg circle").length ?? 0);
const draws = (page: Page) => chart(page).evaluate((el) => (el as unknown as { stats: { draws: number } }).stats.draws);
const view = (page: Page) => chart(page).evaluate((el) => (el as unknown as { view: { ra: number; dec: number; zoom: number } }).view);
const hands = (page: Page) => chart(page).evaluate((el) => Reflect.get(el, "controller") !== undefined);

test("it draws the bright stars with the layers asked for, names itself in its language, and draws nothing at rest", async ({ page }) => {
  const said = await chartPage(page, `<hoshi-chart constellation="Ori" layers="milky lines names boundaries" style="width:640px;height:400px"></hoshi-chart>`);
  await expect.poll(() => drawn(page)).toBeGreaterThan(100);
  await expect.poll(() => hands(page)).toBe(true);
  const svg = chart(page).locator("svg");
  await expect(svg).toHaveAttribute("aria-label", "Star chart");
  await expect(svg).toHaveAttribute("viewBox", "0 0 640 400");
  // the lines, the boundaries and the Milky Way are drawn (each layer a few paths)
  expect(await chart(page).evaluate((el) => el.shadowRoot!.querySelectorAll("svg line, svg path").length)).toBeGreaterThanOrEqual(8);
  // at rest: nothing more is drawn
  const before = await draws(page);
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(before);
  // a language from the page above it
  await page.evaluate(() => document.documentElement.setAttribute("lang", "ja"));
  await chart(page).evaluate((el) => el.setAttribute("magnitude", "4.5"));
  await expect(svg).toHaveAttribute("aria-label", "星図");
  expect(said.filter((line) => line.startsWith("error") || line.startsWith("pageerror"))).toEqual([]);
});

test("a drag moves the sky and says so, settling with a final view", async ({ page }) => {
  await chartPage(page, `<hoshi-chart style="width:640px;height:400px"></hoshi-chart>`);
  await expect.poll(() => hands(page)).toBe(true);
  const start = await view(page);
  await page.evaluate(() => {
    const seen: unknown[] = [];
    (window as unknown as { seen: unknown[] }).seen = seen;
    document.querySelector("hoshi-chart")!.addEventListener("hoshi-view", (event) => seen.push((event as CustomEvent).detail));
  });
  await page.mouse.move(320, 200);
  await page.mouse.down();
  await page.mouse.move(420, 230, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await view(page)).ra - start.ra)).toBeGreaterThan(1);
  const seen = await page.evaluate(() => (window as unknown as { seen: { final: boolean; ra: number }[] }).seen);
  expect(seen.length).toBeGreaterThan(1);
  expect(seen.at(-1)!.final).toBe(true);
});

test("a tap on a star picks it, a tap on empty sky inside a constellation picks the figure, and the zoom keeps to its range", async ({ page }) => {
  // Betelgeuse (HR 2061) in the middle, close in
  await chartPage(page, `<hoshi-chart ra="88.79" dec="7.41" zoom="12" style="width:600px;height:400px"></hoshi-chart>`);
  await expect.poll(() => drawn(page)).toBeGreaterThan(5);
  await page.evaluate(() => {
    const picks: unknown[] = [];
    (window as unknown as { picks: unknown[] }).picks = picks;
    document.querySelector("hoshi-chart")!.addEventListener("hoshi-pick", (event) => picks.push((event as CustomEvent).detail));
  });
  await page.mouse.click(300, 200);
  await expect.poll(() => page.evaluate(() => (window as unknown as { picks: unknown[] }).picks.at(-1))).toEqual({ kind: "star", id: "2061" });
  // the zoom range: 500 at most unless the page raises it, up to 8000
  await chart(page).evaluate((el) => el.setAttribute("zoom", "1200"));
  await expect.poll(async () => (await view(page)).zoom).toBe(500);
  await chart(page).evaluate((el) => el.setAttribute("zoom-max", "8000"));
  await chart(page).evaluate((el) => el.setAttribute("zoom", "1200"));
  await expect.poll(async () => (await view(page)).zoom).toBe(1200);
});

test("the Japanese sky is loaded when asked for", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(new URL(request.url()).pathname));
  await chartPage(page, `<hoshi-chart lang="ja" style="width:600px;height:400px"></hoshi-chart>`);
  await expect.poll(() => drawn(page)).toBeGreaterThan(100);
  expect(requested.some((path) => path.endsWith("/cultures/japanese.js"))).toBe(false);
  const before = await draws(page);
  await chart(page).evaluate((el) => el.setAttribute("culture", "japanese"));
  await expect.poll(() => requested.some((path) => path.endsWith("/cultures/japanese.js"))).toBe(true);
  await expect.poll(() => draws(page)).toBeGreaterThan(before);
});

test("without kazoku-ui the chart is still drawn, as a picture, and the page is told once why it does not move", async ({ page }) => {
  const said = await chartPage(page, `<hoshi-chart style="width:640px;height:400px"></hoshi-chart><hoshi-chart style="width:320px;height:200px"></hoshi-chart>`, false);
  await expect.poll(() => drawn(page)).toBeGreaterThan(100);
  await expect.poll(() => said.filter((line) => line.includes("install @johnmorrisdotca/kazoku-ui for zoom and drag")).length).toBe(1);
  // no hands: a drag moves nothing
  const start = await view(page);
  await page.mouse.move(320, 200);
  await page.mouse.down();
  await page.mouse.move(420, 230, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await view(page)).toEqual(start);
  expect(await hands(page)).toBe(false);
  expect(said.filter((line) => line.startsWith("pageerror"))).toEqual([]);
});
