// The birthday page (MODULES-819): a day's Sun, the constellation it is really in and the days it went in and came out, on a chart around it, with the year's path below. It opens
// moving from today (MODULES-817) with the date running, a Pause or a picked day is kept in the address, and with reduced motion it opens still with Play ready. The browser is on UTC so
// the days are fixed; the Sun's own moments are tested against a published table in test/sun.test.ts.
import { expect, test } from "@playwright/test";

test.use({ timezoneId: "UTC" });

test("a held day names the Sun's constellation, its days in and out, and the year's 13 constellations with that one pressed", async ({ page }) => {
  await page.goto("/hoshi-stars/birthday.html?date=2020-12-01");
  await expect(page.getByTestId("bd-answer")).toHaveText("1 December 2020: the Sun is in Ophiuchus.");
  await expect(page.getByTestId("bd-stay")).toHaveText("It is in Ophiuchus from 29 November 2020 to 18 December 2020.");
  await expect(page.getByTestId("bd-date")).toHaveValue("2020-12-01");
  await expect(page.getByTestId("bd-play")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("bd-sun")).toBeVisible();
  await expect(page.getByTestId("bd-sky")).toHaveAttribute("aria-label", /Ophiuchus/);
  const steps = page.getByTestId("bd-year").locator("button");
  await expect(steps).toHaveCount(13);
  await expect(page.getByTestId("bd-year-title")).toHaveText("The Sun's path in 2020: 13 constellations");
  await expect(page.getByTestId("bd-year").locator('button[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.getByTestId("bd-year").locator('button[aria-pressed="true"]')).toHaveAttribute("data-c", "Oph");
  await expect(page.getByTestId("bd-year").locator('button[data-c="Oph"]')).toContainText("from 29 November");
  await page.getByTestId("bd-year").locator('button[data-c="Leo"]').click();
  await expect(page.getByTestId("bd-answer")).toContainText("the Sun is in Leo");
  await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe("2020-08-11");
});

test("in Japanese it says the same in Japanese", async ({ page }) => {
  await page.goto("/hoshi-stars/birthday.html?date=2020-12-01&lang=ja");
  await expect(page.getByTestId("bd-answer")).toHaveText("2020年12月1日、太陽はへびつかい座にいます。");
  await expect(page.getByTestId("bd-stay")).toContainText("2020年11月29日から2020年12月18日まで");
  await expect(page.getByTestId("bd-play")).toHaveText("動かす");
});

test("picking a day holds it and puts it in the address", async ({ page }) => {
  await page.goto("/hoshi-stars/birthday.html?date=2020-12-01");
  await page.getByTestId("bd-date").fill("2021-03-20");
  await page.getByTestId("bd-date").dispatchEvent("change");
  await expect(page.getByTestId("bd-answer")).toHaveText("20 March 2021: the Sun is in Pisces.");
  await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe("2021-03-20");
});

test.describe("normal motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("it opens moving from today with the date running; Pause holds the day and keeps it in the address", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-10T09:00:00Z") });
    await page.goto("/hoshi-stars/birthday.html");
    const play = page.getByTestId("bd-play");
    await expect(play).toHaveAttribute("aria-pressed", "true");
    await expect(play).toHaveText("Pause");
    await expect(page.getByTestId("bd-date")).toHaveValue("2026-11-10");
    await page.clock.runFor(1000);
    await expect(page.getByTestId("bd-date")).not.toHaveValue("2026-11-10");
    await play.click();
    await expect(play).toHaveAttribute("aria-pressed", "false");
    const held = await page.getByTestId("bd-date").inputValue();
    await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe(held);
    await page.clock.runFor(2000);
    await expect(page.getByTestId("bd-date")).toHaveValue(held);
    await page.reload();
    await expect(page.getByTestId("bd-date")).toHaveValue(held);
    await expect(play).toHaveAttribute("aria-pressed", "false");
  });
});

test("with reduced motion it opens still on today, with Play ready", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-11-10T09:00:00Z") });
  await page.goto("/hoshi-stars/birthday.html");
  await expect(page.getByTestId("bd-play")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("bd-play")).toHaveText("Play");
  await page.clock.runFor(2000);
  await expect(page.getByTestId("bd-date")).toHaveValue("2026-11-10");
  await expect(page.getByTestId("bd-answer")).toHaveText("10 November 2026: the Sun is in Libra.");
});
