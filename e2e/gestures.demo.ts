// The family's gesture check (kazoku-ui/testing) on the main sky map: every gesture of the view controls does what the family's rule says, with a real mouse and keyboard.
import { expect, test } from "@playwright/test";
import { checkGestures } from "@johnmorrisdotca/kazoku-ui/testing";

test("the family's gestures move the sky map", async ({ page, isMobile, browserName }) => {
  test.skip(isMobile || browserName !== "chromium", "the check drives a mouse and two pointers in Chromium");
  await page.goto("/hoshi-stars/");
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await page.locator("#chart-box").scrollIntoViewIfNeeded();
  const reports = await checkGestures(page, "#chart-box", { controls: "#chart-box", picture: "#chart" });
  expect(reports.length).toBeGreaterThan(5);
});
