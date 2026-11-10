// Deep-sky objects at their true size, and their pictures: an outline that grows with the zoom, a picture that is fetched and shown only when zoomed in, a card that says what is measured and
// credits the picture, a layer toggle kept in the address, the bright stars inside a cluster, and the NGC and IC objects once zoomed in. The embed page draws them too.
import { expect, test, type Page } from "@playwright/test";
import { deepSkyPicture } from "../src/deep-sky-pictures.ts";

const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const webp = (page: Page): string[] => {
  const found: string[] = [];
  page.on("request", (request) => request.url().endsWith(".webp") && found.push(request.url()));
  return found;
};
/** The width in pixels of an object's mark. */
const widthOf = (page: Page, id: string): Promise<number> => page.locator(`#chart [data-deep="${id}"]`).first().evaluate((node) => node.getBoundingClientRect().width);
/** The middle of an element on the page. */
const middleOf = (page: Page, selector: string): Promise<{ x: number; y: number; width: number }> =>
  page.locator(selector).first().evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width };
  });
async function fly(page: Page, text: string): Promise<void> {
  await page.fill("#search", text);
  await page.locator("#results button").first().click();
}

test("a galaxy is drawn at its true size and grows with the zoom", async ({ page }) => {
  const measured = async (zoom: number): Promise<number> => {
    await page.goto(`/hoshi-stars/?layers=milky,deep,names&ra=10.68&dec=41.27&zoom=${zoom}`);
    await expect(page.locator('#chart [data-deep="M31"]')).toHaveCount(1);
    // the chart is laid out a frame after it is drawn, and may draw again as it settles: take the width once two reads 150 ms apart agree, and return that
    // very read (reading again after the wait could catch the outline mid-redraw, at 0)
    let width = 0;
    await expect
      .poll(async () => {
        const first = await widthOf(page, "M31");
        await page.waitForTimeout(150);
        width = await widthOf(page, "M31");
        return first === width && width > 20;
      }, { timeout: 15_000, intervals: [0] })
      .toBe(true);
    return width;
  };
  const near = await measured(20);
  const closer = await measured(40);
  expect(closer / near).toBeGreaterThan(1.6);
  expect(closer / near).toBeLessThan(2.4);
});

test("a picture is not fetched at the opening view; zoomed in on a galaxy it is fetched once, shown, and kept in step with the sky", async ({ page }) => {
  const asked = webp(page);
  await page.goto("/hoshi-stars/");
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await page.waitForTimeout(500);
  expect(asked).toEqual([]);
  expect(await page.locator("#chart image").count()).toBe(0);
  await fly(page, "M51");
  await expect(page.locator("#chart image[data-pic='M51']")).toHaveCount(1, { timeout: 20_000 });
  expect(Number(await page.locator("#chart image[data-pic='M51']").getAttribute("opacity"))).toBeGreaterThan(0.4);
  const mine = asked.filter((url) => url.includes("M51"));
  expect(mine.length).toBeGreaterThanOrEqual(1);
  expect(new Set(mine).size, "each picture is fetched once").toBe(mine.length);
  expect(asked.length).toBeLessThanOrEqual(6);
  // the picture is centred on the object it shows: its middle is within a tenth of its width of the outline's
  const picture = await middleOf(page, "#chart image[data-pic='M51']");
  const outline = await middleOf(page, '#chart [data-deep="M51"]');
  expect(Math.hypot(picture.x - outline.x, picture.y - outline.y)).toBeLessThan(picture.width * 0.1 + 30);
});

test("the Pictures layer is a toggle kept in the address", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await fly(page, "M13");
  await expect(page.locator("#chart image[data-pic='M13']")).toHaveCount(1, { timeout: 20_000 });
  await page.locator('#seg-layers button[data-value="pictures"]').click();
  await expect(page.locator("#chart image")).toHaveCount(0);
  await expect.poll(() => param(page, "layers")).not.toContain("pictures");
  await page.reload();
  await expect(page.locator("#chart g").first()).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator("#chart image")).toHaveCount(0);
  await page.locator('#seg-layers button[data-value="pictures"]').click();
  await expect(page.locator("#chart image[data-pic='M13']")).toHaveCount(1, { timeout: 20_000 });
});

test("the card says what is measured and what is drawn, and credits the picture", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await fly(page, "M31");
  const card = page.locator("#picked");
  await expect(card.locator("h3")).toContainText("M31");
  await expect(card).toContainText("190.5 × 61.7 arc-minutes");
  await expect(card).toContainText("35° east of north");
  await expect(card).toContainText("RC3");
  await expect(card).toContainText("An ellipse at the measured size, axis ratio and angle.");
  await expect(card.getByTestId("picture-credit").first()).toContainText(/SDSS|2MASS|WISE/);
  await expect(card.getByTestId("picture-credit").first()).toContainText("Licence:");
  await fly(page, "M42");
  await expect(card).toContainText("66 arc-minutes across (one diameter)");
  await expect(card).toContainText("not measured");
  await expect(card).toContainText("A circle across the major diameter");
});

test("the card is in Japanese when the page is", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await page.evaluate(() => document.documentElement.setAttribute("lang", "ja"));
  await page.evaluate(() => document.dispatchEvent(new CustomEvent("hoshi-language")));
  await fly(page, "M31");
  await expect(page.locator("#picked")).toContainText("北から東回りに 35°");
  await expect(page.locator("#picked")).toContainText("クレジット:");
});

test("the bright stars inside an open cluster are ringed and listed, and said not to be checked", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await fly(page, "M45");
  await expect(page.locator("#chart [data-inside]").first()).toBeVisible({ timeout: 20_000 });
  expect(await page.locator("#chart [data-inside]").count()).toBeGreaterThanOrEqual(5);
  await expect(page.locator("#picked")).toContainText("Alcyone");
  await expect(page.getByTestId("inside-note")).toContainText("not checked");
});

test("the NGC and IC objects arrive when the map is zoomed in, can be searched and picked, and have their card", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await page.fill("#search", "NGC 253");
  await expect(page.locator("#results button").first()).toContainText("NGC 253", { timeout: 20_000 });
  await page.locator("#results button").first().click();
  await expect(page.locator("#picked h3")).toContainText("NGC 253");
  await expect(page.locator("#picked")).toContainText("RC3");
  await expect(page.locator('#chart [data-deep="NGC 253"]')).toHaveCount(1);
});

test("an object with no measured size is a dotted symbol, and says so", async ({ page }) => {
  await page.goto("/hoshi-stars/?layers=deep&ra=300&dec=-5&zoom=3");
  await fly(page, "M40");
  await expect(page.locator("#picked")).toContainText("not measured");
  await expect(page.locator("#picked")).toContainText("A dotted symbol of fixed size");
  await expect(page.locator('#chart [data-deep="M40"] [stroke-dasharray]')).not.toHaveCount(0);
});

test("the embed page draws the picture of the object it is aimed at", async ({ page }) => {
  await page.goto("/hoshi-stars/embed.html?ra=202.47&dec=47.2&zoom=300&layers=milky,deep,pictures");
  await expect(page.locator("#frame image[data-pic='M51']")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator('#frame [data-deep="M51"]')).toHaveCount(1);
});

/** How many chart pixels one pixel of a picture is on the chart now (the scale of its matrix). */
const pixelOf = (page: Page, id: string): Promise<number> =>
  page.locator(`#chart image[data-pic='${id}']`).first().evaluate((node) => {
    const [a = 0, b = 0] = (node.getAttribute("transform") ?? "").replace(/matrix\(|\)/g, "").split(" ").map(Number);
    return Math.hypot(a, b);
  });

test("the Ring Nebula, the smallest object with a picture, can be zoomed in on until it fills the view, its Hubble picture still sharp", async ({ page }) => {
  await page.goto("/hoshi-stars/?ra=283.396&dec=33.029&zoom=7000&pick=D:M57");
  await expect(page.locator("#chart image[data-pic='M57-heic1310a']")).toHaveCount(1, { timeout: 20_000 });
  for (let i = 0; i < 3; i += 1) await page.getByTestId("zoom-in").click();
  await expect.poll(() => Number(param(page, "zoom"))).toBeGreaterThanOrEqual(7000);
  expect(Number(param(page, "zoom"))).toBeLessThanOrEqual(8000);
  // the ring (1 arc-minute) fills over a third of the smaller side of the chart
  const chart = (await page.locator("#chart").boundingBox())!;
  await expect.poll(() => widthOf(page, "M57")).toBeGreaterThan(Math.min(chart.width, chart.height) * 0.35);
  expect(await pixelOf(page, "M57-heic1310a")).toBeLessThanOrEqual(1.01);
  expect(await pixelOf(page, "M57-heic1310a")).toBeGreaterThan(0.5);
  // the survey picture under it (1.4 arc-seconds a pixel) is stretched about eight times: it is drawn, softened (dimmed), round the Hubble picture, never left out
  await expect(page.locator("#chart image[data-pic='M57']")).toHaveCount(1, { timeout: 20_000 });
  expect(Number(await page.locator("#chart image[data-pic='M57']").getAttribute("opacity"))).toBeLessThan(0.7);
  expect(Number(await page.locator("#chart image[data-pic='M57']").getAttribute("opacity"))).toBeGreaterThan(0.4);
  // the zoom readout holds a number of four digits
  const readout = page.getByTestId("zoom-readout");
  await expect(readout).toHaveText(/^\d[\d,]*×$/);
  expect(await readout.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});

test("a picture with less detail stops the zoom where its own pixels run out, and a step out starts from there", async ({ page }) => {
  const phone = page.viewportSize()!.width < 600;
  // M91's survey picture is 2 arc-seconds a pixel: one of its pixels is one chart pixel at a zoom of about 1,100 on a phone and about 600 to 700 on a desk, well short of 8000
  await page.goto(`/hoshi-stars/?ra=188.86&dec=14.496&zoom=${phone ? 900 : 450}&pick=D:M91`);
  await expect(page.locator("#chart image[data-pic='M91']")).toHaveCount(1, { timeout: 20_000 });
  for (let i = 0; i < 8; i += 1) await page.getByTestId("zoom-in").click();
  await page.waitForTimeout(300);
  await expect.poll(() => Number(param(page, "zoom"))).toBeGreaterThan(500);
  const stopped = Number(param(page, "zoom"));
  expect(stopped).toBeLessThan(1300);
  expect(await pixelOf(page, "M91")).toBeLessThanOrEqual(1.01);
  await page.getByTestId("zoom-out").click();
  await expect.poll(() => Number(param(page, "zoom"))).toBeLessThan(stopped * 0.7);
  await page.getByTestId("zoom-in").click();
  await expect.poll(() => Number(param(page, "zoom"))).toBeGreaterThan(stopped * 0.9);
  expect(await pixelOf(page, "M91")).toBeLessThanOrEqual(1.01);
});

test("flying to a small object with a picture never draws the picture past its pixels", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await fly(page, "M72");
  await expect(page.locator("#chart image[data-pic='M72']")).toHaveCount(1, { timeout: 20_000 });
  await expect.poll(() => pixelOf(page, "M72")).toBeLessThanOrEqual(1.01);
  // and it is there to see, not faded away
  expect(Number(await page.locator("#chart image[data-pic='M72']").first().getAttribute("opacity"))).toBeGreaterThan(0.4);
});

test("at the top of the zoom the faint stars ask for no more tiles than the view needs, and nothing more at rest", async ({ page }) => {
  const tiles: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/faint-tiles/")) tiles.push(request.url());
  });
  await page.goto("/hoshi-stars/?ra=283.396&dec=33.029&zoom=8000");
  await expect(page.getByTestId("faint-note")).toContainText("Stars to magnitude");
  await page.waitForTimeout(1500);
  const asked = tiles.length;
  expect(asked).toBeLessThanOrEqual(6);
  await page.waitForTimeout(1500);
  expect(tiles.length).toBe(asked);
});

test("the pictures are not blocked by the page's Content-Security-Policy (the map draws them from blob addresses)", async ({ page }) => {
  const blocked: string[] = [];
  page.on("console", (message) => message.text().includes("Content Security Policy") && blocked.push(message.text()));
  await page.goto("/hoshi-stars/?ra=202.47&dec=47.195&zoom=500&pick=D:M51");
  await expect(page.locator("#chart image[data-pic='M51']")).toHaveCount(1, { timeout: 20_000 });
  // the picture itself is loaded: an image element given the same address decodes
  const size = await page.evaluate(async () => {
    const href = document.querySelector("#chart image[data-pic='M51']")!.getAttribute("href")!;
    const image = new Image();
    image.src = href;
    await image.decode();
    return image.naturalWidth;
  });
  expect(size).toBeGreaterThan(100);
  await page.goto("/hoshi-stars/embed.html?ra=202.47&dec=47.2&zoom=300&layers=milky,deep,pictures");
  await expect(page.locator("#frame image[data-pic='M51']")).toHaveCount(1, { timeout: 20_000 });
  expect(blocked).toEqual([]);
});

test("each picture is drawn on its object: its middle is within a twentieth of its width of the outline's, for objects of every kind", async ({ page }) => {
  for (const id of ["M31", "M51", "M81", "M1", "M104", "M13", "M45", "M42"]) {
    const picture = deepSkyPicture(id)!;
    const fov = (picture.width * picture.arcsecPerPixel) / 60;
    await page.goto(`/hoshi-stars/?pick=D:${id}&ra=${picture.centre.rightAscension}&dec=${picture.centre.declination}&zoom=1`);
    await expect(page.locator("#chart circle").first()).toBeVisible();
    const box = (await page.locator("#chart").boundingBox())!;
    // a zoom that puts the picture about 400 pixels across (a chart's pixels for an arc-minute are its smaller side times 0.000073 times the zoom)
    const zoom = Math.round(400 / (fov * 0.000073 * Math.min(box.width, box.height)));
    await page.goto(`/hoshi-stars/?pick=D:${id}&ra=${picture.centre.rightAscension}&dec=${picture.centre.declination}&zoom=${zoom}`);
    await expect(page.locator(`#chart image[data-pic='${id}']`), id).toHaveCount(1, { timeout: 20_000 });
    const shown = await middleOf(page, `#chart image[data-pic='${id}']`);
    const mark = await middleOf(page, `#chart [data-deep="${id}"]`);
    expect(Math.hypot(shown.x - mark.x, shown.y - mark.y), id).toBeLessThan(shown.width * 0.05 + 6);
  }
});

test("past where a picture's pixels run out an address still draws it, softened, over the object, and the wheel and the buttons stop at the cap", async ({ page }) => {
  // M31's survey picture is 21 arc-seconds a pixel: at 800 it is blown up about 14 times, and still the galaxy, not bare sky
  await page.goto("/hoshi-stars/?pick=D:M31&ra=10.685&dec=41.269&zoom=800");
  await expect(page.locator("#chart image[data-pic='M31']")).toHaveCount(1, { timeout: 20_000 });
  const opacity = Number(await page.locator("#chart image[data-pic='M31']").getAttribute("opacity"));
  expect(opacity).toBeGreaterThan(0.3);
  expect(opacity).toBeLessThan(1);
  for (let i = 0; i < 3; i += 1) await page.getByTestId("zoom-in").click();
  await page.waitForTimeout(300);
  // the buttons do not push it further in
  expect(Number(param(page, "zoom") ?? 800)).toBeLessThanOrEqual(800.5);
});
