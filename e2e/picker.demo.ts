// The constellation picker above the sky map: 88 pictures with a search box; a tap flies the map there and picks the constellation.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const tiles = (page: Page) => page.getByTestId("picker-strip").locator("button:not([hidden])");
async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`${HOME}${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
}

test("the picker holds all 88 constellations with their pictures", async ({ page }) => {
  await open(page);
  await expect(tiles(page)).toHaveCount(88);
  const first = tiles(page).first();
  await expect(first).toHaveAttribute("data-abbr", "And");
  await expect(first.locator("img")).toHaveAttribute("src", /thumbnails\/png\/160\/(light|dark)\/And\.png$/);
  await expect.poll(() => first.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(160);
});

test("a tap on a tile flies the map there and picks the constellation", async ({ page }) => {
  await open(page);
  const before = Number(param(page, "ra") ?? 84);
  await tiles(page).filter({ hasText: "Cygnus" }).click();
  await expect.poll(() => param(page, "pick")).toBe("C:Cyg");
  await expect.poll(() => Math.abs(Number(param(page, "ra")) - before) > 60).toBe(true);
  expect(Number(param(page, "dec"))).toBeGreaterThan(30);
  expect(Number(param(page, "zoom"))).toBeGreaterThan(1.5);
  await expect(page.getByTestId("picked").locator("h3")).toHaveText("Cygnus");
  await expect(page.getByTestId("picker-strip").locator("button[aria-pressed='true']")).toHaveAttribute("data-abbr", "Cyg");
});

test("the search narrows the strip by English, Latin, Japanese or abbreviation, and Enter picks the first", async ({ page }) => {
  await open(page);
  const search = page.getByTestId("picker-search");
  await search.fill("ursa");
  await expect(tiles(page)).toHaveCount(2);
  await search.fill("おおぐま");
  await expect(tiles(page)).toHaveCount(1);
  await search.fill("zzz");
  await expect(tiles(page)).toHaveCount(0);
  await expect(page.locator("[data-pick-none]")).toBeVisible();
  await search.fill("Scorpius");
  await search.press("Enter");
  await expect.poll(() => param(page, "pick")).toBe("C:Sco");
});

test("the address ?go= opens the map on a constellation and takes itself out of the address", async ({ page }) => {
  await open(page, "?go=Cru");
  await expect.poll(() => param(page, "pick")).toBe("C:Cru");
  await expect.poll(() => param(page, "go")).toBeNull();
  expect(Number(param(page, "dec"))).toBeLessThan(-40);
});

test("the pictures follow the theme and the language", async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await expect(tiles(page).first().locator("img")).toHaveAttribute("src", /\/dark\//);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await expect(tiles(page).first().locator("img")).toHaveAttribute("src", /\/light\//);
  await open(page, "?lang=ja");
  await expect(page.getByTestId("picker-strip").locator("button[data-abbr='Ori']")).toHaveAccessibleName("オリオン座");
});
