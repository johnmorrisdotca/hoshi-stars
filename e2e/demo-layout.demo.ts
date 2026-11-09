import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/?pick=S:264&by=space";
const box = (page: Page) => page.locator("#chart-box");
const controls = (page: Page) => page.locator(".sky .controls");
const panel = (page: Page) => page.locator(".sky .side");

async function open(page: Page, width: number, height: number, wide = false): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(`${HOME}${wide ? "&wide=on" : ""}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await expect(page.getByTestId("nearby-list").locator("button")).toHaveCount(10);
}

test("the long side panel does not push controls below the map", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [1024, 768]] as const) {
    await open(page, width, height);
    const map = (await box(page).boundingBox())!;
    const rows = (await controls(page).boundingBox())!;
    const side = (await panel(page).boundingBox())!;
    expect(rows.y - (map.y + map.height)).toBeGreaterThanOrEqual(0);
    expect(rows.y - (map.y + map.height)).toBeLessThanOrEqual(24);
    expect(side.x).toBeGreaterThan(map.x + map.width);
    expect(side.height).toBeLessThanOrEqual(map.height + 1);
  }
});

test("the zoom readout follows the button and wheel", async ({ page }) => {
  await open(page, 1440, 900);
  const readout = page.getByTestId("zoom-readout");
  await expect(readout).toHaveAttribute("aria-live", "polite");
  const initial = await readout.textContent();
  await page.getByTestId("zoom-in").click();
  await expect(readout).not.toHaveText(initial!);
  const buttonZoom = await readout.textContent();
  await box(page).hover();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect(readout).not.toHaveText(buttonZoom!);
});

test("Wide puts the panel under a full-width map and the T key changes the address", async ({ page }) => {
  await open(page, 1440, 900, true);
  await expect(page.locator("html")).toHaveAttribute("data-wide", "on");
  const map = (await box(page).boundingBox())!;
  const side = (await panel(page).boundingBox())!;
  const rows = (await controls(page).boundingBox())!;
  expect(side.y).toBeGreaterThanOrEqual(rows.y + rows.height);
  expect(map.width).toBeGreaterThan(900);
  await page.keyboard.press("t");
  await expect(page.locator("html")).not.toHaveAttribute("data-wide", "on");
  await expect.poll(() => new URL(page.url()).searchParams.get("wide")).toBeNull();
  await page.keyboard.press("t");
  await expect.poll(() => new URL(page.url()).searchParams.get("wide")).toBe("on");
});

test("on a phone the controls follow the map and the panel follows the controls", async ({ page }) => {
  await open(page, 390, 844);
  const map = (await box(page).boundingBox())!;
  const rows = (await controls(page).boundingBox())!;
  const side = (await panel(page).boundingBox())!;
  expect(rows.y - (map.y + map.height)).toBeLessThanOrEqual(24);
  expect(rows.y).toBeGreaterThanOrEqual(map.y + map.height);
  expect(side.y).toBeGreaterThanOrEqual(rows.y + rows.height);
});
