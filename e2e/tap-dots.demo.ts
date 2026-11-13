// The Tap the dots page: tapping the numbers in order grows the line a segment at a time and ends on the constellation's name; a wrong tap moves nothing; the address keeps the constellation and the level; with reduced motion nothing shakes or grows;
// the page is in Japanese too and fits a phone with fingers' sizes.
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/tap-dots.html";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const board = (page: Page) => page.getByTestId("tp-board");
const dotFor = (page: Page, n: number) => page.locator(`[data-dot][data-numbers~="${n}"]`).first();
const lines = (page: Page) => page.locator("svg [data-line]");
const status = (page: Page) => page.getByTestId("tp-status");
const total = async (page: Page): Promise<number> => Number(await board(page).locator("svg").getAttribute("data-total"));

test("tapping 1, 2, 3 and 4 draws the line a segment at a time and ends with the name of the Southern Cross", async ({ page }) => {
  await page.goto(`${PAGE}?c=Cru&level=easy`);
  await expect(status(page)).toHaveText("Tap number 1 to begin.");
  expect(await total(page)).toBe(4);
  await expect(lines(page)).toHaveCount(0);
  await expect(page.getByTestId("tp-result")).toBeHidden();
  await dotFor(page, 1).click();
  await expect(board(page).locator("svg")).toHaveAttribute("data-done", "1");
  await expect(lines(page)).toHaveCount(0);
  await expect(status(page)).toContainText("Now tap number 2");
  for (const [n, segments] of [[2, 1], [3, 2], [4, 3]] as const) {
    await dotFor(page, n).click();
    await expect(board(page).locator("svg")).toHaveAttribute("data-done", String(n));
    await expect(lines(page)).toHaveCount(segments);
  }
  await expect(status(page)).toHaveText("You made Crux!");
  await expect(page.getByTestId("tp-result")).toBeVisible();
  await expect(page.locator("#tp-name")).toHaveText("You made Crux!");
  await expect(page.locator("#tp-sub")).toHaveText("Crux: the Southern Cross");
  await expect(page.locator("#tp-stars")).toContainText("Acrux");
  // start again: the line is gone
  await page.locator("#tp-again").click();
  await expect(lines(page)).toHaveCount(0);
  await expect(page.getByTestId("tp-result")).toBeHidden();
});

test("a wrong tap does not advance, says so, and the right dot still works; a tap near a dot counts", async ({ page }) => {
  await page.goto(`${PAGE}?c=Cru&level=easy`);
  await dotFor(page, 3).click();
  await expect(board(page).locator("svg")).toHaveAttribute("data-done", "0");
  await expect(board(page).locator("svg")).toHaveAttribute("data-wrong", "1");
  await expect(lines(page)).toHaveCount(0);
  await expect(status(page)).toHaveText("Not that one. Try number 1.");
  // a tap on empty sky does nothing at all
  const box = (await board(page).locator("svg").boundingBox())!;
  await page.mouse.click(box.x + 3, box.y + 3);
  await expect(board(page).locator("svg")).toHaveAttribute("data-wrong", "1");
  // a tap a finger's width from the middle of the right dot meant it
  const dot = (await dotFor(page, 1).boundingBox())!;
  await page.mouse.click(dot.x + dot.width / 2 + 12, dot.y + dot.height / 2);
  await expect(board(page).locator("svg")).toHaveAttribute("data-done", "1");
});

test("the constellation and the level are kept in the address and come back from it", async ({ page }) => {
  await page.goto(PAGE);
  await page.locator('#tp-levels button[data-value="medium"]').click();
  await page.locator('#tp-whiches button[data-value="Ori"]').click();
  await expect.poll(() => param(page, "level")).toBe("medium");
  await expect.poll(() => param(page, "c")).toBe("Ori");
  const orion = await total(page);
  expect(orion).toBeGreaterThan(8);
  await page.locator("#tp-more").selectOption("Her");
  await expect.poll(() => param(page, "c")).toBe("Her");
  await page.goto(`${PAGE}?c=Ori&level=medium`);
  await expect(page.locator('#tp-whiches button[data-value="Ori"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#tp-levels button[data-value="medium"]')).toHaveAttribute("aria-pressed", "true");
  expect(await total(page)).toBe(orion);
  // the hard level prints no numbers at the start; each shows as its star is reached
  await page.locator('#tp-levels button[data-value="hard"]').click();
  await expect(page.locator("svg [data-number]")).toHaveCount(0);
  await expect(status(page)).toContainText("Tap a star to begin");
});

test("with reduced motion nothing shakes or grows and a message says what happened", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${PAGE}?c=Cru&level=easy`);
  await expect(page.locator("#tp-calm")).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { started: number }).started = 0;
    document.addEventListener("animationstart", () => ((window as unknown as { started: number }).started += 1), true);
  });
  await dotFor(page, 2).click();
  await expect(status(page)).toHaveText("Not that one. Try number 1.");
  await dotFor(page, 1).click();
  await dotFor(page, 2).click();
  await expect(lines(page)).toHaveCount(1);
  await expect(board(page).locator("svg.tap-shake")).toHaveCount(0);
  await expect(page.locator("line.tap-grow")).toHaveCount(0);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { started: number }).started)).toBe(0);
});

test.describe("with motion allowed", () => {
  test.use({ reducedMotion: "no-preference" });
  test("a wrong tap shakes the picture and a right one grows the line", async ({ page }) => {
    await page.goto(`${PAGE}?c=Cru&level=easy`);
    await expect(page.locator("#tp-calm")).toBeHidden();
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as unknown as { seen: string[] }).seen = seen;
      document.addEventListener("animationstart", (event) => seen.push((event as AnimationEvent).animationName), true);
    });
    await dotFor(page, 3).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { seen: string[] }).seen.join())).toContain("tap-shake");
    await dotFor(page, 1).click();
    await dotFor(page, 2).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { seen: string[] }).seen.join())).toContain("tap-grow");
  });
});

test("Japanese words, the name of the figure, big buttons and no sideways scroll", async ({ page }) => {
  await page.goto(`${PAGE}?c=Cru&level=easy&lang=ja`);
  await expect(page.locator("#tp-heading")).toHaveText("てんを タップしよう");
  await expect(status(page)).toHaveText("1ばんを タップして はじめよう。");
  for (const n of [1, 2, 3, 4]) await dotFor(page, n).click();
  await expect(page.locator("#tp-name")).toHaveText("みなみじゅうじ座が できました！");
  await expect(page.locator("#tp-sub")).toHaveText("みなみじゅうじざ");
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(wide).toBeLessThanOrEqual(0);
  const small = await page.locator(".kids-picks button, #tp-again").evaluateAll((els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).filter((el) => el.getBoundingClientRect().height < 47.5 || el.getBoundingClientRect().width < 47.5).length);
  expect(small).toBe(0);
  const svg = (await board(page).locator("svg").boundingBox())!;
  expect(svg.x).toBeGreaterThanOrEqual(0);
  expect(svg.x + svg.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
