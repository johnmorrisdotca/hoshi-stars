// The Tonight page: a place and a moment give the stars above its horizon that can be seen (Sirius on a November night over Vancouver, nothing in its daylight, Polaris gone from Sydney), by country and region or by
// location, in English and Japanese, and the page fits a phone.
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/tonight.html";
const NIGHT = "t=2026-11-08T10:00:00Z";
const DAY = "t=2026-11-08T20:00:00Z";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const summary = (page: Page) => page.getByTestId("tn-summary");
const polaris = (page: Page) => page.locator('[data-testid="tn-stars"] circle[data-hr="424"]');
const names = (page: Page) => page.locator("#tn-rows tr td:first-child");

test("pick Canada and British Columbia and see Sirius on a night, no stars in the day, and Use my location moves the sky to Sydney", async ({ page, context, browserName }) => {
  await page.goto(`${PAGE}?${NIGHT}`);
  await expect(summary(page)).toHaveText("Pick a country to see its sky.");
  await page.locator("#country").selectOption("CA");
  await expect(page.locator("#field-region")).toBeVisible();
  await page.locator("#region").selectOption({ label: "British Columbia" });
  await expect(summary(page)).toContainText("Night at British Columbia");
  await expect(summary(page)).toContainText("the brightest Sirius");
  await expect(names(page).first()).toHaveText("Sirius");
  expect(await page.locator('[data-testid="tn-stars"] circle').count()).toBeGreaterThan(300);
  await expect(polaris(page)).toHaveCount(1);
  await expect.poll(() => param(page, "country")).toBe("CA");
  await expect.poll(() => param(page, "region")).toBe("CA-BC");
  // the same place by an address, in the day: the Sun is up and there is nothing to see
  await page.goto(`${PAGE}?country=CA&region=CA-BC&${DAY}`);
  await expect(summary(page)).toContainText("Day at British Columbia");
  await expect(summary(page)).toContainText("no stars to see now");
  await expect(page.locator('[data-testid="tn-stars"] circle')).toHaveCount(0);
  // Use my location: Sydney, where Polaris never rises; the place is not put in the address
  test.skip(browserName === "webkit", "WebKit has no switch for a test location");
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -33.87, longitude: 151.2 });
  await page.goto(`${PAGE}?t=2026-11-08T12:00:00Z`);
  await page.locator("#here").click();
  await expect(summary(page)).toContainText("Night at your place");
  await expect(polaris(page)).toHaveCount(0);
  await expect(page.locator("#where-note")).toContainText("never stored or sent");
  await page.waitForTimeout(500);
  expect(param(page, "lat")).toBeNull();
  expect(page.url()).not.toContain("151");
});

test("Japanese words, the star in katakana, and the page fits the width of the screen", async ({ page }) => {
  await page.goto(`${PAGE}?country=CA&region=CA-BC&${NIGHT}&lang=ja`);
  await expect(page.locator("#tn-heading")).toHaveText("今夜見える星");
  await expect(summary(page)).toContainText("夜です");
  await expect(summary(page)).toContainText("シリウス");
  await expect(names(page).first()).toHaveText("シリウス");
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(wide).toBeLessThanOrEqual(0);
  const chart = (await page.getByTestId("tn-chart").boundingBox())!;
  expect(chart.x).toBeGreaterThanOrEqual(0);
  expect(chart.x + chart.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const small = await page.locator(".kids-picks button").evaluateAll((els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).filter((el) => el.getBoundingClientRect().height < 47.5 || el.getBoundingClientRect().width < 47.5).length);
  expect(small).toBe(0);
});

test("the darkness of the site changes how many stars show, and the moment is kept in the address", async ({ page }) => {
  await page.goto(`${PAGE}?country=CA&region=CA-BC&${NIGHT}`);
  const rural = await page.locator('[data-testid="tn-stars"] circle').count();
  await page.locator('#limits button[data-value="city"]').click();
  await expect(page.locator('#limits button[data-value="city"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.locator('[data-testid="tn-stars"] circle').count()).toBeLessThan(rural / 3);
  await expect.poll(() => param(page, "limit")).toBe("city");
  await expect.poll(() => param(page, "t")).toBe("2026-11-08T10:00Z");
  await page.locator("#now").click();
  await expect.poll(() => param(page, "t")).toBeNull();
});
