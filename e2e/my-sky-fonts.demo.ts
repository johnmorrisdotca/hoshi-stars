// The My sky canvas reads the page's fonts: `--hoshi-label-font` (with `-size` and `-weight`) reaches the names it draws, `--hoshi-sky-font` the compass letters, the package's own font stays when the page sets nothing,
// and the Moon card has parts a page can style.
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/my-sky.html?place=vancouver&t=2026-11-17T04:00:00Z";

/** Remember every font the page's canvases are given. */
async function record(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { fonts: string[] }).fonts = seen;
    const own = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "font")!;
    Object.defineProperty(CanvasRenderingContext2D.prototype, "font", {
      get() {
        return own.get!.call(this);
      },
      set(value: string) {
        seen.push(value);
        own.set!.call(this, value);
      },
    });
  });
}
const fonts = (page: Page) => page.evaluate(() => (window as unknown as { fonts: string[] }).fonts);
const clear = (page: Page) => page.evaluate(() => ((window as unknown as { fonts: string[] }).fonts.length = 0));

test("a page's label font reaches the names on the canvas, and its sky font the compass letters", async ({ page }) => {
  await record(page);
  await page.goto(PAGE);
  const sky = page.locator("hoshi-my-sky");
  await expect(sky).toHaveAttribute("filter-bar", "open");
  await expect.poll(async () => (await fonts(page)).length).toBeGreaterThan(3);
  const before = await fonts(page);
  expect(before.every((font) => !font.includes("Georgia"))).toBe(true);
  expect(before.some((font) => font.includes("Hiragino Sans"))).toBe(true);

  await sky.evaluate((el) => {
    el.style.setProperty("--hoshi-label-font", "Georgia, serif");
    el.style.setProperty("--hoshi-label-size", "15px");
    el.style.setProperty("--hoshi-label-weight", "700");
    el.style.setProperty("--hoshi-sky-font", "Courier, monospace");
    (el as unknown as { setView(change: { heading: number }): void }).setView({ heading: 200 });
  });
  await clear(page);
  await expect.poll(async () => (await fonts(page)).some((font) => font.includes("Georgia"))).toBe(true);
  const after = await fonts(page);
  expect(after).toContain("700 15px Georgia, serif");
  expect(after.some((font) => font.includes("Courier") && /^(700|500) /.test(font))).toBe(true);
  expect(after.some((font) => font.includes("Hiragino Sans"))).toBe(false);
});

test("the Moon card and the filter bars have parts a page can style", async ({ page }) => {
  await page.goto(PAGE);
  const sky = page.locator("hoshi-my-sky");
  await expect(sky.locator('[part="title"]')).toBeVisible();
  await expect(sky.locator('[part="rows"]')).toBeVisible();
  await expect(sky.locator('[part="toggle"]')).toBeVisible();
  await page.addStyleTag({ content: "hoshi-my-sky::part(title) { font-size: 21px; } hoshi-my-sky::part(toggle) { border-radius: 2px; } hoshi-my-sky::part(filters-title) { letter-spacing: 3px; }" });
  await expect(sky.locator('[part="title"]')).toHaveCSS("font-size", "21px");
  await expect(sky.locator('[part="toggle"]')).toHaveCSS("border-top-left-radius", "2px");
  await expect(sky.locator('[part="filters-title"]')).toHaveCSS("letter-spacing", "3px");
  for (const part of ["filters", "filters-toggle", "filters-group", "filters-legend", "filters-label", "filters-range", "filters-count", "filters-reset"]) expect(await sky.locator(`[part~="${part}"]`).count()).toBeGreaterThan(0);
});
