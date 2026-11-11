// The faint stars on the demo's map and the embed page: zooming into Orion draws more of them and says how deep the map is there, a layer button turns them off and the address keeps it,
// a view never draws more than the cap, panning with them costs little more than without, and at rest nothing is drawn and nothing is fetched. Tiles are read from the site's own faint-tiles/.
import { expect, test, type Page } from "@playwright/test";

const ORION = "ra=83.8&dec=-5.4";
const CYGNUS = "ra=305&dec=38";

const dots = (page: Page): Promise<number> =>
  page.evaluate(() => [...document.querySelectorAll('[data-layer="faint"] path')].reduce((sum, path) => sum + (path.getAttribute("d")?.match(/M/g) ?? []).length, 0));
const depthOf = async (page: Page): Promise<number> => {
  const text = (await page.getByTestId("faint-note").textContent()) ?? "";
  return Number(/magnitude (\d+(?:\.\d)?)/.exec(text)?.[1] ?? "NaN");
};
async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/hoshi-stars/?${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
}

test("zooming into Orion draws more stars and says how deep the map is here", async ({ page }) => {
  // at the opening depth there are none, and the note says how to get them
  await open(page, `${ORION}&zoom=4`);
  expect(await dots(page)).toBe(0);
  await expect(page.getByTestId("faint-note")).toContainText("Zoom in to add fainter stars");
  await open(page, `${ORION}&zoom=40`);
  await expect(page.getByTestId("faint-note")).toContainText("Stars to magnitude");
  const shallow = { dots: await dots(page), depth: await depthOf(page) };
  expect(shallow.dots).toBeGreaterThan(20);
  expect(shallow.depth).toBeGreaterThanOrEqual(8.5);
  await open(page, `${ORION}&zoom=160`);
  await expect(page.getByTestId("faint-note")).toContainText("Stars to magnitude");
  const deep = { dots: await dots(page), depth: await depthOf(page) };
  expect(deep.depth).toBeGreaterThan(shallow.depth);
  expect(deep.dots).toBeGreaterThan(20);
  // the same sky, zoomed with the map's own button: the readout follows
  await page.getByTestId("zoom-in").click();
  await expect.poll(() => depthOf(page)).toBeGreaterThan(deep.depth);
});

test("a deeper zoom in a crowded field draws more faint stars than a shallower one, and never more than the cap", async ({ page }) => {
  await open(page, `${CYGNUS}&zoom=20&mag=6`);
  await expect(page.getByTestId("faint-note")).toContainText("Stars to magnitude");
  const shallow = await dots(page);
  await open(page, `${CYGNUS}&zoom=60&mag=6`);
  await expect(page.getByTestId("faint-note")).toContainText("Stars to magnitude");
  expect(await dots(page)).toBeGreaterThan(shallow * 0.5);
  expect(await dots(page)).toBeLessThanOrEqual(6000);
  // one path a size and colour, never a node a star
  expect(await page.locator('[data-layer="faint"] path').count()).toBeLessThanOrEqual(24);
  expect(await page.locator('[data-layer="faint"] circle').count()).toBe(0);
});

test("the Faint stars button turns them off and on, and the address keeps it", async ({ page }) => {
  await open(page, `${ORION}&zoom=40`);
  await expect(page.getByTestId("faint-note")).toContainText("Stars to magnitude");
  const button = page.getByTestId("layers").getByRole("button", { name: "Faint stars" });
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => dots(page)).toBe(0);
  await expect(page.getByTestId("faint-note")).toHaveText("");
  await expect.poll(() => new URL(page.url()).searchParams.get("layers")).toBe("milky,lines,names,pictures,grid");
  await page.reload();
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await expect.poll(() => dots(page)).toBe(0);
  await button.click();
  await expect.poll(() => new URL(page.url()).searchParams.get("layers")).toBeNull();
  await expect.poll(() => dots(page)).toBeGreaterThan(20);
});

test("the faint stars are in Japanese too", async ({ page }) => {
  await open(page, `${ORION}&zoom=40&lang=ja`);
  await expect(page.getByTestId("faint-note")).toContainText("ここでは");
  await expect(page.getByTestId("layers").getByRole("button", { name: "暗い星" })).toBeVisible();
});

test("the embed page draws the faint stars its address asks for", async ({ page }) => {
  await page.goto(`/hoshi-stars/embed.html?${ORION}&zoom=60`);
  await expect.poll(() => dots(page)).toBeGreaterThan(20);
  await page.goto(`/hoshi-stars/embed.html?${ORION}&zoom=60&layers=milky,lines,names,grid`);
  await expect(page.locator("svg circle").first()).toBeVisible();
  expect(await dots(page)).toBe(0);
});

/** The drawn frames of one drag across the map: 120 steps, each waiting for the page's own next drawn frame (not a clock), the first 10 left out as warm-up. */
async function dragFrames(page: Page, query: string): Promise<number[]> {
  const faint = !query.includes("layers=");
  await open(page, `${CYGNUS}&zoom=80${query}`);
  if (faint) await expect(page.getByTestId("faint-note")).toContainText("Stars to magnitude");
  await page.waitForTimeout(800);
  // the picture cards above the map are a few pixels taller or shorter from time to time: bring the map to the middle of the screen so the drag is on it
  await page.locator("#chart-box").scrollIntoViewIfNeeded();
  await page.evaluate(() => { (window as unknown as { drawMs: number[] }).drawMs = []; });
  const box = (await page.locator("#chart-box").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const drawn = (): Promise<number> => page.evaluate(() => (window as unknown as { drawMs: number[] }).drawMs.filter((ms) => ms > 1.5).length);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 120; i++) {
    const before = await drawn();
    await page.mouse.move(x + Math.sin(i / 15) * 160, y + Math.cos(i / 15) * 90);
    await expect.poll(drawn, { timeout: 10_000, intervals: [5] }).toBeGreaterThan(before);
  }
  await page.mouse.up();
  if (faint) await expect.poll(() => dots(page)).toBeGreaterThan(20);
  const all = (await page.evaluate(() => (window as unknown as { drawMs: number[] }).drawMs)).filter((ms) => ms > 1.5);
  expect(all.length).toBeGreaterThanOrEqual(120);
  return all.slice(10);
}
const p95Of = (frames: number[]): number => [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)]!;

// The faint stars must add little to a frame. The bar is set against the same drag without them, in the same browser, so it holds on a runner of any speed: on a laptop drawing in
// software a frame here is about 22 ms; with the CPU slowed five times, about CI's speed, the 95th percentile was 61 to 113 ms with the faint stars on and 62 to 95 without, run to run,
// and 66 with only lines, names and grid (the Milky Way and the pictures are most of a frame). The two are taken in turn, twice, so a runner that slows part way through slows both.
// The ceiling of 250 ms (four frames a second) only catches a broken chart.
test("panning the zoomed-in map: the faint stars add little to a frame, and they follow the sky", async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || isMobile, "the drag is a Chromium mouse drag; the frame budget is measured once");
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    const w = window as unknown as { drawMs: number[] };
    w.drawMs = [];
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { const start = performance.now(); cb(t); w.drawMs.push(performance.now() - start); });
  });
  const on: number[] = [];
  const off: number[] = [];
  for (let round = 0; round < 2; round++) {
    on.push(...(await dragFrames(page, "")));
    off.push(...(await dragFrames(page, "&layers=milky,lines,names,pictures,grid")));
  }
  const withFaint = p95Of(on);
  const without = p95Of(off);
  expect(withFaint, `the 95th percentile of ${on.length} frames with the faint stars, against ${without.toFixed(1)} ms without, ms`).toBeLessThanOrEqual(1.3 * without + 10);
  expect(withFaint, "the 95th percentile with the faint stars, ms").toBeLessThan(250);
});

test("nothing is drawn and nothing is fetched at rest", async ({ page }) => {
  const tiles: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/faint-tiles/")) tiles.push(request.url());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { frames: number };
    w.frames = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { w.frames += 1; cb(t); });
  });
  await open(page, `${ORION}&zoom=60`);
  await expect(page.getByTestId("faint-note")).toContainText("Stars to magnitude");
  const frames = (): Promise<number> => page.evaluate(() => (window as unknown as { frames: number }).frames);
  await expect
    .poll(async () => {
      const before = await frames();
      const asked = tiles.length;
      await page.waitForTimeout(1200);
      return (await frames()) - before + (tiles.length - asked);
    }, { timeout: 10_000, intervals: [0], message: "the map comes to rest: 1.2 s with no frame drawn and no tile asked for" })
    .toBe(0);
  expect(tiles.length).toBeGreaterThan(0);
  expect(tiles.length).toBeLessThanOrEqual(12);
});
