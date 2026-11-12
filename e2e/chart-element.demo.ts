// <hoshi-chart>, as a reader's page has it: the built package and kazoku-ui (its dependency, for the hands) served from a page of their own through an import map. It draws, names itself in the
// page's language and follows it, draws nothing at rest, moves in the hand and says so, picks what a tap lands on (a star, a deep-sky object, a black hole, a figure or nothing), lets the page's
// own `picked` and `constellation` win again after a tap, keeps its zoom in range, loads a culture when asked, stays a still picture with controls="none", and keeps its hands when it is moved.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const KAZOKU = join(root, "node_modules", "@johnmorrisdotca", "kazoku-ui", "dist");

/** A page at https://chart.test/ holding `body`, with the package under /hoshi/ and kazoku-ui under /kazoku/. */
async function chartPage(page: Page, body: string): Promise<string[]> {
  const said: string[] = [];
  page.on("console", (message) => said.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => said.push(`pageerror: ${error.message}`));
  await page.route("https://chart.test/**", (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><script type="importmap">{"imports":{"@johnmorrisdotca/kazoku-ui/view-controls":"/kazoku/view-controls/index.js","@johnmorrisdotca/kazoku-ui/":"/kazoku/"}}</script><script type="module" src="/hoshi/chart/define.js"></script></head><body style="margin:0">${body}</body></html>`;
      return route.fulfill({ body: html, contentType: "text/html" });
    }
    const [base, rest] = pathname.startsWith("/hoshi/") ? [join(root, "dist"), pathname.slice(7)] : pathname.startsWith("/kazoku/") ? [KAZOKU, pathname.slice(8)] : ["", ""];
    if (base === "") return route.fulfill({ status: 404, body: "" });
    try {
      return route.fulfill({ body: readFileSync(join(base, rest)), contentType: "text/javascript" });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
  await page.goto("https://chart.test/");
  return said;
}

const chart = (page: Page) => page.locator("hoshi-chart").first();
const drawn = (page: Page) => chart(page).evaluate((el) => el.shadowRoot?.querySelectorAll("svg circle").length ?? 0);
const draws = (page: Page) => chart(page).evaluate((el) => (el as unknown as { _stats: { draws: number } })._stats.draws);
const view = (page: Page) => chart(page).evaluate((el) => (el as unknown as { view: { ra: number; dec: number; zoom: number } }).view);
const hands = (page: Page) => chart(page).evaluate((el) => Reflect.get(el, "controller") !== undefined);
const drag = async (page: Page) => {
  await page.mouse.move(320, 200);
  await page.mouse.down();
  await page.mouse.move(420, 230, { steps: 8 });
  await page.mouse.up();
};
/** Listen for hoshi-pick on the chart; `picks(page)` reads what came. */
const listen = (page: Page) =>
  page.evaluate(() => {
    const picks: unknown[] = [];
    (window as unknown as { picks: unknown[] }).picks = picks;
    document.querySelector("hoshi-chart")!.addEventListener("hoshi-pick", (event) => picks.push((event as CustomEvent).detail));
  });
const lastPick = (page: Page) => page.evaluate(() => (window as unknown as { picks: unknown[] }).picks.at(-1));
/** The middle of what is drawn in `colour` (the pick's ring, or a highlighted figure's lines), or nothing. */
const middleOf = (page: Page, colour: string) =>
  chart(page).evaluate((el, stroke) => {
    const shapes = [...el.shadowRoot!.querySelectorAll(`svg [stroke="${stroke}"]`)].filter((shape) => (shape as SVGGraphicsElement).getBBox().width + (shape as SVGGraphicsElement).getBBox().height > 0);
    if (shapes.length === 0) return null;
    const boxes = shapes.map((shape) => (shape as SVGGraphicsElement).getBBox());
    const left = Math.min(...boxes.map((b) => b.x));
    const right = Math.max(...boxes.map((b) => b.x + b.width));
    const top = Math.min(...boxes.map((b) => b.y));
    const bottom = Math.max(...boxes.map((b) => b.y + b.height));
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  }, colour);
const PICK_RING = "#ff7a59";
const LINES_ON = "#ffd86b";

test("it draws the bright stars with the layers asked for, names itself in the page's language and follows it, and draws nothing at rest", async ({ page }) => {
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
  // the page's language changes above it, and nothing else: the chart follows
  await page.evaluate(() => document.documentElement.setAttribute("lang", "ja"));
  await expect(svg).toHaveAttribute("aria-label", "星図");
  await page.evaluate(() => document.documentElement.setAttribute("lang", "en-CA"));
  await expect(svg).toHaveAttribute("aria-label", "Star chart");
  // its own lang wins over the page's
  await chart(page).evaluate((el) => el.setAttribute("lang", "ja"));
  await expect(svg).toHaveAttribute("aria-label", "星図");
  expect(said.filter((line) => line.startsWith("error") || line.startsWith("pageerror") || line.startsWith("warning"))).toEqual([]);
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
  await drag(page);
  await expect.poll(async () => Math.abs((await view(page)).ra - start.ra)).toBeGreaterThan(1);
  const seen = await page.evaluate(() => (window as unknown as { seen: { final: boolean; ra: number }[] }).seen);
  expect(seen.length).toBeGreaterThan(1);
  expect(seen.at(-1)!.final).toBe(true);
});

test("a tap on a star picks it, and the zoom keeps to its range", async ({ page }) => {
  // Betelgeuse (HR 2061) in the middle, close in
  await chartPage(page, `<hoshi-chart ra="88.79" dec="7.41" zoom="12" style="width:600px;height:400px"></hoshi-chart>`);
  await expect.poll(() => drawn(page)).toBeGreaterThan(5);
  await listen(page);
  await page.mouse.click(300, 200);
  await expect.poll(() => lastPick(page)).toEqual({ kind: "star", id: "2061" });
  // the zoom range: 500 at most unless the page raises it, up to 8000
  await chart(page).evaluate((el) => el.setAttribute("zoom", "1200"));
  await expect.poll(async () => (await view(page)).zoom).toBe(500);
  await chart(page).evaluate((el) => el.setAttribute("zoom-max", "8000"));
  await chart(page).evaluate((el) => el.setAttribute("zoom", "1200"));
  await expect.poll(async () => (await view(page)).zoom).toBe(1200);
});

// What else a tap lands on. The stars are held back (magnitude -5) so that the tap in the middle finds the thing under test.
for (const { name, body, at, pick } of [
  { name: "a deep-sky object", body: `layers="deep" magnitude="-5" ra="10.6847" dec="41.269" zoom="12"`, at: [300, 200], pick: { kind: "deep", id: "M31" } },
  { name: "a black hole", body: `layers="holes" magnitude="-5" ra="299.5903" dec="35.2016" zoom="12"`, at: [300, 200], pick: { kind: "hole", id: "cygnus-x-1" } },
  // an asterism is a figure with no constellation of its own: the belt, in the middle of Orion
  { name: "a figure", body: `layers="lines" magnitude="-5" ra="84" dec="0" zoom="4"`, at: [300, 200], pick: { kind: "figure", id: "orions-belt" } },
  { name: "nothing, outside the sky's disc", body: `projection="orthographic" zoom="1" magnitude="-5"`, at: [6, 6], pick: { kind: "none", id: null } },
] as const) {
  test(`a tap on ${name} says so`, async ({ page }) => {
    await chartPage(page, `<hoshi-chart ${body} style="width:600px;height:400px"></hoshi-chart>`);
    await expect.poll(() => chart(page).evaluate((el) => el.shadowRoot?.querySelector("svg")?.innerHTML.length ?? 0)).toBeGreaterThan(200);
    await expect.poll(() => hands(page)).toBe(true);
    await listen(page);
    await page.mouse.click(at[0], at[1]);
    await expect.poll(() => lastPick(page)).toEqual(pick);
  });
}

test("the page's own picked and constellation win again after a tap", async ({ page }) => {
  // a star tap marks Betelgeuse in the middle; the page then picks Bellatrix, to the right of it
  await chartPage(page, `<hoshi-chart ra="88.79" dec="7.41" zoom="4" style="width:600px;height:400px"></hoshi-chart>`);
  await expect.poll(() => drawn(page)).toBeGreaterThan(5);
  await listen(page);
  await page.mouse.click(300, 200);
  await expect.poll(() => lastPick(page)).toEqual({ kind: "star", id: "2061" });
  await expect.poll(async () => Math.round((await middleOf(page, PICK_RING))?.x ?? -1)).toBe(300);
  await chart(page).evaluate((el) => el.setAttribute("picked", "1790"));
  await expect.poll(async () => (await middleOf(page, PICK_RING))?.x ?? -1).toBeGreaterThan(330);
  // a figure tap in the middle of Orion, its stars held back, shows Orion; the page then asks for Gemini, up and to the left
  const drew = await draws(page);
  await chart(page).evaluate((el) => {
    el.setAttribute("magnitude", "-5");
    el.setAttribute("ra", "84");
    el.setAttribute("dec", "3.5");
  });
  await expect.poll(() => draws(page)).toBeGreaterThan(drew);
  await page.mouse.click(300, 200);
  await expect.poll(() => lastPick(page)).toEqual({ kind: "figure", id: "Ori", abbreviation: "Ori" });
  await expect.poll(async () => Math.abs(((await middleOf(page, LINES_ON))?.x ?? 999) - 300)).toBeLessThan(80);
  await chart(page).evaluate((el) => el.setAttribute("constellation", "Gem"));
  await expect.poll(async () => (await middleOf(page, LINES_ON))?.x ?? 999).toBeLessThan(220);
  expect((await middleOf(page, LINES_ON))!.y).toBeLessThan(150);
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

test('controls="none" is a still picture: drawn, not in the tab order, and a drag moves nothing', async ({ page }) => {
  await chartPage(page, `<hoshi-chart controls="none" style="width:640px;height:400px"></hoshi-chart>`);
  await expect.poll(() => drawn(page)).toBeGreaterThan(100);
  expect(await hands(page)).toBe(false);
  expect(await chart(page).evaluate((el) => el.hasAttribute("tabindex"))).toBe(false);
  const start = await view(page);
  await drag(page);
  await page.waitForTimeout(300);
  expect(await view(page)).toEqual(start);
  // turned on, it has hands
  await chart(page).evaluate((el) => el.removeAttribute("controls"));
  await expect.poll(() => hands(page)).toBe(true);
});

test("moved to another place on the page it keeps its hands, and a new size keeps the same ones", async ({ page }) => {
  await chartPage(page, `<div id="a"><hoshi-chart style="width:640px;height:400px"></hoshi-chart></div><div id="b"></div>`);
  await expect.poll(() => hands(page)).toBe(true);
  // a new size tells the hands the new fit: the same controller, not a new one
  await chart(page).evaluate((el) => ((window as unknown as { first: unknown }).first = Reflect.get(el, "controller")));
  await chart(page).evaluate((el) => (el.style.width = "600px"));
  await expect.poll(() => chart(page).evaluate((el) => el.shadowRoot!.querySelector("svg")!.getAttribute("viewBox"))).toBe("0 0 600 400");
  expect(await chart(page).evaluate((el) => Reflect.get(el, "controller") === (window as unknown as { first: unknown }).first)).toBe(true);
  // taken off the page it lets go; the same element put back elsewhere has hands again and moves
  const away = await page.evaluate(() => {
    const element = document.querySelector("hoshi-chart")!;
    (window as unknown as { held: Element }).held = element;
    element.remove();
    return Reflect.get(element, "controller") === undefined;
  });
  expect(away).toBe(true);
  await page.evaluate(() => {
    // the same size as before: nothing but the reconnection brings the hands back
    document.getElementById("b")!.append((window as unknown as { held: HTMLElement }).held);
  });
  await expect.poll(() => hands(page)).toBe(true);
  const start = await view(page);
  await drag(page);
  await expect.poll(async () => Math.abs((await view(page)).ra - start.ra)).toBeGreaterThan(1);
});
