// The gallery of all 88 constellations, a constellation's own page, and the way on to the map.
import { expect, test, type Page } from "@playwright/test";

const SITE = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const tiles = (page: Page) => page.getByTestId("gallery-grid").locator("a");

test("the gallery shows 24 pictures a page, with search and pages kept in the address", async ({ page }) => {
  await page.goto(`${SITE}constellations.html`);
  await expect(tiles(page)).toHaveCount(24);
  await expect(page.getByTestId("gallery-count")).toHaveText("88 of 88");
  await expect(tiles(page).first().locator("img")).toHaveAttribute("src", /thumbnails\/png\/480\/(light|dark)\/And\.png$/);
  await expect.poll(() => tiles(page).first().locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(480);
  const pager = page.getByTestId("gallery-pager");
  await expect(pager.locator("button")).toHaveCount(6);
  await pager.getByRole("button", { name: "Page 4 of 4" }).click();
  await expect(tiles(page)).toHaveCount(16);
  await expect.poll(() => param(page, "page")).toBe("4");
  await expect(tiles(page).last()).toHaveAttribute("data-abbr", "Vul");
  const search = page.getByTestId("gallery-search");
  await search.fill("ursa");
  await expect(tiles(page)).toHaveCount(2);
  await expect(page.getByTestId("gallery-count")).toHaveText("2 of 88");
  await expect.poll(() => param(page, "q")).toBe("ursa");
  await expect.poll(() => param(page, "page")).toBeNull();
  await search.fill("おおいぬ");
  await expect(tiles(page)).toHaveCount(1);
  await search.fill("zzz");
  await expect(tiles(page)).toHaveCount(0);
  await expect(page.locator("#gl-none")).toBeVisible();
});

test("a tile opens the constellation's own page, with its picture, facts, stars and Messier objects", async ({ page }) => {
  await page.goto(`${SITE}constellations.html?q=great+bear`);
  await tiles(page).first().click();
  await expect(page).toHaveURL(/constellation\.html\?c=UMa$/);
  await expect(page.getByTestId("cp-name")).toHaveText("Ursa Major");
  const image = page.getByTestId("cp-image");
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1200);
  const facts = page.getByTestId("cp-facts");
  await expect(facts).toContainText("Great Bear");
  await expect(facts).toContainText("おおぐま座");
  await expect(facts).toContainText("Northern sky");
  await expect(facts).toContainText("May");
  await expect(facts).toContainText("Big Dipper");
  await expect(facts).toContainText("Ptolemy");
  await expect(page.getByTestId("cp-stars")).toContainText("Dubhe");
  await expect(page.getByTestId("cp-messier")).toContainText("M81");
  await expect(page.getByTestId("cp-messier")).toContainText("M101");
});

test("Open on the map flies the sky map to the constellation and picks it", async ({ page }) => {
  await page.goto(`${SITE}constellation.html?c=Ori`);
  await page.getByTestId("cp-map").click();
  await expect.poll(() => param(page, "pick")).toBe("C:Ori");
  await expect(page.getByTestId("picked").locator("h3")).toHaveText("Orion");
  await expect.poll(() => param(page, "go")).toBeNull();
  await expect(page.locator("#chart circle").first()).toBeVisible();
});

test("a star or a Messier object on the page opens the map on it", async ({ page }) => {
  await page.goto(`${SITE}constellation.html?c=Tau`);
  await page.getByTestId("cp-messier").getByRole("link", { name: /M1 / }).click();
  await expect.poll(() => param(page, "pick")).toBe("D:M1");
  await expect(page.getByTestId("picked").locator("h3")).toContainText("M1");
});

test("an unknown constellation says so; the Japanese page is in Japanese; next and previous lead on", async ({ page }) => {
  await page.goto(`${SITE}constellation.html?c=Zzz`);
  await expect(page.locator("#cp-missing")).toBeVisible();
  await page.goto(`${SITE}constellation.html?c=Ori&lang=ja`);
  await expect(page.getByTestId("cp-name")).toHaveText("オリオン座");
  await expect(page.getByTestId("cp-facts")).toContainText("狩人");
  await page.locator("#cp-next").click();
  await expect(page).toHaveURL(/c=Pav$/);
  await page.locator("#cp-prev").click();
  await expect(page).toHaveURL(/c=Ori$/);
});
