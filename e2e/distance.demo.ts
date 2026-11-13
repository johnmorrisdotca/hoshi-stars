// The sky out to a distance on the map: off until chosen; a limit keeps the nearer stars and galaxies, each in the colour of its band, with the ones whose distance is uncertain as rings and the ones with none left out; the legend counts what is drawn; the choice is kept in the address, in English and Japanese.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const EMBED = "/hoshi-stars/embed.html";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const marks = (page: Page, where: string) => page.locator(`${where} [data-dist-band]`);

/** The numbers in the legend: each band's count, the uncertain count, and the count with no distance. */
async function legend(page: Page, where: string): Promise<{ bands: number[]; uncertain: number; unknown: number }> {
  return page.locator(where).evaluate((list) => {
    const number = (text: string | null | undefined): number => Number((text ?? "").replace(/[^\d]/g, ""));
    const bands = [0, 1, 2, 3, 4, 5].map((i) => number(list.querySelector(`li[data-band="${i}"] .dist-count`)?.textContent));
    return { bands, uncertain: number(list.querySelector('li[data-band="uncertain"] .dist-count')?.textContent), unknown: number(list.querySelector('li[data-band="unknown"]')?.textContent?.split(":")[1]) };
  });
}

test.describe("the embed page, the whole sky on one map", () => {
  const whole = (limit: string, more = "") => `${EMBED}?dist=${limit}&proj=hammer&ra=180&dec=0&zoom=1&layers=none${more}`;
  async function open(page: Page, query: string): Promise<void> {
    await page.goto(query);
    await expect(page.locator("html[data-ready='true']")).toHaveCount(1);
    await expect(marks(page, "#sky").first()).toBeVisible({ timeout: 30_000 });
  }

  test("nothing is limited until the address asks, and the legend is out of sight", async ({ page }) => {
    await page.goto(`${EMBED}?proj=hammer&ra=180&dec=0&zoom=1`);
    await expect(page.locator("html[data-ready='true']")).toHaveCount(1);
    expect(await marks(page, "#sky").count()).toBe(0);
    await expect(page.getByTestId("dist-legend")).toBeHidden();
  });

  test("out to 10 light-years only the nearest stars are drawn, all in the first band, and each step out adds to the sky", async ({ page }) => {
    await open(page, whole("10"));
    const near = await legend(page, "#frame .dist-legend");
    expect(near.bands[0]).toBeGreaterThan(3);
    expect(near.bands.slice(1).every((n) => n === 0)).toBe(true);
    expect(await marks(page, "#sky").count()).toBe(near.bands[0]! + near.uncertain);
    expect(await page.locator('#sky [data-dist-band="0"]').count()).toBe(near.bands[0]);
    let before = near.bands.reduce((a, b) => a + b, 0) + near.uncertain;
    for (const limit of ["50", "100", "500", "1000"]) {
      await open(page, whole(limit));
      const layers = await legend(page, "#frame .dist-legend");
      const total = layers.bands.reduce((a, b) => a + b, 0) + layers.uncertain;
      expect(total, `out to ${limit}`).toBeGreaterThan(before);
      expect(await marks(page, "#sky").count(), `everything the legend counts is on the map at ${limit}`).toBe(total);
      before = total;
    }
  });

  test("a thing with no distance is never drawn, and one whose distance is uncertain is a ring and never a dot", async ({ page }) => {
    await open(page, whole("500"));
    const layers = await legend(page, "#frame .dist-legend");
    expect(layers.unknown, "the count with no distance is told").toBeGreaterThan(1000);
    expect(layers.uncertain).toBeGreaterThan(100);
    expect(await page.locator('#sky circle[data-dist-band="uncertain"]').count()).toBe(layers.uncertain);
    expect(await page.locator('#sky circle[data-dist-band="uncertain"][fill="none"]').count(), "every uncertain thing is a hollow ring").toBe(layers.uncertain);
    expect(await page.locator('#sky [data-dist-band]:not([data-dist-band="uncertain"])[fill="none"]').count(), "and no other thing is").toBe(0);
    expect(await marks(page, "#sky").count()).toBe(layers.bands.reduce((a, b) => a + b, 0) + layers.uncertain);
  });

  test("each band has its own colour, near to far", async ({ page }) => {
    await open(page, whole("all"));
    const colours = await page.evaluate(() => {
      const found: Record<string, string> = {};
      for (const node of document.querySelectorAll("#sky [data-dist-band]")) {
        const band = node.getAttribute("data-dist-band")!;
        if (band !== "uncertain") found[band] = node.getAttribute("fill")!;
      }
      return found;
    });
    expect(Object.keys(colours).length).toBeGreaterThanOrEqual(5);
    expect(new Set(Object.values(colours)).size, "no two bands share a colour").toBe(Object.keys(colours).length);
  });

  test("the legend is in Japanese on a Japanese embed", async ({ page }) => {
    await open(page, whole("100", "&lang=ja"));
    await expect(page.locator("#frame .dist-legend")).toContainText("光年");
    await expect(page.locator("#frame .dist-legend")).toContainText("距離がはっきりしない");
  });
});

test.describe("the demo's map", () => {
  async function open(page: Page, query = ""): Promise<void> {
    await page.goto(`${HOME}${query}`);
    await expect(page.locator("#chart circle").first()).toBeVisible();
  }
  const seg = (page: Page) => page.getByTestId("dist-seg");

  test("the sky is as it was until a distance is chosen: no layers, no legend, the faintest-star slider in use", async ({ page }) => {
    await open(page);
    await expect(seg(page).getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("dist-legend")).toBeHidden();
    expect(await marks(page, "#chart").count()).toBe(0);
    await expect(page.getByTestId("shown")).toContainText("1,630 stars shown");
  });

  test("choosing 100 light-years draws the layers, shows the legend and the note, and keeps the choice in the address", async ({ page }) => {
    await open(page);
    await seg(page).getByRole("button", { name: "100", exact: true }).click();
    await expect(marks(page, "#chart").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("dist-legend")).toBeVisible();
    await expect(page.getByTestId("dist-note")).toContainText("have no distance");
    await expect.poll(() => param(page, "dist")).toBe("100");
    await expect(seg(page).getByRole("button", { name: "100", exact: true })).toHaveAttribute("aria-pressed", "true");
    const layers = await legend(page, "#dist-legend");
    expect(layers.bands[0]! + layers.bands[1]! + layers.bands[2]!).toBeGreaterThan(500);
    expect(layers.bands.slice(3).every((n) => n === 0)).toBe(true);
    await page.reload();
    await expect(marks(page, "#chart").first()).toBeVisible({ timeout: 30_000 });
    await expect(seg(page).getByRole("button", { name: "100", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("Farther and Nearer step through 10, 50, 100, 500, 1,000 and all, and the slider sets a limit of its own", async ({ page }) => {
    await open(page, "?dist=100");
    await expect(marks(page, "#chart").first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("dist-farther").click();
    await expect.poll(() => param(page, "dist")).toBe("500");
    await page.getByTestId("dist-farther").click();
    await page.getByTestId("dist-farther").click();
    await expect.poll(() => param(page, "dist")).toBe("all");
    await expect(page.getByTestId("dist-out")).toHaveText("All");
    await page.getByTestId("dist-nearer").click();
    await expect.poll(() => param(page, "dist")).toBe("1000");
    await page.getByTestId("dist-slider").fill("300");
    await expect.poll(() => Number(param(page, "dist"))).toBeGreaterThan(4);
    await expect.poll(() => Number(param(page, "dist"))).toBeLessThan(10_000);
    await expect(page.getByTestId("dist-out")).toContainText("light-years");
    await seg(page).getByRole("button", { name: "Off" }).click();
    await expect.poll(() => param(page, "dist")).toBeNull();
    // the address and the buttons change at once; the map is redrawn on the next frame, so wait for it
    await expect(marks(page, "#chart")).toHaveCount(0);
  });

  test("the row and the legend are in Japanese on the Japanese page", async ({ page }) => {
    await open(page, "?lang=ja&dist=50");
    await expect(marks(page, "#chart").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("dist-seg").getByRole("button", { name: "すべて" })).toBeVisible();
    await expect(page.getByTestId("dist-legend")).toContainText("距離がはっきりしない");
    await expect(page.getByTestId("dist-note")).toContainText("距離がなくて描かない");
  });

  test("the embed code carries the limit, and its iframe address does too", async ({ page }) => {
    await open(page, "?dist=100");
    await expect(marks(page, "#chart").first()).toBeVisible({ timeout: 30_000 });
    const panel = page.getByTestId("embed-panel");
    await panel.scrollIntoViewIfNeeded();
    await panel.getByRole("tab", { name: /iframe/i }).click();
    await expect(panel).toContainText("dist=100");
  });
});
