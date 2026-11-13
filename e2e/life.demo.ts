// The life of a star page: a Hertzsprung-Russell diagram of the graded stars. It draws its dots once, the axes switch between colour with brightness and temperature with luminosity, a click or Enter picks a star
// and its card links to the sky map, the address keeps the axes and the pick, the two lives list their examples, and it reads in Japanese and fits a phone.
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/life.html";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const dots = (page: Page) => page.locator('[data-testid="hr-dots"] circle[data-hr]');
const SIRIUS = "2491";

test("the diagram draws the graded stars as dots, with the Sun as a reference, and a count that matches", async ({ page }) => {
  await page.goto(PAGE);
  const n = await dots(page).count();
  expect(n).toBeGreaterThan(450);
  await expect(page.getByTestId("hr-count")).toContainText(`${n} stars drawn`);
  await expect(page.getByTestId("hr-sun")).toHaveCount(1);
  await expect(page.getByTestId("hr-card")).toContainText("Click a dot");
});

test("clicking a named star picks it, rings it, fills its card and keeps it, with the axes, in the address", async ({ page }) => {
  await page.goto(PAGE);
  // a dot is 3 pixels across and its neighbours overlap it, so the click is sent to the dot itself
  await page.locator(`[data-testid="hr-dots"] circle[data-hr="${SIRIUS}"]`).dispatchEvent("click");
  await expect(page.getByTestId("hr-card").locator("h2")).toHaveText("Sirius");
  await expect(page.getByTestId("hr-card")).toContainText("A1Vm");
  await expect(page.getByTestId("hr-ring")).not.toHaveAttribute("display", "none");
  await expect.poll(() => param(page, "star")).toBe(SIRIUS);
  expect(param(page, "axes")).toBeNull();
  await page.locator('#axes button[data-value="physical"]').click();
  await expect.poll(() => param(page, "axes")).toBe("physical");
  await expect(page.getByTestId("hr-card").locator("h2")).toHaveText("Sirius");
  // the same state from the address alone
  await page.goto(`${PAGE}?axes=physical&star=${SIRIUS}`);
  await expect(page.locator('#axes button[aria-pressed="true"]')).toHaveAttribute("data-value", "physical");
  await expect(page.getByTestId("hr-card").locator("h2")).toHaveText("Sirius");
  await expect(page.getByTestId("hr-ring")).not.toHaveAttribute("display", "none");
  await expect(page.locator("#hr-chart svg")).toHaveAttribute("aria-label", /Temperature in kelvin/);
});

test("the card links to the star on the sky map, and the map opens on it", async ({ page }) => {
  await page.goto(`${PAGE}?star=${SIRIUS}`);
  const link = page.getByTestId("hr-map");
  await expect(link).toHaveAttribute("href", /index\.html\?pick=S:2491&ra=101\.\d+&dec=-16\.\d+&zoom=6/);
  await link.click();
  await expect.poll(() => param(page, "pick")).toBe(`S:${SIRIUS}`);
  await expect(page.locator("#picked")).toContainText("Sirius");
});

test("the axes change the drawing, and the stars that fall off one view are said", async ({ page }) => {
  await page.goto(PAGE);
  const sirius = page.locator(`[data-testid="hr-dots"] circle[data-hr="${SIRIUS}"]`);
  const colour = [await sirius.getAttribute("cx"), await sirius.getAttribute("cy")];
  await page.locator('#axes button[data-value="physical"]').click();
  await expect(page.getByTestId("hr-count")).toContainText("temperature and luminosity");
  expect([await sirius.getAttribute("cx"), await sirius.getAttribute("cy")]).not.toEqual(colour);
  await page.locator('#shows button[data-value="named"]').click();
  await expect.poll(() => param(page, "show")).toBe("named");
  const named = await dots(page).count();
  expect(named).toBeGreaterThan(20);
  expect(named).toBeLessThan(250);
  await page.locator('#shows button[data-value="a"]').click();
  expect(await dots(page).count()).toBeLessThan(named + 200);
});

test("the dots are reached by keyboard: Tab to the diagram, arrows between dots, Enter to pick; and a star is found by name", async ({ page }) => {
  await page.goto(PAGE);
  await page.locator('[data-testid="hr-dots"]').focus();
  await page.keyboard.press("ArrowRight");
  const first = await page.evaluate(() => document.activeElement?.getAttribute("data-hr"));
  expect(first).not.toBeNull();
  await page.keyboard.press("ArrowRight");
  const second = await page.evaluate(() => document.activeElement?.getAttribute("data-hr"));
  expect(second).not.toBe(first);
  await page.keyboard.press("Enter");
  await expect.poll(() => param(page, "star")).toBe(second);
  await page.getByTestId("hr-find").fill("Betelgeuse");
  await page.getByTestId("hr-find").press("Enter");
  await page.getByTestId("hr-find").blur();
  await expect(page.getByTestId("hr-card").locator("h2")).toHaveText("Betelgeuse");
  await page.getByTestId("hr-find").fill("Nowhere");
  await page.getByTestId("hr-find").blur();
  await expect(page.locator("#hr-found")).toContainText("No star of that name");
});

test("the two lives name their examples: the stars pick on the diagram, the objects open on the sky map, the missing say so", async ({ page }) => {
  await page.goto(PAGE);
  const lives = page.getByTestId("hr-lives");
  await expect(lives.locator("[data-stage]")).toHaveCount(10);
  await lives.locator('[data-stage="giant"] button').click();
  await expect(page.getByTestId("hr-card").locator("h2")).toHaveText("Aldebaran");
  await lives.locator('[data-stage="supergiant"] button').click();
  await expect(page.getByTestId("hr-card").locator("h2")).toHaveText("Betelgeuse");
  await lives.locator('[data-stage="main"] button[data-pick="0"]').click();
  await expect(page.getByTestId("hr-card").locator("h2")).toHaveText("The Sun");
  await expect.poll(() => param(page, "star")).toBe("sun");
  await expect(lives.locator('[data-stage="planetary"] a')).toHaveAttribute("href", /pick=D:M57/);
  await expect(lives.locator('[data-stage="supernova"] a')).toHaveAttribute("href", /pick=D:M1&/);
  await expect(lives.locator('[data-stage="ttauri"]')).toContainText("not in our data");
});

test("Japanese words, and the page keeps to the width of a phone", async ({ page }) => {
  await page.goto(`${PAGE}?lang=ja&star=1457`);
  await expect(page.getByTestId("hr-card").locator("h2")).toHaveText("アルデバラン");
  await expect(page.locator("#hr-heading")).toContainText("星の一生");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const button of await page.locator('#axes button, #shows button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(40);
});
