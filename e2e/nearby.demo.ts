// The Nearby panel: pick a star, a Messier object or a constellation and its neighbours are listed, in the sky or in space, and ringed on the chart; the embed page rings them too.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const NEAR = "#5fe0c4";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${HOME}${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
}
const rows = (page: Page) => page.getByTestId("nearby-list").locator("button");

test("a picked star lists its nearest stars in the sky and rings them on the chart", async ({ page }) => {
  await open(page, "?pick=S:5054&ra=201&dec=55&zoom=40");
  await expect(rows(page)).toHaveCount(10);
  await expect(rows(page).nth(1)).toContainText("Alcor");
  await expect(rows(page).nth(1)).toContainText("0.20 degrees");
  await expect(page.getByTestId("nearby-by").locator("button[aria-pressed='true']")).toHaveText("In the sky");
  await expect(page.locator(`#chart circle[stroke='${NEAR}']`).first()).toBeVisible();
});

test("In space lists the nearest stars in light-years, says how many have no distance, and is kept in the address", async ({ page }) => {
  await open(page, "?pick=S:2491");
  await page.getByTestId("nearby-by").getByRole("button", { name: "In space" }).click();
  await expect(rows(page).first()).toContainText("Procyon");
  await expect(rows(page).first()).toContainText("5.1 light-years");
  await expect(page.getByTestId("nearby-note")).toContainText("2,547 stars have no distance");
  await expect.poll(() => param(page, "by")).toBe("space");
  await page.getByTestId("nearby-by").getByRole("button", { name: "In the sky" }).click();
  await expect(rows(page).first()).toContainText("degrees");
  await expect.poll(() => param(page, "by")).toBeNull();
});

test("a star with no parallax has only the sky", async ({ page }) => {
  await open(page, "?pick=S:1149");
  await expect(page.getByTestId("nearby-by").getByRole("button", { name: "In space" })).toBeDisabled();
  await expect(page.getByTestId("nearby-note")).toContainText("no known distance");
  await expect(rows(page)).toHaveCount(10);
});

test("a Messier object lists the stars near it", async ({ page }) => {
  await open(page, "?pick=D:M45&ra=56&dec=24&zoom=12");
  await expect(rows(page).first()).toContainText("Alcyone");
  await expect(page.getByTestId("nearby-by").getByRole("button", { name: "In space" })).toBeDisabled();
});

test("a constellation lists the ones that touch it, and a tap on one picks it", async ({ page }) => {
  await open(page, "?pick=C:Ori");
  await expect(rows(page)).toHaveText([/Eridanus/, /Gemini/, /Lepus/, /Monoceros/, /Taurus/]);
  await expect(page.locator(`#chart path[stroke='${NEAR}']`).first()).toBeVisible();
  await rows(page).filter({ hasText: "Taurus" }).click();
  await expect.poll(() => param(page, "pick")).toBe("C:Tau");
  await expect(rows(page).filter({ hasText: "Orion" })).toHaveCount(1);
});

test("in Japanese the neighbours are named in Japanese", async ({ page }) => {
  await open(page, "?lang=ja&pick=C:Ori");
  await expect(rows(page).filter({ hasText: "おうし座" })).toHaveCount(1);
  await expect(page.getByTestId("nearby").locator("h3")).toHaveText("近くにあるもの");
});

test("nothing picked says so", async ({ page }) => {
  await open(page, "");
  await expect(page.getByTestId("nearby")).toContainText("Pick something");
  await expect(rows(page)).toHaveCount(0);
});

test("the embed page rings what is near, by sky or by space, and for a constellation", async ({ page }) => {
  await page.goto(`${HOME}embed.html?near=S:2491&by=space&ra=110&dec=-10&zoom=2&mag=6`);
  await expect(page.locator(`svg circle[stroke='${NEAR}']`).first()).toBeVisible();
  await page.goto(`${HOME}embed.html?near=S:5054&ra=201&dec=55&zoom=40`);
  await expect(page.locator(`svg circle[stroke='${NEAR}']`).first()).toBeVisible();
  await page.goto(`${HOME}embed.html?near=C:Ori`);
  await expect(page.locator(`svg path[stroke='${NEAR}']`).first()).toBeVisible();
});

test("the code to copy for a picked thing carries what is near", async ({ page }) => {
  await open(page, "?pick=S:2491&by=space");
  await page.locator("kazoku-embed-panel").scrollIntoViewIfNeeded();
  const frame = new URL(await page.locator("kazoku-embed-panel").evaluate((el) => (el as unknown as { openHref: string }).openHref), page.url());
  expect(frame.searchParams.get("near")).toBe("S:2491");
  expect(frame.searchParams.get("by")).toBe("space");
});
