// The list of all 88 with filters that combine, a count and Clear all.
import { expect, test, type Page } from "@playwright/test";

const LIST = "/hoshi-stars/constellation-list.html";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const rows = (page: Page) => page.getByTestId("list-table").locator("tbody tr");
const choose = (page: Page, group: string, label: string | RegExp) => page.locator(`[data-group="${group}"]`).getByRole("button", { name: label }).click();

test("the table holds all 88 with their pictures, and Clear all waits until a filter is on", async ({ page }) => {
  await page.goto(LIST);
  await expect(rows(page)).toHaveCount(88);
  await expect(page.getByTestId("list-count")).toHaveText("88 of 88 shown");
  await expect(page.getByTestId("list-clear")).toBeDisabled();
  await expect(rows(page).first().locator("img")).toHaveAttribute("src", /thumbnails\/png\/160\/(light|dark)\/And\.png$/);
  await expect.poll(() => rows(page).first().locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(160);
});

test("filters in a row add up, filters in different rows narrow each other, and the count follows", async ({ page }) => {
  await page.goto(LIST);
  await choose(page, "hemi", "Northern sky");
  await expect(page.getByTestId("list-count")).toHaveText("29 of 88 shown");
  await choose(page, "hemi", "Crosses the equator");
  await expect(page.getByTestId("list-count")).toHaveText("42 of 88 shown");
  await choose(page, "hemi", "Crosses the equator");
  await choose(page, "easy", "Easy");
  await expect(page.getByTestId("list-count")).toHaveText("10 of 88 shown");
  await choose(page, "shower", "Has some");
  await expect(page.getByTestId("list-count")).toHaveText("4 of 88 shown");
  await expect(rows(page).locator(".ls-name")).toHaveText(["Boötes", "Draco", "Gemini", "Perseus"]);
  await expect.poll(() => param(page, "hemi")).toBe("north");
  await expect.poll(() => param(page, "easy")).toBe("easy");
  await expect.poll(() => param(page, "shower")).toBe("yes");
  await expect(page.locator('[data-group="easy"] button[aria-pressed="true"]')).toHaveText("Easy");
});

test("the month, origin and asterism filters, and a combination with nothing in it", async ({ page }) => {
  await page.goto(LIST);
  await choose(page, "origin", /Lacaille/);
  await expect(page.getByTestId("list-count")).toHaveText("14 of 88 shown");
  await choose(page, "origin", /Lacaille/);
  await choose(page, "ast", "Has some");
  await expect(page.getByTestId("list-count")).toHaveText("28 of 88 shown");
  await choose(page, "month", "Jan");
  await expect(rows(page).first()).toBeVisible();
  await choose(page, "origin", /Southern voyages/);
  await choose(page, "easy", "Easy");
  await choose(page, "hemi", "Northern sky");
  await expect(page.getByTestId("list-count")).toHaveText("0 of 88 shown");
  await expect(page.locator("#ls-empty")).toBeVisible();
});

test("Clear all removes every filter, and the choices survive a reload", async ({ page }) => {
  await page.goto(`${LIST}?hemi=south&easy=easy,medium`);
  await expect(page.locator('[data-group="hemi"] button[aria-pressed="true"]')).toHaveText("Southern sky");
  await expect(page.locator('[data-group="easy"] button[aria-pressed="true"]')).toHaveCount(2);
  await expect(page.getByTestId("list-clear")).toBeEnabled();
  const n = Number((await page.getByTestId("list-count").innerText()).split(" ")[0]);
  expect(n).toBeGreaterThan(5);
  expect(n).toBeLessThan(40);
  await page.getByTestId("list-clear").click();
  await expect(page.getByTestId("list-count")).toHaveText("88 of 88 shown");
  await expect(page.locator('[data-group] button[aria-pressed="true"]')).toHaveCount(0);
  await expect.poll(() => param(page, "hemi")).toBeNull();
});

test("a row's name opens its page and its Map button opens the sky map on it", async ({ page }) => {
  await page.goto(`${LIST}?hemi=south&easy=easy&month=5`);
  await expect(rows(page).locator(".ls-name")).toHaveText(["Corvus", "Crux"]);
  await rows(page).filter({ hasText: "Crux" }).getByRole("link", { name: "Map" }).click();
  await expect.poll(() => param(page, "pick")).toBe("C:Cru");
  await expect(page.getByTestId("picked").locator("h3")).toHaveText("Crux");
  await page.goto(`${LIST}?hemi=south&easy=easy&month=5`);
  await rows(page).locator(".ls-name a", { hasText: "Crux" }).click();
  await expect(page).toHaveURL(/constellation\.html\?c=Cru$/);
});

test("in Japanese the filters and the table are in Japanese", async ({ page }) => {
  await page.goto(`${LIST}?lang=ja`);
  await expect(page.getByTestId("list-count")).toHaveText("88個 / 88");
  await expect(page.locator('[data-group="hemi"]').getByRole("button", { name: "北の空" })).toBeVisible();
  await expect(rows(page).first().locator(".ls-name")).toHaveText(/座|アンドロメダ/);
});
