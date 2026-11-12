// The demo's Show uncertainty switch and the star card's grade: the switch dims the stars of grade C in the picture, is kept in the address, and a star's card says its grade, the range of its distance and the resolution of its position.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const dimmed = (page: Page) => page.locator('#chart circle[data-uncertain="C"]').count();

test("the switch dims the grade C stars in the picture, and the address keeps it", async ({ page }) => {
  await page.goto(HOME);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  expect(await dimmed(page)).toBe(0);
  const button = page.getByTestId("uncertainty");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => dimmed(page)).toBeGreaterThan(10);
  await expect.poll(() => param(page, "uncertainty")).toBe("on");
  await button.click();
  await expect.poll(() => dimmed(page)).toBe(0);
  await expect.poll(() => param(page, "uncertainty")).toBeNull();
});

test("an address with uncertainty=on opens with the stars dimmed", async ({ page }) => {
  await page.goto(`${HOME}?uncertainty=on`);
  await expect(page.getByTestId("uncertainty")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => dimmed(page)).toBeGreaterThan(10);
});

test("a star's card says its grade, the range of its distance and its position resolution", async ({ page }) => {
  await page.goto(`${HOME}?pick=S:2061`);
  const card = page.getByTestId("picked");
  await expect(card.locator("h3")).toHaveText(/Betelgeuse/);
  const row = (name: string) => card.locator("dt", { hasText: name }).locator("xpath=following-sibling::dd[1]");
  await expect(row("How well known")).toHaveText("Grade B");
  await expect(row("Distance range")).toHaveText(/^4[78]\d to 6[34]\d light-years$/);
  await expect(row("Position resolution")).toHaveText(/^1\.[0-5] arc-seconds$/);
});
