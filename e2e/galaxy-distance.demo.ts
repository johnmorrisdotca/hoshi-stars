// A galaxy's card gives its distance and says where it comes from; the nearest and farthest galaxies are a list of ten, asked for by a click (it fetches the NGC and IC tier then, not before).
import { expect, test, type Page } from "@playwright/test";

async function fly(page: Page, text: string): Promise<void> {
  await page.fill("#search", text);
  await page.locator("#results button").first().click();
}

test("a galaxy's card shows its distance, its range where there are several values, and its source line", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await fly(page, "M87");
  const card = page.locator("#picked");
  await expect(card.locator("h3")).toContainText("M87");
  await expect(card.locator("dt", { hasText: "Distance" })).toHaveCount(1);
  await expect(card).toContainText("54 million light-years (16.5 Mpc)");
  await expect(card.getByTestId("distance-range")).toContainText("2 values");
  await expect(card.getByTestId("distance-source")).toHaveText("Compiled from Wikidata (CC0), method not stated.");
  await expect(card.getByTestId("distance-disagree")).toHaveCount(0);
  await fly(page, "M42");
  await expect(card.locator("dt", { hasText: "Distance" })).toHaveCount(0);
  await expect(card.getByTestId("distance-source")).toHaveCount(0);
});

test("a galaxy whose sources disagree says so", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await fly(page, "M74");
  await expect(page.locator("#picked").getByTestId("distance-disagree")).toContainText("The values disagree");
});

test("the card is in Japanese when the page is", async ({ page }) => {
  await page.goto("/hoshi-stars/?lang=ja");
  await fly(page, "M87");
  await expect(page.locator("#picked").getByTestId("distance-source")).toContainText("Wikidata (CC0)");
  await expect(page.locator("#picked")).toContainText("光年");
});

test("nearest and farthest galaxies are ten rows each, fetched on the first click, and a row opens that galaxy's card", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  const panel = page.getByTestId("galaxies");
  await expect(panel).toContainText("Choose nearest or farthest");
  await expect(panel.getByTestId("galaxies-list")).toHaveCount(0);
  await panel.locator('button[data-value="near"]').click();
  await expect(panel.getByTestId("galaxies-list").locator("li")).toHaveCount(10, { timeout: 30_000 });
  await expect(panel.getByTestId("galaxies-list").locator("li").first()).toContainText("Small Magellanic Cloud");
  await expect(panel.getByTestId("galaxies-note")).toContainText("Wikidata (CC0)");
  await panel.locator('button[data-value="far"]').click();
  const farthest = panel.getByTestId("galaxies-list").locator("li");
  await expect(farthest).toHaveCount(10);
  await expect(farthest.first()).toContainText("million light-years");
  await farthest.first().locator("button").click();
  await expect(page.locator("#picked").getByTestId("distance-source")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("gal")).toBe("far");
});
