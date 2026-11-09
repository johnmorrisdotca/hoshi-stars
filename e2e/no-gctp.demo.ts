// The demo on the fallback build, made without the Yale GCTP parallaxes (MODULES-779; scripts/data-source.mjs): every page loads without an error, no card is empty or says NaN, a distance with no error
// says "no error given", the profile says what its ranges allow for, and the Nearby panel says it has no nearby-star layer. It runs only when the site was built that way:
//
//     HOSHI_NO_GCTP=1 pnpm site && HOSHI_NO_GCTP=1 TEST_PORT=8266 npx playwright test e2e/no-gctp.demo.ts
//
// On the Yale build it is skipped (the other specs pin the Yale numbers, and are skipped or fail on the fallback by design).
import { expect, test, type Page } from "@playwright/test";
import { noGctp } from "../scripts/data-source.mjs";

test.skip(!noGctp(), "the site was built with the Yale GCTP data: set HOSHI_NO_GCTP=1 for this build and this test");

const HOME = "/hoshi-stars/";
const PAGES = ["", "embed.html", "star.html?star=2491", "kids.html", "constellations.html", "constellation.html?c=Ori", "whole-sky.html", "constellation-list.html"];
async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${HOME}${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
}
const facts = (page: Page) => page.getByTestId("picked").locator("dl.facts");

test("every page loads with no script error and no NaN in what it says", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
  page.on("console", (message) => message.type() === "error" && errors.push(`${page.url()}: ${message.text()}`));
  for (const address of PAGES) {
    await page.goto(`${HOME}${address}`);
    await page.waitForLoadState("networkidle");
    const text = await page.locator("body").innerText();
    expect(text.length, address).toBeGreaterThan(30);
    expect(text, address).not.toMatch(/NaN|undefined|\[object/);
  }
  expect(errors).toEqual([]);
});

test("a star's distance has no error range and says so; the profile still has its figures and says what its ranges allow for", async ({ page }) => {
  await open(page, "?pick=S:2491");
  await expect(page.getByTestId("star-profile")).toBeVisible();
  await expect(facts(page)).toContainText("Distance");
  await expect(facts(page)).toContainText("9 light-years (no error given)");
  await expect(facts(page)).not.toContainText(/Distance[\d.,]+ ±/);
  await expect(facts(page)).toContainText("Radius");
  await expect(facts(page)).toContainText("Surface temperature");
  await expect(page.getByTestId("picked")).toContainText("No parallax error is given in this build");
  await expect(page.getByTestId("star-portrait").locator("svg")).toBeVisible();
});

test("a star with no parallax has a whole card: its distance is not known, and nothing says NaN", async ({ page }) => {
  await open(page, "?pick=S:4853");
  await expect(facts(page)).toContainText("Distance");
  await expect(facts(page)).toContainText("not known");
  await expect(page.getByTestId("picked")).not.toContainText(/NaN|undefined/);
  await expect(facts(page)).toContainText("Radius");
});

test("Nearby, in space, lists the nearest bright stars in light-years and says what this build lacks", async ({ page }) => {
  await open(page, "?pick=S:2491&by=space");
  await expect(page.getByTestId("nearby-list").locator("button")).toHaveCount(10);
  await expect(page.getByTestId("nearby-list").locator("button").first()).toContainText("Procyon");
  await expect(page.getByTestId("nearby-list").locator("button").first()).toContainText("light-years");
  await expect(page.getByTestId("nearby-note")).toContainText("have no distance");
  await expect(page.getByTestId("nearby-lacks")).toContainText("no nearby-star layer");
  await expect(page.getByTestId("nearby")).not.toContainText(/NaN|undefined/);
});

test("the sky from Alpha Centauri has no star shining at the viewpoint: its companion is left out, and the Nearby panel works from there", async ({ page }) => {
  await open(page, "?from=HR5459&pick=S:2491&by=space");
  await expect(page.getByTestId("from-note")).toContainText("Seen from Alpha Centauri");
  await expect(page.getByTestId("nearby-list").locator("button")).toHaveCount(10);
  await expect(page.getByTestId("nearby-list")).not.toContainText(/NaN|undefined/);
  const text = await page.getByTestId("nearby-list").innerText();
  expect(text).not.toMatch(/^\s*0\.0 light-years/m);
  await expect(page.getByTestId("picked")).not.toContainText(/NaN|undefined/);
});

test("in Japanese the card, the profile note and the Nearby panel say it in Japanese", async ({ page }) => {
  await open(page, "?lang=ja&pick=S:2491&by=space");
  await expect(facts(page)).toContainText("誤差のデータなし");
  await expect(page.getByTestId("picked")).toContainText("年周視差の誤差のデータがありません");
  await expect(page.getByTestId("nearby-lacks")).toContainText("暗い星");
});

test("the embed page rings the nearest stars and works with no error range", async ({ page }) => {
  await page.goto(`${HOME}embed.html?pick=S:2491&by=space&from=HR5459`);
  await expect(page.locator("svg circle").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/NaN|undefined/);
});
