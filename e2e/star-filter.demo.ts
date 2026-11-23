// The star filters in a real browser: the demo page's distance and brightness bars thin the stars, are kept in the address as short numbers, read their value aloud in English and Japanese, work from the keyboard, and keep the lines and names of the figures;
// the chart element's and the My sky element's own bars (`filter-bar`) write the attributes, send hoshi-filter, fold on a phone and never turn the sky under them. The flight's bars are in flight-filter.demo.ts.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const stars = (page: Page) => page.locator("#chart circle").count();
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test("the farthest bar keeps the stars inside it, says its value, and the address keeps it as a short number", async ({ page }) => {
  await page.goto(`${HOME}?ra=84&dec=0&zoom=2`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  const all = await stars(page);
  const far = page.getByTestId("flt-max");
  await expect(page.getByTestId("flt-max-out")).toHaveText("any");
  await far.fill("5");
  await expect(page.getByTestId("flt-max-out")).toHaveText("100 ly");
  await expect(far).toHaveAttribute("aria-valuetext", "100 ly");
  await expect.poll(() => stars(page)).toBeLessThan(all / 2);
  await expect.poll(() => param(page, "dmax")).toBe("100");
  await expect(page.getByTestId("flt-note")).toContainText("stars match");
  await expect(page.getByTestId("flt-note")).toContainText("no known distance");
  await page.getByTestId("flt-reset").click();
  await expect.poll(() => stars(page)).toBe(all);
  await expect.poll(() => param(page, "dmax")).toBeNull();
});

test("the nearest bar cannot pass the farthest, and a shell shows only the stars between", async ({ page }) => {
  await page.goto(`${HOME}?ra=84&dec=0&zoom=2&dmin=100&dmax=500`);
  await expect(page.getByTestId("flt-min-out")).toHaveText("100 ly");
  await expect(page.getByTestId("flt-max-out")).toHaveText("500 ly");
  const shell = await stars(page);
  const near = page.getByTestId("flt-min");
  await near.press("End");
  await expect(page.getByTestId("flt-max-out")).not.toHaveText("500 ly");
  expect(Number(await near.inputValue())).toBeLessThan(Number(await page.getByTestId("flt-max").inputValue()));
  expect(await stars(page)).not.toBe(shell);
});

test("the brightness bar hides fainter stars from the keyboard, and the constellation lines stay", async ({ page }) => {
  await page.goto(`${HOME}?ra=84&dec=0&zoom=2&layers=lines,names`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  const lines = await page.locator("#chart path").count();
  const all = await stars(page);
  const bar = page.getByTestId("flt-mag");
  await bar.focus();
  await bar.press("ArrowLeft");
  await expect(page.getByTestId("flt-mag-out")).toHaveText("6.5 mag");
  for (let i = 0; i < 6; i += 1) await bar.press("ArrowLeft");
  await expect(page.getByTestId("flt-mag-out")).toHaveText("3.5 mag");
  await expect.poll(() => stars(page)).toBeLessThan(all / 3);
  await expect.poll(() => param(page, "mlim")).toBe("3.5");
  expect(await page.locator("#chart path").count()).toBe(lines);
  await bar.press("End");
  await expect(page.getByTestId("flt-mag-out")).toHaveText("any");
  await expect.poll(() => stars(page)).toBe(all);
});

test("an address with the filters opens with them, in Japanese words too", async ({ page }) => {
  await page.goto(`${HOME}?lang=ja&dmax=100&mlim=5`);
  await expect(page.getByTestId("flt-max-out")).toHaveText("100光年");
  await expect(page.getByTestId("flt-mag-out")).toHaveText("5等");
  await expect(page.getByTestId("flt-min-out")).toHaveText("すべて");
  await expect(page.getByTestId("flt-note")).toContainText("個の星のうち");
  await expect(page.getByRole("group", { name: "距離でしぼりこむ（光年）" })).toBeVisible();
  expect(await noSideways(page)).toBe(true);
});

test("the filter goes into the chart's embed code", async ({ page }) => {
  await page.goto(`${HOME}?dmax=100&mlim=5`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  const frame = await page.locator("kazoku-embed-panel").evaluate((el) => (el as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot?.textContent ?? el.textContent ?? "");
  expect(frame).toContain("starPasses");
  expect(frame).toContain('"distanceMax":100');
  expect(frame).toContain('"magnitudeLimit":5');
});

const CHART = "/hoshi-stars/markers.html";
const chartFilter = (page: Page) => page.locator("hoshi-chart").first();
const barOf = (page: Page) => chartFilter(page).locator(".filters");

test("the chart element's bars write the attributes, send hoshi-filter and say their value aloud", async ({ page }) => {
  await page.goto(CHART);
  await expect.poll(() => chartFilter(page).evaluate((el) => el.shadowRoot?.querySelectorAll("svg circle").length ?? 0)).toBeGreaterThan(20);
  const count = () => chartFilter(page).evaluate((el) => el.shadowRoot!.querySelectorAll("svg circle:not([data-marker] circle)").length);
  const before = await count();
  await page.evaluate(() => {
    const el = document.querySelector("hoshi-chart")!;
    (window as unknown as { said: unknown[] }).said = [];
    el.addEventListener("hoshi-filter", (event) => (window as unknown as { said: unknown[] }).said.push((event as CustomEvent).detail));
    el.setAttribute("filter-bar", "open");
  });
  const far = barOf(page).locator('[data-bar="max"]');
  await expect(far).toHaveAttribute("aria-valuetext", "any");
  await far.focus();
  await far.press("ArrowLeft");
  await expect(chartFilter(page)).toHaveAttribute("distance-max", "2000");
  await expect(far).toHaveAttribute("aria-valuetext", "2,000 ly");
  await far.press("Home");
  await expect(chartFilter(page)).toHaveAttribute("distance-max", "5");
  await expect.poll(count).toBeLessThan(before);
  const said = await page.evaluate(() => (window as unknown as { said: Array<{ distanceMax?: number; final: boolean }> }).said);
  expect(said.at(-1)?.distanceMax).toBe(5);
  await barOf(page).locator(".bar-reset").click();
  await expect(chartFilter(page)).not.toHaveAttribute("distance-max", /.*/);
  await expect.poll(count).toBe(before);
});

test("a press on the chart's bars does not move the chart", async ({ page }) => {
  await page.goto(CHART);
  await page.evaluate(() => document.querySelector("hoshi-chart")!.setAttribute("filter-bar", "open"));
  const view = () => chartFilter(page).evaluate((el) => JSON.stringify((el as unknown as { view: unknown }).view));
  const before = await view();
  const bar = await barOf(page).locator('[data-bar="mag"]').boundingBox();
  await page.mouse.move(bar!.x + 4, bar!.y + bar!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar!.x + bar!.width * 0.4, bar!.y + bar!.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  expect(await view()).toBe(before);
  await expect(chartFilter(page)).toHaveAttribute("magnitude-limit", /.+/);
});

test("the My sky bars thin the stars, keep the figures, and the address keeps them", async ({ page }) => {
  await page.goto("/hoshi-stars/my-sky.html?place=vancouver&t=2026-11-17T04:00:00Z");
  const sky = page.locator("hoshi-my-sky");
  await expect(sky).toHaveAttribute("filter-bar", "open");
  const bright = () =>
    sky.evaluate((el) => {
      const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>("canvas.sky")!;
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i]! + data[i + 1]! + data[i + 2]! > 330) lit += 1;
      return lit;
    });
  await expect.poll(bright).toBeGreaterThan(50);
  const before = await bright();
  const mag = sky.locator('[data-bar="mag"]');
  await mag.focus();
  for (let i = 0; i < 7; i += 1) await mag.press("ArrowLeft");
  await expect(mag).toHaveAttribute("aria-valuetext", "3.5 mag");
  await expect(sky).toHaveAttribute("magnitude-limit", "3.5");
  await expect.poll(bright).toBeLessThan(before);
  await mag.press("Tab");
  await expect.poll(() => param(page, "mlim")).toBe("3.5");
  await sky.locator(".bar-reset").click();
  await expect.poll(() => param(page, "mlim")).toBeNull();
  await expect(sky.locator(".bar-count")).not.toBeEmpty();
});

test("on a phone the bars fit, and a folded bar opens with its button", async ({ page }, info) => {
  test.skip(!info.project.name.endsWith("phone"), "a phone's width");
  await page.goto(CHART);
  await page.evaluate(() => document.querySelector("hoshi-chart")!.setAttribute("filter-bar", ""));
  const toggle = barOf(page).locator(".bar-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const box = await barOf(page).boundingBox();
  const host = await chartFilter(page).boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(host!.x);
  expect(box!.x + box!.width).toBeLessThanOrEqual(host!.x + host!.width + 1);
  expect(await noSideways(page)).toBe(true);
});
