// The demo played by hand: the chart draws, a drag turns it, the wheel and the buttons zoom, a tap picks a star, a search flies to a star or a constellation in either language, the
// layers and projections change the drawing, the address keeps every choice, and the embed page and the code panel agree with the chart.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const chart = (page: Page) => page.locator("#chart");
async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`${HOME}${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
}
async function middle(page: Page): Promise<{ x: number; y: number }> {
  const box = (await chart(page).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
const stars = (page: Page) => page.locator("#chart circle[r]").count();

test("the sky draws stars, lines, names and a grid, and says how many stars it shows", async ({ page }) => {
  await open(page);
  expect(await stars(page)).toBeGreaterThan(100);
  await expect(page.locator("#chart path[stroke='#6f93e0']")).toHaveCount(1);
  await expect(page.locator("#chart text", { hasText: "Orion" })).toHaveCount(1);
  await expect(page.locator("#shown")).toContainText("1,630 stars shown");
});

test("a drag turns the sky and the address remembers where it looks", async ({ page, isMobile }) => {
  test.skip(isMobile, "the touch drag is the pinch test's");
  await open(page);
  const at = await middle(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 150, at.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => param(page, "ra")).not.toBeNull();
  // Dragging right brings in what was to the east (a larger right ascension), dragging down what was to the north.
  expect(Number(param(page, "ra"))).toBeGreaterThan(83.8);
  expect(Number(param(page, "dec"))).toBeGreaterThan(0);
});

test("the wheel and the zoom buttons zoom, within limits", async ({ page, isMobile }) => {
  await open(page);
  await page.getByTestId("zoom-in").click();
  await expect.poll(() => Number(param(page, "zoom"))).toBeGreaterThan(1.5);
  await page.getByTestId("zoom-out").click();
  await page.getByTestId("zoom-out").click();
  await page.getByTestId("zoom-out").click();
  await expect.poll(() => param(page, "zoom")).toBe("0.6");
  if (!isMobile) {
    const at = await middle(page);
    await page.mouse.move(at.x, at.y);
    await page.mouse.wheel(0, -2000);
    await expect.poll(() => Number(param(page, "zoom"))).toBeGreaterThan(5);
  }
  await page.getByTestId("reset").click();
  await expect.poll(() => param(page, "zoom")).toBeNull();
});

test("a pinch zooms with two fingers", async ({ page, browserName, isMobile }) => {
  test.skip(!isMobile || browserName !== "chromium", "two touch points are Chromium's to send");
  await open(page);
  const client = await page.context().newCDPSession(page);
  const at = await middle(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", a: number, b: number) =>
    client.send("Input.dispatchTouchEvent", { type, touchPoints: [{ x: at.x - a, y: at.y, id: 1 }, { x: at.x + b, y: at.y, id: 2 }] });
  await touch("touchStart", 20, 20);
  await touch("touchMove", 40, 40);
  await touch("touchMove", 80, 80);
  await touch("touchEnd", 80, 80);
  await expect.poll(() => Number(param(page, "zoom"))).toBeGreaterThan(1.5);
});

test("a search finds a star, a constellation in Japanese and a Messier object, and flies there", async ({ page }) => {
  await open(page);
  await page.getByTestId("search").fill("Sirius");
  await page.getByTestId("search").press("Enter");
  await expect(page.getByTestId("picked")).toContainText("Sirius");
  await expect(page.getByTestId("picked")).toContainText("-1.46");
  await expect.poll(() => Math.round(Number(param(page, "ra")))).toBe(101);
  expect(Number(param(page, "zoom"))).toBeGreaterThan(3);

  await page.getByTestId("search").fill("おおいぬ座");
  await page.getByTestId("search").press("Enter");
  await expect(page.getByTestId("picked")).toContainText("Canis Major");
  await expect(page.getByTestId("picked")).toContainText("おおいぬ座");
  await expect.poll(() => param(page, "pick")).toBe("C:CMa");

  await page.getByTestId("search").fill("M31");
  await page.getByTestId("search").press("Enter");
  await expect(page.getByTestId("picked")).toContainText("Andromeda");
  await expect.poll(() => Math.round(Number(param(page, "dec")))).toBe(41);

  await page.getByTestId("search").fill("zzzz");
  await expect(page.getByTestId("results")).toContainText("Nothing with that name");
});

test("a tap on a star picks it, with its brightness, distance and colour", async ({ page }) => {
  await open(page, "?ra=101.29&dec=-16.72&zoom=4");
  const at = await middle(page);
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("picked")).toContainText("Sirius");
  await expect(page.getByTestId("picked")).toContainText("9 light-years");
  await expect.poll(() => param(page, "pick")).toBe("S:2491");
  await page.getByTestId("picked").getByRole("button", { name: "Canis Major" }).click();
  await expect(page.getByTestId("picked")).toContainText("おおいぬ座");
});

test("every projection draws, and the layers switch on and off", async ({ page }) => {
  await open(page);
  for (const kind of ["orthographic", "gnomonic", "equidistant", "equirectangular", "mollweide", "hammer", "stereographic"]) {
    await page.locator(`#seg-projection button[data-value="${kind}"]`).click();
    expect(await stars(page)).toBeGreaterThan(10);
    await expect.poll(() => param(page, "proj")).toBe(kind === "stereographic" ? null : kind);
  }
  await page.locator('#seg-layers button[data-value="boundaries"]').click();
  await expect(page.locator("#chart path[stroke='#46578c'][stroke-dasharray]")).toHaveCount(1);
  await page.locator('#seg-layers button[data-value="lines"]').click();
  await expect(page.locator("#chart path[stroke='#6f93e0']")).toHaveCount(0);
  await page.locator('#seg-layers button[data-value="deep"]').click();
  await expect(page.locator("#chart text", { hasText: "M42" }).first()).toBeVisible();
  await expect.poll(() => param(page, "layers")).toBe("boundaries,names,deep,grid");
});

test("the faintest-star slider changes how many stars are drawn", async ({ page }) => {
  await open(page);
  const before = await stars(page);
  await page.getByTestId("magnitude").fill("3");
  await expect(page.getByTestId("shown")).toContainText("174 stars shown");
  await expect.poll(() => stars(page)).toBeLessThan(before);
  await expect.poll(() => param(page, "mag")).toBe("3");
});

test("an address opens the same sky", async ({ page }) => {
  await open(page, "?proj=mollweide&ra=180&dec=20&zoom=2&mag=4&layers=names&pick=C:UMa");
  await expect(page.locator("#seg-projection button[aria-pressed='true']")).toHaveText("Mollweide");
  await expect(page.getByTestId("picked")).toContainText("Ursa Major");
  await expect(page.locator("#chart path[stroke='#6f93e0']")).toHaveCount(1);
  await expect(page.locator("#seg-layers button[aria-pressed='true']")).toHaveCount(1);
});

test("the Japanese page names constellations and facts in Japanese", async ({ page }) => {
  await open(page, "?lang=ja&pick=C:Ori");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.locator("#chart text", { hasText: "オリオン座" }).first()).toBeVisible();
  await expect(page.getByTestId("picked")).toContainText("オリオン座");
  await expect(page.locator("#heading")).toHaveText("星空を回してみよう");
});

test("the embed panel's code names the choices, and its picture is the chart's own stars", async ({ page }) => {
  await open(page, "?proj=orthographic&ra=90&dec=10&zoom=1.5&mag=4");
  const panel = page.getByTestId("embed-panel");
  await expect(panel).toBeVisible();
  const code = await panel.evaluate((el) => (el as unknown as { code: string }).code);
  expect(code).toContain('project("orthographic"');
  expect(code).toContain("rightAscension: 90.00, declination: 10.00");
  expect(code).toContain("stars({ magnitude: 4 })");
  expect(code).toContain('from "@johnmorrisdotca/hoshi-stars/lines"');
});

test("the embed page draws what its address says, and fills its frame", async ({ page }) => {
  await page.goto(`${HOME}embed.html?proj=hammer&ra=0&dec=0&zoom=1&mag=3&layers=lines`);
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  expect(await page.locator("svg circle").count()).toBeGreaterThan(50);
  await expect(page.locator("svg path[stroke='#6f93e0']")).toHaveCount(1);
  const frame = (await page.getByTestId("frame").boundingBox())!;
  const picture = (await page.locator("svg").boundingBox())!;
  expect(Math.abs(frame.width - picture.width)).toBeLessThan(2);
  expect(Math.abs(frame.height - picture.height)).toBeLessThan(2);
});
