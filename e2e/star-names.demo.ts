// Names on the brightest stars and faint constellation lines on the embed page: both off until the address asks, the names stay inside the view and are the brightest, the look is a setting,
// and the figure under the pointer (or a finger) is the one at full strength with its name.
import { expect, test, type Page } from "@playwright/test";

const EMBED = "/hoshi-stars/embed.html";
async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${EMBED}?${query}`);
  await expect(page.locator("html[data-ready='true']")).toHaveCount(1);
  await expect(page.locator("#sky circle").first()).toBeVisible();
}
const names = (page: Page) => page.locator("#sky [data-star-name]");

test("names and constellation lines are off until the address asks for them", async ({ page }) => {
  await open(page, "layers=lines,names");
  expect(await names(page).count()).toBe(0);
  await expect(page.locator("#sky [data-faint-lines]")).toHaveCount(0);
  await expect(page.locator("#sky path[stroke='#6f93e0']")).toHaveCount(1);
  await open(page, "star-names=0&constellation-lines=0&layers=none");
  expect(await names(page).count()).toBe(0);
  await expect(page.locator("#sky [data-faint-lines]")).toHaveCount(0);
});

test("star-names=12 names the 12 brightest stars in view, every name inside the view", async ({ page }) => {
  await open(page, "star-names=12&layers=none");
  await expect(names(page)).toHaveCount(12);
  const texts = await names(page).allTextContents();
  expect(texts).toContain("Rigel");
  expect(texts).toContain("Betelgeuse");
  const frame = (await page.locator("#frame").boundingBox())!;
  for (const box of await names(page).evaluateAll((all) => all.map((node) => { const r = node.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; }))) {
    expect(box.x0).toBeGreaterThanOrEqual(frame.x);
    expect(box.y0).toBeGreaterThanOrEqual(frame.y);
    expect(box.x1).toBeLessThanOrEqual(frame.x + frame.width);
    expect(box.y1).toBeLessThanOrEqual(frame.y + frame.height);
  }
});

test("star-names-magnitude names only the stars that bright, and Japanese is in katakana", async ({ page }) => {
  await open(page, "star-names-magnitude=0.5&layers=none");
  const some = await names(page).allTextContents();
  expect(some.length).toBeGreaterThan(1);
  expect(some.length).toBeLessThan(12);
  expect(some).toContain("Rigel");
  expect(some).not.toContain("Bellatrix");
  await open(page, "star-names-magnitude=0.5&lang=ja&layers=none");
  await expect(names(page).filter({ hasText: "リゲル" })).toHaveCount(1);
});

test("the default look: a ring round each named star and its catalogue letter under the name", async ({ page }) => {
  await open(page, "star-names=8&layers=none");
  const count = await names(page).count();
  expect(count).toBeGreaterThan(3);
  await expect(page.locator("#sky [data-star-name-ring]")).toHaveCount(count);
  await expect(names(page).first()).toHaveAttribute("font-variant", "small-caps");
  await expect(names(page).first()).toHaveAttribute("font-family", /^Michroma/);
  await expect(page.locator("#sky [data-star-designation]").filter({ hasText: "β Ori" })).toHaveCount(1);
  await expect(page.locator("#sky [data-star-designation]").first()).toHaveAttribute("font-family", /monospace/);
  await open(page, "star-names=8&layers=none&label-designation=none&label-ring=0");
  await expect(page.locator("#sky [data-star-designation]")).toHaveCount(0);
  await expect(page.locator("#sky [data-star-name-ring]")).toHaveCount(0);
});

test("the look is a setting: case, size, letter spacing and a leader line come from the address", async ({ page }) => {
  await open(page, "star-names=6&layers=none&label-case=upper&label-size=16&label-letter-spacing=0.1&label-leader=18&label-weight=700");
  const first = names(page).first();
  expect(await first.textContent()).toBe((await first.textContent())!.toUpperCase());
  await expect(first).toHaveAttribute("font-size", "16");
  await expect(first).toHaveAttribute("letter-spacing", "0.1em");
  await expect(first).toHaveAttribute("font-weight", "700");
  expect(await page.locator("#sky [data-star-name-leader]").count()).toBe(await names(page).count());
});

test("a bare constellation-lines is the faint default, 0.16", async ({ page }) => {
  await open(page, "constellation-lines&layers=none");
  await expect(page.locator("#sky [data-faint-lines]")).toHaveAttribute("stroke-opacity", "0.16");
});

test("the pointer on a star of a figure lights the whole figure; its name is above it and clear of the star names", async ({ page }, info) => {
  const phone = info.project.name.includes("phone");
  await open(page, "constellation-lines=0.16&star-names=12&layers=none");
  const frame = (await page.locator("#frame").boundingBox())!;
  // Rigel is a star of Orion: point at the star itself, not at a line
  const all = await names(page).allTextContents();
  const at = await page.locator("#sky [data-star-name-ring]").nth(all.indexOf("Rigel")).evaluate((node) => ({ x: Number(node.getAttribute("cx")), y: Number(node.getAttribute("cy")) }));
  if (phone) await page.touchscreen.tap(frame.x + at.x, frame.y + at.y);
  else await page.mouse.move(frame.x + at.x, frame.y + at.y);
  const picked = page.locator("#sky [data-figure-picked]");
  await expect(picked).toHaveCount(1);
  await expect(picked).toHaveAttribute("stroke-opacity", "1");
  await expect(picked).toHaveAttribute("data-figure-picked", "Ori");
  const name = page.locator("#sky [data-figure-name]");
  await expect(name).toHaveCount(1);
  const boxes = await page.evaluate(() => {
    const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; };
    return { figure: rect(document.querySelector("#sky [data-figure-picked]")!), name: rect(document.querySelector("#sky [data-figure-name]")!), stars: [...document.querySelectorAll("#sky [data-star-name], #sky [data-star-designation]")].map(rect) };
  });
  expect(boxes.name.y1, "the name is above the figure").toBeLessThanOrEqual(boxes.figure.y0 + 1);
  for (const star of boxes.stars) {
    const apart = boxes.name.x1 <= star.x0 || star.x1 <= boxes.name.x0 || boxes.name.y1 <= star.y0 || star.y1 <= boxes.name.y0;
    expect(apart, "never over a star's name").toBe(true);
  }
});

test("constellation-lines draws faint lines, and the figure under the pointer rises to full strength with its name", async ({ page }, info) => {
  const phone = info.project.name.includes("phone");
  await open(page, "constellation-lines=0.2&layers=none");
  const faint = page.locator("#sky [data-faint-lines]");
  await expect(faint).toHaveAttribute("stroke-opacity", "0.2");
  await expect(page.locator("#sky [data-figure-picked]")).toHaveCount(0);
  await expect(page.locator("#sky [data-figure-name]")).toHaveCount(0);
  const spot = await faint.evaluate((node) => {
    const [x0, y0, x1, y1] = node.getAttribute("d")!.match(/-?\d+(\.\d+)?/g)!.slice(0, 4).map(Number);
    return { x: (x0! + x1!) / 2, y: (y0! + y1!) / 2 };
  });
  const frame = (await page.locator("#frame").boundingBox())!;
  const at = { x: frame.x + spot.x, y: frame.y + spot.y };
  if (phone) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.move(at.x, at.y);
  const picked = page.locator("#sky [data-figure-picked]");
  await expect(picked).toHaveCount(1);
  await expect(picked).toHaveAttribute("stroke-opacity", "1");
  await expect(faint).toHaveAttribute("stroke-opacity", "0.2");
  const name = page.locator("#sky [data-figure-name]");
  await expect(name).toHaveCount(1);
  expect((await name.textContent())!.length).toBeGreaterThan(2);
  const box = (await name.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(frame.x);
  expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
  if (!phone) {
    await page.evaluate(() => document.getElementById("frame")!.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" })));
    await expect(page.locator("#sky [data-figure-picked]")).toHaveCount(0);
  } else {
    await expect(picked).toHaveCount(1);
  }
});
