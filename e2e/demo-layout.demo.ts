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
    // the panel shows all it holds: nothing cut off or hidden in a scroll of its own
    expect(await panel(page).evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  }
});

test("Wide is theatre mode: the map takes the page's column, centred, and the page keeps its width", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [1024, 768], [1920, 1080]] as const) {
    await open(page, width, height);
    const normalMain = (await page.locator("main").boundingBox())!;
    await page.keyboard.press("t");
    await expect(page.locator("html")).toHaveAttribute("data-wide", "on");
    const main = (await page.locator("main").boundingBox())!;
    const map = (await box(page).boundingBox())!;
    const pad = await page.locator("main").evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    expect(main.width, `the page keeps its width at ${width}`).toBeCloseTo(normalMain.width, 0);
    expect(map.width, `the map fills the column at ${width}`).toBeCloseTo(main.width - 2 * pad, 0);
    expect(Math.abs(map.x - main.x - (main.x + main.width - map.x - map.width)), `the map is centred at ${width}`).toBeLessThanOrEqual(1);
    expect(map.height).toBeLessThanOrEqual(height * 0.8 + 1);
    await page.keyboard.press("t");
  }
});

test("the Wide button looks like the other buttons on the map", async ({ page }) => {
  await open(page, 1440, 900);
  const look = (el: Element): string => getComputedStyle(el).backgroundColor;
  const toggle = await page.getByTestId("wide-toggle").locator("button").evaluate(look);
  const light = (rgb: string): number => rgb.match(/\d+/g)!.slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3;
  expect(light(toggle), `the toggle is dark on the dark map (${toggle})`).toBeLessThan(80);
});

test("the sky cultures stand at the left of the constellation strip, as tall as a card", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await open(page, width, height);
    const stack = page.getByTestId("cultures");
    await expect(stack.locator("button")).toHaveCount(3);
    const buttons = await stack.locator("button").evaluateAll((all) => all.map((b) => b.getBoundingClientRect()).map((r) => ({ x: r.x, top: r.top, bottom: r.bottom })));
    // the strip may have scrolled to the picked constellation, so compare with the strip's own left edge; a card's height is the same for every card
    const strip = (await page.getByTestId("picker-strip").boundingBox())!;
    const tile = (await page.locator(".pick-tile").first().boundingBox())!;
    expect(buttons.every((b) => b.x < strip.x)).toBe(true);
    expect(Math.abs(buttons[0]!.top - tile.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(buttons[2]!.bottom - (tile.y + tile.height))).toBeLessThanOrEqual(1);
    expect(buttons[1]!.top).toBeGreaterThan(buttons[0]!.bottom - 1);
  }
});

test("each map projection is a small picture with its name under it", async ({ page }) => {
  await open(page, 1440, 900);
  const buttons = page.getByTestId("projections").locator("button");
  await expect(buttons).toHaveCount(7);
  for (let i = 0; i < 7; i += 1) {
    const button = buttons.nth(i);
    await expect(button.locator("svg path")).toHaveCount(1);
    const [picture, name] = await Promise.all([button.locator("svg").boundingBox(), button.locator("span").boundingBox()]);
    expect(name!.y).toBeGreaterThan(picture!.y + picture!.height - 1);
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

test("Wide puts the panel under the map and the T key changes the address", async ({ page }) => {
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

test("the Wide button follows the page's language when it changes", async ({ page }) => {
  await open(page, 1440, 900);
  const button = page.getByTestId("wide-toggle").locator("button");
  await expect(button).toHaveText("Wide");
  await page.evaluate(() => document.dispatchEvent(new CustomEvent("kazoku-languagechange", { detail: { lang: "ja" } })));
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(button).toHaveText("ワイド");
});
