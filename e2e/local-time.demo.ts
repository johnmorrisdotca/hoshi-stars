// Every time hoshi shows is the reader's own (John's rule, MODULES-851). The sheets page is where a date shows: the month it opens on and the date in a sheet's footer. Here the
// browser is in Kiritimati (UTC+14) at 20:00 UTC on 31 December 2026, which is already 1 January 2027 there: a page reading UTC would say December and 2026-12-31.
import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Pacific/Kiritimati" });

test("the sheets page opens on the reader's own month and dates the sheet with the reader's own day", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-12-31T20:00:00Z"));
  await page.goto("/hoshi-stars/kids.html?kind=dots&c=Ori&level=medium");
  await expect(page.locator("#paper-inner .kazoku-page").first()).toBeVisible();
  expect(await page.evaluate(() => [new Date().getDate(), new Date().getMonth() + 1, new Date().getFullYear()]), "the browser's own day").toEqual([1, 1, 2027]);
  await expect(page.locator('#months button[data-value="1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#paper-inner .kazoku-meta").first()).toContainText("2027-01-01");
});
