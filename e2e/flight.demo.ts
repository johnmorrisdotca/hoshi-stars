// The flight page: it opens beside the Sun, drawn as a ball; Go flies to the chosen star, which is a ball there, with the Sun a named star behind; Look at the Sun turns to it and Back to the Sun flies home.
// Where the camera stopped is in the address, in one form, and a page opened with it is there. The view is the package's <hoshi-flight> (its own tests are in flight-element.demo.ts); the page calls its `goTo(id)`
// as a site would. How much it asks of the machine is in freeze.demo.ts.
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/flight.html";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`${PAGE}${query}`);
  await page.waitForFunction(() => (document.querySelector("hoshi-flight") as unknown as { live: boolean } | null)?.live === true, undefined, { timeout: 60_000 });
}
/** What the scene draws now: how many stars are points, and which star is a ball. */
const drawn = (page: Page) =>
  page.getByTestId("fl-stage").evaluate((el) => {
    const { points, ball } = Reflect.get(el, "stats") as { points: number; ball: string | undefined };
    return { points, ball };
  });
const at = (page: Page) => page.locator("html").getAttribute("data-at");
/** The name on a place in the view. */
const mark = (page: Page, id: string) => page.locator(`hoshi-flight [data-mark="${id}"]`);
/** How far the Sun's mark is from the middle of the view, in pixels. */
async function sunFromMiddle(page: Page): Promise<number> {
  const stage = (await page.getByTestId("fl-stage").boundingBox())!;
  const ring = (await mark(page, "sun").locator(".ring").boundingBox())!;
  return Math.hypot(ring.x + ring.width / 2 - (stage.x + stage.width / 2), ring.y + ring.height / 2 - (stage.y + stage.height / 2));
}

test("it opens beside the Sun, a ball among the stars; Go to Vega, see the Sun from there as a named star, and go back", async ({ page }) => {
  await open(page);
  expect(await at(page)).toBe("sun");
  await expect(page.getByTestId("fl-where")).toHaveText("At the Sun.");
  await expect.poll(async () => (await drawn(page)).ball).toBe("sun");
  expect((await drawn(page)).points).toBeGreaterThan(2000);
  await expect(mark(page, "sun")).toBeHidden();

  await page.getByTestId("fl-to").selectOption("hr-7001");
  await page.getByTestId("fl-go").click();
  await expect(page.getByTestId("fl-where")).toHaveText("At Vega.");
  expect(await at(page)).toBe("hr-7001");
  await expect.poll(() => param(page, "at")).toBe("hr-7001");
  await expect(page.getByTestId("fl-readout")).toContainText("25.1 light-years from the Sun");
  await expect.poll(async () => (await drawn(page)).ball).toBe("hr-7001");
  // The Sun is behind the camera, which faces Vega.
  await expect(mark(page, "sun")).toBeHidden();

  await page.getByTestId("fl-sun").click();
  await expect(mark(page, "sun")).toBeVisible();
  await expect(mark(page, "sun")).toHaveText("Sun");
  expect(await sunFromMiddle(page)).toBeLessThan(3);
  expect(await at(page), "a look moves nothing").toBe("hr-7001");

  await page.getByTestId("fl-home").click();
  await expect(page.getByTestId("fl-where")).toHaveText("At the Sun.");
  await expect.poll(() => param(page, "at")).toBeNull();
  await expect.poll(async () => (await drawn(page)).ball).toBe("sun");
});

test("the address says where the camera is: a place by its id, a point in parsecs, each written one way", async ({ page }) => {
  await open(page, "?at=HR-7001");
  await expect(page.getByTestId("fl-where")).toHaveText("At Vega.");
  expect(await at(page)).toBe("hr-7001");
  await expect.poll(async () => (await drawn(page)).ball).toBe("hr-7001");
  await expect.poll(() => param(page, "at")).toBe("hr-7001");

  await open(page, "?at=pc_1.0_0_0");
  await expect(page.getByTestId("fl-where")).toHaveText("Between the stars.");
  expect(await at(page)).toBe("pc_1_0_0");
  await expect(page.getByTestId("fl-readout")).toContainText("3.26 light-years from the Sun");
  expect((await drawn(page)).ball).toBeUndefined();
  // From a point it opens facing the Sun, a star with its name on it.
  await expect(mark(page, "sun")).toBeVisible();
  expect(await sunFromMiddle(page)).toBeLessThan(3);

  await open(page, "?at=nowhere");
  expect(await at(page)).toBe("sun");
});

test("in Japanese the words and the star's name are Japanese", async ({ page }) => {
  await open(page, "?at=hr-7001&lang=ja");
  await expect(page.getByTestId("fl-where")).toHaveText("ベガ にいます。");
  await expect(page.getByTestId("fl-go")).toHaveText("行く");
});

test.describe("flying", () => {
  test.use({ reducedMotion: "no-preference" });

  test("goTo is a flight: it leaves the Sun, the way to go counts down, Vega grows from a point to a ball, and it stops there; then it looks back at the Sun and flies home", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
    const moving = () => page.locator("html").getAttribute("data-moving");
    expect(await page.getByTestId("fl-stage").evaluate((el) => (el as unknown as { goTo(id: string): boolean }).goTo("hr-7001"))).toBe(true);
    await expect(page.getByTestId("fl-where")).toHaveText("Flying to Vega.");
    await expect(page.getByTestId("fl-readout")).toContainText("to go");
    // On the way it is at a point between the two, and neither star is a ball.
    await expect.poll(async () => (await drawn(page)).ball, { timeout: 30_000 }).toBeUndefined();
    expect(await at(page)).toMatch(/^pc_/);
    expect(param(page, "at"), "the address waits for the stop").toBeNull();
    await expect(mark(page, "hr-7001")).toBeVisible();
    await expect.poll(moving, { timeout: 60_000 }).toBe("false");
    await expect(page.getByTestId("fl-where")).toHaveText("At Vega.");
    expect(await at(page)).toBe("hr-7001");
    await expect.poll(() => param(page, "at")).toBe("hr-7001");
    expect((await drawn(page)).ball).toBe("hr-7001");

    await page.getByTestId("fl-sun").click();
    await expect.poll(moving, { timeout: 30_000 }).toBe("false");
    expect(await sunFromMiddle(page)).toBeLessThan(3);
    expect(await at(page)).toBe("hr-7001");

    await page.getByTestId("fl-home").click();
    await expect(page.getByTestId("fl-where")).toHaveText("Flying to the Sun.");
    await expect.poll(moving, { timeout: 60_000 }).toBe("false");
    await expect(page.getByTestId("fl-where")).toHaveText("At the Sun.");
    expect((await drawn(page)).ball).toBe("sun");
    expect(await page.getByTestId("fl-stage").evaluate((el) => (el as unknown as { goTo(id: string): boolean }).goTo("hr-0"))).toBe(false);
  });
});

test("the embed page is the element filling the frame, opened where its address says, and it flies to `to`", async ({ page }) => {
  await page.goto("/hoshi-stars/embed-flight.html?at=gctp-3278&to=hr-7001&lang=ja");
  await page.waitForFunction(() => (document.querySelector("hoshi-flight") as unknown as { live: boolean } | null)?.live === true, undefined, { timeout: 60_000 });
  expect(await page.locator("hoshi-flight").evaluate((el) => (el as unknown as { status: { at: string } }).status.at)).toBe("hr-7001");
  await expect(page.locator('hoshi-flight [data-mark="sun"] .name')).toHaveText("太陽");
  const box = (await page.locator("hoshi-flight").boundingBox())!;
  expect(box.width).toBe(page.viewportSize()!.width);
});
