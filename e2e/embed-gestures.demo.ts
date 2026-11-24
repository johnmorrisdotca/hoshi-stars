// The family's gesture check on the views whose hands are a controller bound in the page, not a <kazoku-view-controls> bar: the constellation embed and the distance embed.
import { checkGestures, drainGpu } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test } from "@playwright/test";

test("the sky embed's hands answer every gesture", async ({ page, isMobile, browserName }) => {
  test.skip(isMobile || browserName !== "chromium", "the check drives a mouse and two pointers in Chromium");
  test.setTimeout(180_000);
  await page.goto("/hoshi-stars/embed.html");
  await expect(page.locator("#sky svg")).toBeVisible();
  const report = await checkGestures(page, "#frame", { controls: "#frame", picture: "#sky" });
  expect(report.filter((row) => row.result === "lacks")).toEqual([]);
  expect(report.length).toBeGreaterThan(10);
});

test("the constellation embed's hands answer every gesture", async ({ page, isMobile, browserName }) => {
  test.skip(isMobile || browserName !== "chromium", "the check drives a mouse and two pointers in Chromium");
  test.setTimeout(180_000);
  await page.goto("/hoshi-stars/embed-3d.html?c=UMa&spin=off");
  await page.locator("#sp-stage[data-state=live]").waitFor({ timeout: 60_000 });
  const report = await checkGestures(page, "#sp-view", { controls: "#sp-view", picture: "#sp-stage" });
  expect(report.filter((row) => row.result === "lacks")).toEqual([]);
  expect(report.length).toBeGreaterThan(10);
  await drainGpu(page);
});

test("the distance embed's hands answer every gesture", async ({ page, isMobile, browserName }) => {
  test.skip(isMobile || browserName !== "chromium", "the check drives a mouse and two pointers in Chromium");
  test.setTimeout(180_000);
  await page.goto("/hoshi-stars/embed-layers.html?dist=100&spin=off");
  await page.locator("#sp-stage[data-state=live]").waitFor({ timeout: 60_000 });
  const report = await checkGestures(page, "#sp-view", { controls: "#sp-view", picture: "#sp-stage" });
  expect(report.filter((row) => row.result === "lacks")).toEqual([]);
  expect(report.length).toBeGreaterThan(10);
  await drainGpu(page);
});
