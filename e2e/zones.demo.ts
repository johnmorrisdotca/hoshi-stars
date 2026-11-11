// Every date the pages show is the reader's own, in any time zone. The same checks run in two zones: America/Vancouver, where Node and the test browser can disagree on the offset by an hour, and
// Asia/Tokyo, which has no daylight saving. Each zone gets a moment whose local day is not the UTC day, so a page that read UTC would show the wrong one. What each page should show is worked out
// in the page, with its own Date, never parsed in the runner: CI runs in UTC, and without this a mismatch shows only on a Mac.
import { expect, test, type Page } from "@playwright/test";

const ZONES = [
  // 03:00 UTC on 1 December is the evening of 30 November in Vancouver
  { zone: "America/Vancouver", at: "2026-12-01T03:00:00Z" },
  // 20:00 UTC on 30 November is the morning of 1 December in Tokyo
  { zone: "Asia/Tokyo", at: "2026-11-30T20:00:00Z" },
] as const;

/** The page's own day: its year, month and date, the ISO day, and whether that differs from the UTC day (so the check has teeth). */
const pageDay = (page: Page) =>
  page.evaluate(() => {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    return {
      month: now.getMonth() + 1,
      iso: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      long: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }),
      notUtc: now.getDate() !== now.getUTCDate(),
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  });

for (const { zone, at } of ZONES) {
  test.describe(`in ${zone}`, () => {
    test.use({ timezoneId: zone });

    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(new Date(at));
    });

    test("the sheets page opens on the reader's month and dates the sheet with the reader's day", async ({ page }) => {
      await page.goto("/hoshi-stars/kids.html?kind=dots&c=Ori&level=medium");
      await expect(page.locator("#paper-inner .kazoku-page").first()).toBeVisible();
      const day = await pageDay(page);
      expect(day.zone).toBe(zone);
      expect(day.notUtc, "the moment is on another day in UTC").toBe(true);
      await expect(page.locator(`#months button[data-value="${day.month}"]`)).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("#paper-inner .kazoku-meta").first()).toContainText(day.iso);
    });

    test("the birthday page opens on the reader's day, in its date box and its answer", async ({ page }) => {
      await page.goto("/hoshi-stars/birthday.html");
      await expect(page.getByTestId("bd-answer")).not.toHaveText("");
      const day = await pageDay(page);
      expect(day.notUtc, "the moment is on another day in UTC").toBe(true);
      await expect(page.getByTestId("bd-date")).toHaveValue(day.iso);
      await expect(page.getByTestId("bd-answer")).toContainText(day.long);
      await expect(page.getByTestId("bd-sky")).toHaveAttribute("aria-label", new RegExp(day.long));
    });
  });
}
