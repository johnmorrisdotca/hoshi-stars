// The star's profile in the side panel: the portrait or the star next to the Sun, the figures with their ranges, the words in Japanese, what is not known said plainly, and the star's picture offered to embed.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${HOME}${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await expect(page.getByTestId("star-profile")).toBeVisible();
}
const facts = (page: Page) => page.getByTestId("picked").locator("dl.facts");

test("a picked star shows its portrait, drawn from numbers, with the figures and their ranges", async ({ page }) => {
  await open(page, "?pick=S:2061");
  const art = page.getByTestId("star-portrait");
  await expect(art.locator("svg")).toHaveAttribute("aria-label", "Betelgeuse, drawn from its numbers");
  await expect(art).toContainText("Drawn from its numbers, not a photo.");
  await expect(art).toContainText("A generic look, not this star's surface.");
  await expect(facts(page).locator("dt").first()).toHaveText("Radius");
  await expect(facts(page).locator("dd").first()).toContainText("times the Sun");
  await expect(facts(page).locator("dd").first()).toContainText(" to ");
  await expect(facts(page)).toContainText("3,710 K");
  await expect(facts(page)).toContainText("Surface temperature");
  await expect(facts(page)).toContainText("Luminosity");
  await expect(facts(page)).toContainText("milliarcseconds");
  await expect(facts(page)).toContainText("M1-2Ia-Iab");
  await expect(facts(page)).toContainText(" ± ");
});

test("Next to the Sun draws the star over Earth's orbit for a supergiant, and the choice is kept in the address", async ({ page }) => {
  await open(page, "?pick=S:2061");
  await page.getByTestId("star-view-compare").click();
  await expect(page.getByTestId("star-compare").locator("svg")).toContainText("Earth's orbit");
  await expect(page.getByTestId("star-compare")).toContainText("times the Sun's radius");
  await expect.poll(() => param(page, "pview")).toBe("compare");
  await page.reload();
  await expect(page.getByTestId("star-compare")).toBeVisible();
  await page.getByTestId("star-view-portrait").click();
  await expect(page.getByTestId("star-portrait")).toBeVisible();
  await expect.poll(() => param(page, "pview")).toBeNull();
});

test("Altair is drawn flattened, with its measured shape and source named", async ({ page }) => {
  await open(page, "?pick=S:7557");
  await expect(facts(page)).toContainText("Measured shape");
  await expect(facts(page)).toContainText("Flattened by its spin");
  await expect(facts(page)).toContainText("Monnier et al. 2007");
  await expect(page.getByTestId("star-portrait")).toContainText("Its flattened shape is measured.");
});

test("the words are Japanese in Japanese, in the picture and in the figures", async ({ page }) => {
  await open(page, "?pick=S:2061&lang=ja");
  await expect(page.getByTestId("star-portrait")).toContainText("写真ではありません");
  await expect(facts(page)).toContainText("表面温度");
  await expect(facts(page)).toContainText("半径");
  await expect(facts(page).locator("dd").first()).toContainText("太陽の");
  await page.getByTestId("star-view-compare").click();
  await expect(page.getByTestId("star-compare")).toContainText("地球の軌道");
});

test("a star with no parallax says its size is not known and why, and has no comparison", async ({ page }) => {
  // Deneb: the catalogue holds no parallax for it, and an A2 supergiant has no typical size.
  await open(page, "?pick=S:7924");
  await expect(facts(page).locator("dd").first()).toContainText("not known");
  await expect(facts(page).locator("dd").first()).toContainText("no parallax");
  await expect(page.getByTestId("star-view-compare")).toBeDisabled();
  await expect(facts(page)).toContainText("milliarcseconds");
});

test("the Sun has a profile too", async ({ page }) => {
  await open(page, "?pick=S:sun&from=HR5459");
  await expect(facts(page).locator("dd").first()).toContainText("about the Sun's size");
});

test("the star's picture is offered to embed, with its code and an embed page that draws it", async ({ page }) => {
  await open(page, "?pick=S:2061");
  await page.getByTestId("embed-what").getByRole("button", { name: "This star's picture" }).click();
  await expect.poll(() => param(page, "ew")).toBe("star");
  const code = page.getByTestId("embed-panel");
  await expect(code).toContainText("starPortrait");
  await expect(code).toContainText("starProfile(starByHr(2061))");
  await page.goto(`${HOME}star.html?star=2061&view=compare&lang=ja`);
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await expect(page.getByTestId("star").locator("svg")).toContainText("地球の軌道");
  await page.goto(`${HOME}star.html?star=banana`);
  await expect(page.getByTestId("star")).toContainText("No star");
});

test("without a picked star the embed choice is the chart, and the star's button waits", async ({ page }) => {
  await page.goto(HOME);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await expect(page.getByTestId("embed-what").getByRole("button", { name: "This star's picture" })).toBeDisabled();
  await expect(page.getByTestId("embed-panel")).toContainText("skyChart");
});

test("the profile fits the side panel: no sideways scroll, the figures reachable by scrolling the panel", async ({ page }) => {
  await open(page, "?pick=S:2061");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await facts(page).locator("dt", { hasText: "Luminosity" }).scrollIntoViewIfNeeded();
  await expect(facts(page).locator("dt", { hasText: "Luminosity" })).toBeInViewport();
});
