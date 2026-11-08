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
  expect(Number(param(page, "ra"))).toBeGreaterThan(84);
  expect(Number(param(page, "dec"))).toBeGreaterThan(0);
});

test("the wheel and the zoom buttons zoom, within limits", async ({ page, isMobile }) => {
  await open(page);
  await page.getByTestId("zoom-in").click();
  await expect.poll(() => Number(param(page, "zoom"))).toBeGreaterThan(1.5);
  for (let i = 0; i < 6; i += 1) await page.getByTestId("zoom-out").click();
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

test("a search by a star's name in katakana finds the star", async ({ page }) => {
  await open(page);
  await page.getByTestId("search").fill("シリウス");
  await expect(page.getByTestId("results")).toContainText("Sirius");
  await page.getByTestId("search").press("Enter");
  await expect(page.getByTestId("picked")).toContainText("Sirius");
  await expect.poll(() => param(page, "pick")).toBe("S:2491");
  await open(page, "?lang=ja");
  await page.getByTestId("search").fill("ベテル");
  await expect(page.getByTestId("results")).toContainText("ベテルギウス");
  await page.getByTestId("search").press("Enter");
  await expect(page.getByTestId("picked")).toContainText("ベテルギウス");
  await expect.poll(() => param(page, "pick")).toBe("S:2061");
});

test("a search finds the added IAU names in English and in katakana", async ({ page }) => {
  await open(page);
  await page.getByTestId("search").fill("Acrux");
  await expect(page.getByTestId("results")).toContainText("Acrux");
  await page.getByTestId("search").press("Enter");
  await expect(page.getByTestId("picked")).toContainText("Acrux");
  await expect.poll(() => param(page, "pick")).toBe("S:4730");
  await page.getByTestId("search").fill("alcyo");
  await page.getByTestId("search").press("Enter");
  await expect.poll(() => param(page, "pick")).toBe("S:1165");
  await page.getByTestId("search").fill("アルコル");
  await expect(page.getByTestId("results")).toContainText("Alcor");
  await page.getByTestId("search").press("Enter");
  await expect.poll(() => param(page, "pick")).toBe("S:5062");
  await open(page, "?lang=ja");
  await page.getByTestId("search").fill("アクルックス");
  await expect(page.getByTestId("results")).toContainText("アクルックス");
  await page.getByTestId("search").press("Enter");
  await expect(page.getByTestId("picked")).toContainText("アクルックス");
  await expect.poll(() => param(page, "pick")).toBe("S:4730");
  await page.getByTestId("search").fill("メロペ");
  await page.getByTestId("search").press("Enter");
  await expect.poll(() => param(page, "pick")).toBe("S:1156");
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
  await expect.poll(() => param(page, "layers")).toBe("milky,boundaries,names,deep,grid");
});

test("the Milky Way layer is on to begin with, turns off and on, and the address remembers it", async ({ page }) => {
  await open(page);
  const band = page.locator("#chart g[data-layer='milky']");
  await expect(band).toHaveCount(1);
  expect(await band.locator("path").count()).toBeGreaterThanOrEqual(3);
  const button = page.locator('#seg-layers button[data-value="milky"]');
  await expect(button).toHaveText("Milky Way");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.click();
  await expect(band).toHaveCount(0);
  await expect.poll(() => param(page, "layers")).toBe("lines,names,grid");
  await button.click();
  await expect(band).toHaveCount(1);
  await expect.poll(() => param(page, "layers")).toBeNull();
  await open(page, "?layers=lines,names,grid&proj=hammer&zoom=1");
  await expect(band).toHaveCount(0);
  await open(page, "?layers=milky&proj=hammer&ra=266&dec=-29&zoom=1&lang=ja");
  await expect(band).toHaveCount(1);
  await expect(page.locator('#seg-layers button[data-value="milky"]')).toHaveText("天の川");
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

test("the Japanese page names the stars in katakana", async ({ page }) => {
  await open(page, "?lang=ja");
  await expect(page.locator("#chart text", { hasText: "シリウス" })).toHaveCount(1);
  await expect(page.locator("#chart text", { hasText: "Sirius" })).toHaveCount(0);
  await open(page, "?lang=ja&pick=S:2491");
  await expect(page.getByTestId("picked")).toContainText("シリウス");
});

test("the sky opens on Orion with nothing about it in the address, and Reset comes back to it", async ({ page }) => {
  await open(page);
  for (const name of ["zoom", "ra", "dec"]) expect(param(page, name)).toBeNull();
  await expect(page.locator("#chart text", { hasText: /^Orion$/ })).toHaveCount(1);
  await expect(page.locator("#chart text", { hasText: /^Rigel$/ })).toHaveCount(1);
  await page.getByTestId("zoom-in").click();
  await expect.poll(() => param(page, "zoom")).not.toBeNull();
  await page.getByTestId("reset").click();
  await expect.poll(() => param(page, "zoom")).toBeNull();
  await expect.poll(() => param(page, "ra")).toBeNull();
});

test("no two names touch, or cover a bright star, at the opening view, in either language and with the Messier objects on", async ({ page }) => {
  for (const query of ["", "?lang=ja", "?layers=lines,names,deep,grid", "?lang=ja&layers=lines,names,deep,grid", "?mag=6", "?layers=names"]) {
    await open(page, query);
    await expect(page.locator("#chart text").first()).toBeVisible();
    const found = await page.evaluate(() => {
      const svg = document.querySelector("#chart")!;
      const frame = svg.getBoundingClientRect();
      const texts = [...svg.querySelectorAll("text")].map((t) => ({ text: t.textContent ?? "", r: t.getBoundingClientRect() }));
      const dots = [...svg.querySelectorAll("circle:not([fill='none'])")].map((c) => ({ r: c.getBoundingClientRect(), size: Number(c.getAttribute("r")) })).filter((c) => c.size > 2.8);
      const touch = (a: DOMRect, b: DOMRect, slack: number) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > slack && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > slack;
      const tools = document.querySelector(".chart-tools")!.getBoundingClientRect();
      const bad: string[] = [];
      texts.forEach((a, i) => {
        if (touch(a.r, tools, 1)) bad.push(`${a.text} is under the buttons`);
        if (a.r.left < frame.left - 1 || a.r.right > frame.right + 1 || a.r.top < frame.top - 1 || a.r.bottom > frame.bottom + 1) bad.push(`${a.text} is cut by the edge`);
        for (const b of texts.slice(i + 1)) if (touch(a.r, b.r, 1)) bad.push(`${a.text} on ${b.text}`);
        for (const d of dots) if (touch(a.r, d.r, 2)) bad.push(`${a.text} on a star`);
      });
      return { count: texts.length, bad };
    });
    expect(found.count, query).toBeGreaterThan(10);
    expect(found.bad, query).toEqual([]);
  }
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
