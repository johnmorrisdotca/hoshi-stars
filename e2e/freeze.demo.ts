// The constellation in 3D must never ask a lot of the machine (the family's rule: no 3D release without a freeze test). Played in headless Chromium, drawing in software, these fail on: more than one animation frame asked for
// at a time, a draw when nothing moves or the view is out of sight or the tab is hidden, more than 30 frames drawn a second while it turns, live WebGL objects that grow over a run of constellations, viewpoints and looks,
// more than one WebGL context, and a canvas past 6 million pixels or 4096 a side on a 5K screen at a pixel ratio of 2. `pnpm test:freeze` runs it; CI and the release run it.
import { canvasSize, COUNT_SCRIPT, gpuObjects, readCounts, withinPixelBudget } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({ browserName }, info) => {
  test.skip(browserName !== "chromium" || info.project.name !== "chromium-desk", "WebGL is drawn in the desk Chromium here, in software");
});
test.describe.configure({ mode: "serial" });

const PAGE = "/hoshi-stars/constellation-3d.html";

async function open(page: Page, query = ""): Promise<void> {
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`${PAGE}${query}`);
  await page.locator("#sp-stage[data-state=live]").waitFor({ timeout: 60_000 });
  await expect.poll(async () => (await readCounts(page)).draws).toBeGreaterThan(0);
  await page.waitForTimeout(800);
}

/** Frames the renderer has drawn (its own count). */
const framesDrawn = (page: Page) => page.locator("#sp-view").evaluate((el) => (Reflect.get(el, "stats") as { draws: number }).draws);

const bounded = async (page: Page, ms: number, during?: () => Promise<void>) => {
  const start = await readCounts(page);
  const framesStart = await framesDrawn(page);
  const began = Date.now();
  await Promise.all([page.waitForTimeout(ms), during?.()]);
  const end = await readCounts(page);
  const seconds = (Date.now() - began) / 1000;
  return { seconds, frames: (await framesDrawn(page)) - framesStart, draws: end.draws - start.draws, requests: end.rafRequests - start.rafRequests, callbacks: end.rafCallbacks - start.rafCallbacks, outstanding: end.rafRequests - end.rafCallbacks };
};

test("at rest nothing is drawn and no frame is asked for", async ({ page }) => {
  await open(page);
  const rest = await bounded(page, 3000);
  expect(rest.draws).toBe(0);
  expect(rest.frames).toBe(0);
  expect(rest.requests).toBeLessThanOrEqual(2);
});

test.describe("turning", () => {
  test.use({ reducedMotion: "no-preference" });

  test("it draws at most 30 frames a second while a hand turns it, and asks for one frame at a time", async ({ page }) => {
    await open(page);
    const box = (await page.locator("#sp-view").boundingBox())!;
    const turning = await bounded(page, 3000, async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      // a hand at about 100 moves a second
      for (let i = 0; i < 300; i += 1) {
        await page.mouse.move(box.x + box.width / 2 + 160 * Math.sin(i / 20), box.y + box.height / 2 + 40 * Math.cos(i / 30));
        await page.waitForTimeout(8);
      }
      await page.mouse.up();
    });
    expect(turning.frames, "frames drawn").toBeGreaterThan(5);
    expect(turning.frames, `no more than 30 a second, over ${turning.seconds.toFixed(1)} seconds`).toBeLessThanOrEqual(turning.seconds * 30 + 4);
    expect(turning.draws, "GL draw calls for each frame drawn").toBeLessThanOrEqual(Math.max(1, turning.frames) * 12);
    expect(turning.requests, "no more frames asked for than the page ran").toBeLessThanOrEqual(turning.callbacks + 3);
    expect(turning.outstanding, "one request waiting at a time").toBeLessThanOrEqual(3);
  });

  test("Turn 90° eases over a few frames at most 30 a second, then rests: nothing is drawn after it settles", async ({ page }) => {
    await open(page);
    const turned = await bounded(page, 1500, () => page.getByTestId("sp-turn").click());
    expect(turned.frames).toBeGreaterThan(2);
    expect(turned.frames).toBeLessThanOrEqual(turned.seconds * 30 + 4);
    await page.waitForTimeout(500);
    const rest = await bounded(page, 2000);
    expect(rest.draws).toBe(0);
    expect(rest.frames).toBe(0);
  });

  test("out of sight, and in a hidden tab, it draws nothing and asks for nothing", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "6000px";
      document.body.prepend(spacer);
      window.scrollTo(0, 0);
    });
    await expect.poll(async () => page.locator("#sp-view").evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(1000);
    await page.waitForTimeout(800);
    // a turn while it is out of sight is applied but not drawn
    const away = await bounded(page, 2500, () => page.getByTestId("sp-turn").evaluate((el) => (el as HTMLButtonElement).click()));
    expect(away.draws, "no GL draws out of sight").toBe(0);
    expect(away.frames).toBe(0);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(500);
    const hidden = await bounded(page, 2500, () => page.getByTestId("sp-turn").evaluate((el) => (el as HTMLButtonElement).click()));
    expect(hidden.draws, "no GL draws in a hidden tab").toBe(0);
    expect(hidden.frames).toBe(0);
  });
});

test("on a 5K screen at a pixel ratio of 2 its canvas stays inside 6 million pixels and 4096 a side", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const page = await context.newPage();
  await open(page);
  await page.locator("#sp-stage").evaluate((el) => {
    el.style.cssText += ";position:fixed;inset:0;width:2560px;height:1440px;max-width:none;z-index:9";
  });
  await page.waitForTimeout(2000);
  const size = await canvasSize(page);
  expect(size.count).toBe(1);
  expect(withinPixelBudget(size)).toBe(true);
  expect((await readCounts(page)).contexts, "one WebGL context").toBe(1);
  await context.close();
});

test("changing the constellation, the viewpoint and the look over and over gives back what it took: GPU objects stay flat in the one context", async ({ page }) => {
  await open(page);
  const tiles = ["Ori", "UMa", "Hya", "Cru", "Cas", "Sco", "CMa", "Dra"];
  const settled: number[] = [];
  for (let round = 0; round < 24; round += 1) {
    const abbreviation = tiles[round % tiles.length]!;
    await page.getByTestId("picker-strip").locator(`button[data-abbr="${abbreviation}"]`).click();
    await expect(page.getByTestId("sp-table").locator("tbody tr").first()).toBeVisible();
    await page.getByTestId("sp-from").selectOption(round % 3 === 1 ? "HR5459" : "");
    await page.evaluate((light) => document.documentElement.setAttribute("data-theme", light ? "light" : "dark"), round % 2 === 0);
    await page.getByTestId("sp-turn").click();
    await page.locator("#sp-stage[data-state=live]").waitFor();
    // the shared assets are let go a second after a view leaves; count when they have been
    await page.waitForTimeout(1600);
    const counted = await readCounts(page);
    settled.push(gpuObjects(counted));
    expect(counted.contexts, "one WebGL context for the page, however it changes").toBe(1);
  }
  console.log(`live GPU objects after each round: ${settled.join(", ")}`);
  // The first rounds warm the page up (the first shaders), so the baseline is the third.
  expect(Math.max(...settled.slice(2)), "no more GPU objects after 24 rounds than after the third, give or take three.js's own fixtures").toBeLessThanOrEqual(settled[2]! + 4);
});
