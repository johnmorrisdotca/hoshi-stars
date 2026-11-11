// Kana readings on the Chinese sky's names for a learner: off by default; on with the Readings switch, which only the Japanese page of the Chinese sky shows, or for one visit with
// readings=on in the address; only a press of the switch is kept, across a reload, and it is written only into the address of a page that shows the switch; the gallery, the list and the
// picker's strip all show them; and they stay legible at a phone's width.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const gallery = (page: Page, query: string) => page.goto(`${HOME}constellations.html?${query}`);
const rubies = (page: Page, selector: string) => page.locator(`${selector} ruby`);
/** The readings key once the page has written its address: a search typed after the page drew goes out in the same write as anything the page was waiting to write. */
async function writtenReadings(page: Page): Promise<string | null> {
  await page.getByTestId("gallery-search").fill("a");
  await expect.poll(() => param(page, "q")).toBe("a");
  const readings = param(page, "readings");
  await page.getByTestId("gallery-search").fill("");
  await expect.poll(() => param(page, "q")).toBeNull();
  return readings;
}

test("readings are off by default, and the switch shows only on the Japanese page of the Chinese sky", async ({ page }) => {
  await gallery(page, "culture=chinese&lang=ja");
  await expect(page.getByTestId("gallery-grid").locator("a").first()).toBeVisible();
  await expect(page.getByTestId("readings")).toBeVisible();
  await expect(page.getByTestId("readings")).toHaveText("ふりがな");
  await expect(page.getByTestId("readings")).toHaveAttribute("aria-pressed", "false");
  await expect(rubies(page, "main")).toHaveCount(0);
  await gallery(page, "culture=chinese&lang=en&readings=on");
  await expect(page.getByTestId("gallery-grid").locator("a").first()).toBeVisible();
  await expect(page.getByTestId("readings")).toBeHidden();
  await expect(rubies(page, "main")).toHaveCount(0);
  await gallery(page, "culture=japanese&lang=ja");
  await expect(page.getByTestId("gallery-grid").locator("a").first()).toBeVisible();
  await expect(page.getByTestId("readings")).toBeHidden();
});

test("readings=on puts kana over 三垣, 星官 and the mansions in the gallery, the list and the strip", async ({ page }) => {
  await gallery(page, "culture=chinese&lang=ja&readings=on");
  await expect(page.getByTestId("readings")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#gl-lede rt").first()).toHaveText("さんえん");
  await expect(page.getByTestId("gallery-mix").locator("rt")).toHaveText(["しゅく", "せいかん"]);
  await expect(page.locator("a[data-abbr='jiao3-xiu4'] .gl-name rt")).toHaveText("かくしゅく");
  await expect(page.locator("a[data-abbr='bei3-dou3'] .gl-name ruby")).toHaveCount(0);
  await page.goto(`${HOME}constellation-list.html?culture=chinese&lang=ja&readings=on`);
  await expect(page.locator("#ls-lede rt")).toHaveText(["さんえん", "にじゅうはっしゅく"]);
  await expect(page.locator("tr[data-abbr='kang4-xiu4'] .ls-name rt")).toHaveText("こうしゅく");
  await page.goto(`${HOME}?culture=chinese&lang=ja&readings=on`);
  await expect(page.getByTestId("picker-strip").locator("button[data-abbr='jiao3-xiu4'] rt")).toHaveText("かくしゅく");
  await expect(page.getByTestId("culture-note").locator("rt").first()).toHaveText("さんえん");
  await expect(page.getByTestId("readings")).toBeVisible();
});

test("the switch turns them on, writes the address, and the choice is kept across a reload", async ({ page }) => {
  await gallery(page, "culture=chinese&lang=ja");
  await expect(rubies(page, "#gl-lede")).toHaveCount(0);
  await page.getByTestId("readings").click();
  await expect(page.getByTestId("readings")).toHaveAttribute("aria-pressed", "true");
  await expect(rubies(page, "#gl-lede")).not.toHaveCount(0);
  await expect.poll(() => param(page, "readings")).toBe("on");
  await gallery(page, "culture=chinese&lang=ja");
  await expect(rubies(page, "#gl-lede")).not.toHaveCount(0);
  await expect.poll(() => param(page, "readings")).toBe("on");
  // kept on, the choice goes only into the address of a page that shows the switch, and follows a change of sky
  await gallery(page, "culture=chinese&lang=en");
  await expect(page.getByTestId("gallery-grid").locator("a").first()).toBeVisible();
  await expect(page.getByTestId("readings")).toBeHidden();
  expect(await writtenReadings(page)).toBeNull();
  await gallery(page, "lang=ja");
  await expect(page.getByTestId("gallery-grid").locator("a").first()).toBeVisible();
  await expect(page.getByTestId("readings")).toBeHidden();
  expect(await writtenReadings(page)).toBeNull();
  await page.getByTestId("cultures").getByRole("button", { name: "中国" }).click();
  await expect(rubies(page, "#gl-lede")).not.toHaveCount(0);
  await expect.poll(() => param(page, "readings")).toBe("on");
  await page.getByTestId("readings").click();
  await expect(rubies(page, "#gl-lede")).toHaveCount(0);
  await expect.poll(() => param(page, "readings")).toBeNull();
  await page.reload();
  await expect(page.getByTestId("readings")).toHaveAttribute("aria-pressed", "false");
  await expect(rubies(page, "#gl-lede")).toHaveCount(0);
});

test("a readings=on link turns them on for that visit only, and the device keeps its own choice", async ({ page }) => {
  await gallery(page, "culture=chinese&lang=ja&readings=on");
  await expect(rubies(page, "#gl-lede")).not.toHaveCount(0);
  await gallery(page, "culture=chinese&lang=ja");
  await expect(page.getByTestId("readings")).toHaveAttribute("aria-pressed", "false");
  await expect(rubies(page, "#gl-lede")).toHaveCount(0);
  expect(await writtenReadings(page)).toBeNull();
});

test("each reading has brackets for a browser that cannot set it above the word", async ({ page }) => {
  await gallery(page, "culture=chinese&lang=ja&readings=on");
  await expect(page.locator("a[data-abbr='jiao3-xiu4'] .gl-name rp")).toHaveText(["(", ")"]);
  await expect(page.locator("a[data-abbr='jiao3-xiu4'] .gl-name rp").first()).toBeHidden();
});

test("the readings are at least 10 pixels and the page does not overflow at a phone's width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gallery(page, "culture=chinese&lang=ja&readings=on");
  const reading = page.locator("a[data-abbr='jiao3-xiu4'] .gl-name rt");
  await expect(reading).toBeVisible();
  expect(await reading.evaluate((rt) => parseFloat(getComputedStyle(rt).fontSize))).toBeGreaterThanOrEqual(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("the sheets page links to the gallery with the readings on", async ({ page }) => {
  await page.goto(`${HOME}kids.html`);
  await expect(page.getByTestId("kids-gallery")).toHaveAttribute("href", "constellations.html?culture=chinese&readings=on");
});
