// The family's gesture check (kazoku-ui's checkGestures) on the constellation in 3D, whose shared view controls own the hands: a drag turns it and the surface follows the pointer, Shift and a drag rolls it, the arrow keys turn and tip it,
// + and - and the wheel zoom, and every kind of pan moves a zoomed view. Software GL in Chromium, like the rest of the 3D tests.
import { checkGestures, drainGpu } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test } from "@playwright/test";

test("the shared view controls' gestures all answer on the constellation in 3D", async ({ page, isMobile, browserName }) => {
  test.skip(isMobile || browserName !== "chromium", "the check drives a mouse and two pointers in Chromium");
  test.setTimeout(180_000);
  await page.goto("/hoshi-stars/constellation-3d.html?c=UMa");
  await page.locator("#sp-stage[data-state=live]").waitFor({ timeout: 60_000 });
  const report = await checkGestures(page, "#sp-view", { controls: "kazoku-view-controls", picture: "#sp-stage" });
  expect(report.filter((r) => r.result === "lacks")).toEqual([]);
  expect(report.length).toBeGreaterThan(10);
  // the check draws for seconds, in software: the backlog is this test's, not the next one's
  await drainGpu(page);
});
