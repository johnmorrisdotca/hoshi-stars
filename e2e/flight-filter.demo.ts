// The flight's filter bars on the demo's flight page: the sky is filtered by the distance from where the camera is and by the magnitude seen from there, the bars write the attributes, and the address keeps them as short numbers.
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/flight.html";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const points = (page: Page) => page.locator("hoshi-flight").evaluate((el) => (el as unknown as { stats: { points: number } }).stats.points);

test("the bars keep the stars near the camera, and the address keeps them", async ({ page }) => {
  await page.goto(PAGE);
  await expect.poll(() => page.locator("hoshi-flight").evaluate((el) => (el as unknown as { live: boolean }).live), { timeout: 60_000 }).toBe(true);
  await expect.poll(() => points(page)).toBeGreaterThan(1000);
  const all = await points(page);
  const flight = page.locator("hoshi-flight");
  const far = flight.locator('[data-bar="max"]');
  await expect(far).toHaveAttribute("aria-valuetext", "any");
  await far.focus();
  for (let i = 0; i < 3; i += 1) await far.press("ArrowLeft");
  await expect(far).toHaveAttribute("aria-valuetext", "500 ly");
  await expect(flight).toHaveAttribute("distance-max", "500");
  await expect.poll(() => points(page)).toBeLessThan(all);
  await far.press("Tab");
  await expect.poll(() => param(page, "dmax")).toBe("500");
  await expect(flight.locator(".bar-count")).toContainText("stars match");
});

test("an address with the filters opens with them", async ({ page }) => {
  await page.goto(`${PAGE}?dmax=100&mlim=4`);
  await expect.poll(() => page.locator("hoshi-flight").evaluate((el) => (el as unknown as { live: boolean }).live), { timeout: 60_000 }).toBe(true);
  const flight = page.locator("hoshi-flight");
  await expect(flight.locator('[data-bar="max"]')).toHaveAttribute("aria-valuetext", "100 ly");
  await expect(flight.locator('[data-bar="mag"]')).toHaveAttribute("aria-valuetext", "4 mag");
  await expect.poll(() => points(page)).toBeLessThan(300);
});
