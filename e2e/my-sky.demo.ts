// The My sky page and its element: the sky of a fixed moment is drawn (a dark ground under a lit horizon, stars above it), the Moon's panel says its phase, % lit and rise and set, a drag, the arrow keys and a touch turn the view the
// right way, a tap on the Moon says so, Sydney opens facing north, Japanese words follow the page, nothing is drawn at rest (a live sky ticks once in ten seconds, a minute under reduced motion), and the page fits a phone.
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/my-sky.html";

/** A Vancouver evening: 04:00 UTC on 17 November 2026 (about 8 in the evening), the Moon at first quarter 47% lit, 20 degrees up in the south-west, Saturn up. */
const EVENING = "place=vancouver&t=2026-11-17T04:00:00Z";
const NOON = "place=vancouver&t=2026-11-12T20:00:00Z";

interface SkyElement extends HTMLElement {
  heading: number;
  pitch: number;
  fov: number;
  setView(change: { heading?: number; pitch?: number; fov?: number }): void;
  sky: { moon: { azimuth: number; altitude: number }; sun: { altitude: number }; limit: number } | undefined;
  _stats: { draws: number };
}

const sky = (page: Page) => page.locator("hoshi-my-sky");
const view = (page: Page) => sky(page).evaluate((el) => ({ heading: (el as SkyElement).heading, pitch: (el as SkyElement).pitch, fov: (el as SkyElement).fov }));
const drawn = (page: Page) => sky(page).evaluate((el) => (el as SkyElement)._stats.draws);

/** The share of a row of the canvas that is brighter than a dim star. */
const brightPixels = (page: Page) =>
  sky(page).evaluate((el) => {
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>("canvas.sky")!;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let bright = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i]! + data[i + 1]! + data[i + 2]! > 420) bright++;
    const at = (x: number, y: number): number[] => Array.from(data.slice((y * canvas.width + x) * 4, (y * canvas.width + x) * 4 + 3));
    return { bright, ground: at(Math.round(canvas.width / 2), canvas.height - 4), top: at(Math.round(canvas.width * 0.3), 6) };
  });

async function ready(page: Page, query: string): Promise<void> {
  await page.goto(`${PAGE}?${query}`);
  await expect(sky(page).locator(".title")).not.toHaveText("");
  await sky(page).scrollIntoViewIfNeeded();
  await expect.poll(() => drawn(page)).toBeGreaterThan(0);
  // the Moon's times are written in the `timezone` of the element (else the device's): name one with no daylight saving (UTC-7), so the words are the same on every machine
  await sky(page).evaluate((el) => el.setAttribute("timezone", "Etc/GMT+7"));
}

test("an evening in Vancouver: stars over a dark ground, the Moon's phase, % lit, rise and set, and the planet that is up", async ({ page }) => {
  await ready(page, EVENING);
  await expect(sky(page).locator(".title")).toHaveText("First quarter");
  await expect(sky(page).locator(".rows")).toContainText("47% lit");
  await expect(sky(page).locator(".rows")).toContainText("Rises tomorrow");
  await expect(sky(page).locator(".rows")).toContainText(/Sets 11:58 p\.?m\.?/i);
  await expect(sky(page).locator(".rows")).toContainText("Planets up: Saturn");
  await expect(sky(page).locator(".facing")).toHaveText("Facing south, looking 35° up");
  expect(await view(page)).toEqual({ heading: 180, pitch: 35, fov: 90 });
  const pixels = await brightPixels(page);
  expect(pixels.bright).toBeGreaterThan(300);
  // the ground at the bottom is dark but not empty (it is not pure black), and the sky above is a little bluer
  expect(pixels.ground[0]! + pixels.ground[1]! + pixels.ground[2]!).toBeLessThan(60);
  expect(pixels.ground[2]!).toBeGreaterThan(2);
  expect(pixels.top[2]!).toBeGreaterThan(pixels.ground[2]!);
});

test("a drag turns the view the way the sky is pulled, and the head stops at straight up", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "the family's controller is checked with a mouse in Chromium");
  await ready(page, EVENING);
  const box = (await sky(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await sky(page).evaluate((el) => el.addEventListener("hoshi-sky-view", (event) => ((window as unknown as { seen: unknown[] }).seen ??= []).push((event as CustomEvent).detail)));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 120, y, { steps: 8 });
  await page.mouse.up();
  const right = await view(page);
  // the sky was pulled to the right, so you now face to the left: east of south
  expect(right.heading).toBeLessThan(180);
  expect(180 - right.heading).toBeGreaterThan(15);
  expect(right.pitch).toBeCloseTo(35, 0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 100, { steps: 8 });
  await page.mouse.up();
  expect((await view(page)).pitch).toBeGreaterThan(right.pitch + 10);
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 300, { steps: 6 });
    await page.mouse.up();
  }
  expect((await view(page)).pitch).toBe(90);
  const seen = await page.evaluate(() => (window as unknown as { seen: Array<{ final: boolean; heading: number }> }).seen);
  expect(seen.length).toBeGreaterThan(5);
  expect(seen.some((s) => s.final)).toBe(true);
});

test("a touch drag turns the view too", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "touch events are sent through Chromium's own protocol");
  await ready(page, EVENING);
  const box = (await sky(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step++) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - step * 12, y }] });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  // the sky was pulled to the left, so you now face to the right: west of south
  await expect.poll(async () => (await view(page)).heading).toBeGreaterThan(185);
});

test("two fingers dragging together turn the sky, at the opening field of view and zoomed in (MODULES-1530)", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "touch events are sent through Chromium's own protocol");
  await ready(page, EVENING);
  const client = await page.context().newCDPSession(page);
  for (const fov of [undefined, 40]) {
    await sky(page).evaluate((el, narrow) => (el as SkyElement).setView({ heading: 180, pitch: 20, ...(narrow === undefined ? {} : { fov: narrow }) }), fov);
    const before = await view(page);
    const box = (await sky(page).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x - 40, y, id: 1 }, { x: x + 40, y, id: 2 }] });
    // the two fingers do not arrive together: the first moves, then the second, as a real pair do
    for (let step = 1; step <= 8; step++) {
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 40 - step * 8, y: y + step * 3, id: 1 }, { x: x + 40 - (step - 1) * 8, y: y + (step - 1) * 3, id: 2 }] });
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 40 - step * 8, y: y + step * 3, id: 1 }, { x: x + 40 - step * 8, y: y + step * 3, id: 2 }] });
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    // the sky was pulled left and down, so you now face to the right of south, and tipped up
    await expect.poll(async () => (await view(page)).heading, { message: `at a field of ${fov ?? "the opening"}` }).toBeGreaterThan(before.heading + 3);
    expect((await view(page)).pitch).toBeGreaterThan(before.pitch + 1);
    expect(Math.abs((await view(page)).fov - before.fov)).toBeLessThan(1);
  }
});

test("the arrow keys look the way they point, + and - change the field of view, Home goes back, and each says so", async ({ page }) => {
  await ready(page, EVENING);
  await sky(page).focus();
  await sky(page).evaluate((el) => el.addEventListener("hoshi-sky-view", (event) => ((window as unknown as { last: unknown }).last = (event as CustomEvent).detail)));
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await view(page)).heading).toBeCloseTo(190, 0);
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await view(page)).pitch).toBeCloseTo(45, 0);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await view(page)).heading).toBeCloseTo(170, 0);
  await page.keyboard.press("ArrowDown");
  await expect.poll(async () => (await view(page)).pitch).toBeCloseTo(35, 0);
  const before = (await view(page)).fov;
  await page.keyboard.press("+");
  await expect.poll(async () => (await view(page)).fov).toBeLessThan(before - 5);
  await page.keyboard.press("Home");
  await expect.poll(async () => await view(page)).toEqual({ heading: 180, pitch: 35, fov: 90 });
  expect(await page.evaluate(() => (window as unknown as { last: { final: boolean } }).last.final)).toBe(true);
});

test("a tap on the Moon picks it and says where it is; a tap on nothing picks nothing", async ({ page }) => {
  await ready(page, EVENING);
  await sky(page).evaluate((el) => {
    const s = el as SkyElement;
    s.setView({ heading: s.sky!.moon.azimuth, pitch: s.sky!.moon.altitude, fov: 40 });
    el.addEventListener("hoshi-sky-pick", (event) => ((window as unknown as { picks: unknown[] }).picks ??= []).push((event as CustomEvent).detail));
  });
  await page.waitForTimeout(200);
  const box = (await sky(page).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(sky(page).locator(".note")).toContainText("Moon: 20° above the horizon, south-west");
  expect(await page.evaluate(() => (window as unknown as { picks: unknown[] }).picks)).toEqual([{ kind: "moon", id: "moon" }]);
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.12);
  await expect(sky(page).locator(".note")).toBeHidden();
});

test("Sydney opens facing north, toward the equator, and Japanese words follow the page", async ({ page }) => {
  await ready(page, "place=sydney&t=2026-11-17T10:00:00Z");
  expect((await view(page)).heading).toBe(0);
  await expect(sky(page).locator(".facing")).toHaveText("Facing north, looking 35° up");
  await page.goto(`${PAGE}?${EVENING}&lang=ja`);
  await expect(sky(page).locator(".title")).toHaveText("上弦の月");
  await sky(page).evaluate((el) => el.setAttribute("timezone", "Etc/GMT+7"));
  await expect(sky(page).locator(".rows")).toContainText("月の47%が光っています");
  await expect(sky(page).locator(".rows")).toContainText("月の出 明日");
  await expect(sky(page).locator(".rows")).toContainText("月の入り 23:58");
  await expect(sky(page).locator(".rows")).toContainText("空に出ている惑星: 土星");
  await expect(sky(page).locator(".facing")).toHaveText("南を向いて、35°見上げています");
});

test("at noon the Sun is up, the stars are hidden by daylight and the panel says so", async ({ page }) => {
  await ready(page, NOON);
  await expect(sky(page).locator(".note")).toContainText("It is daytime");
  expect(await sky(page).evaluate((el) => (el as SkyElement).sky!.limit)).toBe(-3);
  // the sky is the blue of day, not the black-blue of night
  const pixels = await brightPixels(page);
  expect(pixels.top[2]!).toBeGreaterThan(120);
  expect(pixels.top[2]!).toBeGreaterThan(pixels.ground[2]! + 60);
});

test("nothing is drawn at rest, a fixed sky never ticks, and without a place the element says what it needs", async ({ page }) => {
  await ready(page, EVENING);
  await page.waitForTimeout(400);
  const first = await drawn(page);
  await page.waitForTimeout(1500);
  expect(await drawn(page)).toBe(first);
  await page.goto(`${PAGE}?place=vancouver`);
  await expect(sky(page).locator(".title")).not.toHaveText("");
  await expect.poll(() => drawn(page)).toBeGreaterThan(0);
  const live = await drawn(page);
  // reduced motion is on in every project: a live sky waits a minute, not ten seconds
  await page.waitForTimeout(2000);
  expect(await drawn(page)).toBe(live);
  await page.evaluate(() => {
    const el = document.querySelector("hoshi-my-sky")!;
    el.removeAttribute("latitude");
    el.removeAttribute("longitude");
  });
  await expect(sky(page).locator(".message")).toHaveText("A latitude and a longitude are needed to show a sky");
});

test("the page fits the width of the screen and the sky has a size", async ({ page }) => {
  await ready(page, EVENING);
  const fit = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  expect(fit.scroll).toBeLessThanOrEqual(fit.width);
  const box = (await sky(page).boundingBox())!;
  expect(box.width).toBeGreaterThan(300);
  expect(box.height).toBeGreaterThan(300);
  const panel = (await sky(page).locator(".panel").boundingBox())!;
  expect(panel.x + panel.width).toBeLessThanOrEqual(box.x + box.width);
  await sky(page).locator(".toggle").click();
  await expect(sky(page).locator(".rows")).toBeHidden();
  await sky(page).locator(".toggle").click();
  await expect(sky(page).locator(".rows")).toBeVisible();
});

test("choosing a city or typing a place moves the sky, and the place is in the address", async ({ page }) => {
  await ready(page, EVENING);
  await page.locator('button[data-place="tokyo"]').click();
  await expect(page.locator("#lat")).toHaveValue("35.68");
  await expect(sky(page)).toHaveAttribute("latitude", "35.68");
  await expect.poll(() => new URL(page.url()).searchParams.get("place")).toBe("tokyo");
  await page.locator("#lat").fill("-45");
  await page.locator("#lat").blur();
  await expect.poll(() => new URL(page.url()).searchParams.get("lat")).toBe("-45");
  await expect(sky(page)).toHaveAttribute("latitude", "-45");
});
