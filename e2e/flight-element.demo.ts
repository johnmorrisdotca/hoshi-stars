// <hoshi-flight>, as a reader's page has it: the built package, kazoku-ui and three.js served from a page of their own through an import map. `goTo` flies and says so (moving, then arrived, or home at the Sun),
// `lookAt` turns without moving, `at` goes in in any spelling and comes back in its one form, `ra` and `dec` set the way it opens facing, `sun-stop` is how far from the Sun it stops, and the Sun's name follows `lang`.
// How much it asks of the machine is in freeze.demo.ts, on the demo's flight page.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const FILES: Record<string, string> = { "/hoshi/": join(root, "dist"), "/kazoku/": join(root, "node_modules", "@johnmorrisdotca", "kazoku-ui", "dist"), "/three/": join(root, "node_modules", "three", "build") };
const IMPORTS = { "@johnmorrisdotca/kazoku-ui/view-controls": "/kazoku/view-controls/index.js", "@johnmorrisdotca/kazoku-ui/renderer": "/kazoku/renderer/index.js", "@johnmorrisdotca/kazoku-ui/": "/kazoku/", three: "/three/three.module.js" };
/** Parsecs in an astronomical unit. */
const AU = 149_597_870.7 / 3.085677581491367e13;

interface Flight extends HTMLElement {
  readonly live: boolean;
  readonly status: { at: string; moving: boolean; place: { id: string } | undefined; position: { x: number; y: number; z: number } };
  sunStop: number;
  goTo(id: string): boolean;
  lookAt(id: string): boolean;
}

/** A page at https://flight.test/ holding `body`, its changes kept in `window.changes`; it waits until the flight draws. */
async function flightPage(page: Page, body: string): Promise<void> {
  await page.route("https://flight.test/**", (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><script type="importmap">${JSON.stringify({ imports: IMPORTS })}</script><script type="module" src="/hoshi/flight-define.js"></script></head><body style="margin:0">${body}<script>window.changes = []; document.addEventListener("hoshi-flight", (event) => window.changes.push(event.detail.change + " " + event.detail.at), true);</script></body></html>`;
      return route.fulfill({ body: html, contentType: "text/html" });
    }
    const base = Object.keys(FILES).find((prefix) => pathname.startsWith(prefix));
    if (base === undefined) return route.fulfill({ status: 404, body: "" });
    try {
      return route.fulfill({ body: readFileSync(join(FILES[base]!, pathname.slice(base.length))), contentType: "text/javascript" });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
  await page.goto("https://flight.test/");
  await page.waitForFunction(() => (document.querySelector("hoshi-flight") as unknown as { live: boolean } | null)?.live === true, undefined, { timeout: 60_000 });
}

const flight = <T>(page: Page, run: (el: Flight) => T) => page.locator("hoshi-flight").evaluate(run as unknown as (el: Element) => T);
const status = (page: Page) => flight(page, (el) => el.status);
const changes = (page: Page) => page.evaluate(() => (window as unknown as { changes: string[] }).changes);
const fromSun = (position: { x: number; y: number; z: number }) => Math.hypot(position.x, position.y, position.z);
/** How far a place's name is from the middle of the view, in pixels, once the view has placed it; undefined while it is not shown. */
async function fromMiddle(page: Page, id: string): Promise<number | undefined> {
  const mark = page.locator(`hoshi-flight [data-mark="${id}"]`);
  await mark.waitFor({ state: "attached" });
  // a frame or two of the view (it draws at most 30 a second)
  await page.waitForTimeout(300);
  if (!(await mark.isVisible())) return undefined;
  const box = (await page.locator("hoshi-flight").boundingBox())!;
  const ring = (await mark.locator(".ring").boundingBox())!;
  return Math.hypot(ring.x + ring.width / 2 - (box.x + box.width / 2), ring.y + ring.height / 2 - (box.y + box.height / 2));
}

test.describe("flying", () => {
  test.use({ reducedMotion: "no-preference" });

  test("goTo flies: changes say moving at each step and arrived at the stop, at is written at the stop only, and a flight to the Sun ends home", async ({ page }) => {
    test.setTimeout(120_000);
    await flightPage(page, `<hoshi-flight style="width:640px;height:400px"></hoshi-flight>`);
    expect(await page.locator("hoshi-flight").getAttribute("at")).toBe("sun");
    expect(await flight(page, (el) => el.goTo("gctp-3278"))).toBe(true);
    expect((await status(page)).moving).toBe(true);
    await expect.poll(async () => (await status(page)).at, { timeout: 30_000 }).toMatch(/^pc_/);
    expect(await page.locator("hoshi-flight").getAttribute("at"), "the attribute waits for the stop").toBe("sun");
    await expect.poll(async () => (await status(page)).moving, { timeout: 60_000 }).toBe(false);
    expect((await status(page)).at).toBe("gctp-3278");
    expect(await page.locator("hoshi-flight").getAttribute("at")).toBe("gctp-3278");
    const there = await changes(page);
    expect(there.length).toBeGreaterThan(5);
    expect(there.slice(0, -1).every((one) => one.startsWith("moving "))).toBe(true);
    expect(there.at(-1)).toBe("arrived gctp-3278");

    await flight(page, (el) => el.goTo("sun"));
    await expect.poll(async () => (await status(page)).moving, { timeout: 60_000 }).toBe(false);
    expect((await changes(page)).at(-1)).toBe("home sun");
    expect(await flight(page, (el) => el.goTo("hr-0")), "nothing has that id").toBe(false);
  });

  test("lookAt turns to a place and moves nothing: the Sun's name comes to the middle of the view", async ({ page }) => {
    await flightPage(page, `<hoshi-flight at="hr-7001" style="width:640px;height:400px"></hoshi-flight>`);
    expect(await fromMiddle(page, "sun"), "the Sun is behind, facing Vega").toBeUndefined();
    expect(await flight(page, (el) => el.lookAt("sun"))).toBe(true);
    await expect.poll(async () => (await status(page)).moving, { timeout: 30_000 }).toBe(false);
    expect(await fromMiddle(page, "sun")).toBeLessThan(3);
    expect((await status(page)).at).toBe("hr-7001");
    expect((await changes(page)).at(-1)).toBe("rest hr-7001");
    expect(await flight(page, (el) => el.lookAt("nowhere"))).toBe(false);
  });
});

test("with reduced motion goTo is one step: one change, arrived, and it is there", async ({ page }) => {
  await flightPage(page, `<hoshi-flight style="width:640px;height:400px"></hoshi-flight>`);
  await flight(page, (el) => el.goTo("hr-7001"));
  expect(await changes(page)).toEqual(["arrived hr-7001"]);
  expect((await status(page)).moving).toBe(false);
  await expect.poll(() => page.locator("hoshi-flight").evaluate((el) => (Reflect.get(el, "stats") as { ball: string | undefined }).ball)).toBe("hr-7001");
  await flight(page, (el) => el.goTo("sun"));
  expect(await changes(page)).toEqual(["arrived hr-7001", "home sun"]);
});

test("at goes in in any spelling and comes back in its one form; set later, it puts the camera there without a flight", async ({ page }) => {
  await flightPage(page, `<hoshi-flight at="HR-7001" style="width:640px;height:400px"></hoshi-flight>`);
  expect(await page.locator("hoshi-flight").getAttribute("at")).toBe("hr-7001");
  expect((await status(page)).at).toBe("hr-7001");
  expect(await changes(page), "opening sends nothing").toEqual([]);

  await page.locator("hoshi-flight").evaluate((el) => el.setAttribute("at", "pc_1.50_-2_0"));
  expect(await page.locator("hoshi-flight").getAttribute("at")).toBe("pc_1.5_-2_0");
  const point = await status(page);
  expect(point.place).toBeUndefined();
  expect(fromSun(point.position)).toBeCloseTo(2.5, 9);
  expect(await fromMiddle(page, "sun"), "from a point it faces the Sun").toBeLessThan(3);

  await page.locator("hoshi-flight").evaluate((el) => el.setAttribute("at", "m31"));
  expect((await status(page)).place?.id).toBe("M31");
  expect(await page.locator("hoshi-flight").getAttribute("at")).toBe("M31");
  await page.locator("hoshi-flight").evaluate((el) => el.setAttribute("at", "nowhere"));
  expect(await page.locator("hoshi-flight").getAttribute("at"), "an address it cannot read is the Sun").toBe("sun");
  expect(await changes(page)).toEqual(["rest pc_1.5_-2_0", "arrived M31", "home sun"]);
});

test("ra and dec set the way it opens facing: at Proxima Centauri facing the Sun, the Sun is in the middle", async ({ page }) => {
  await flightPage(page, `<hoshi-flight at="gctp-3278" ra="37.43" dec="62.68" style="width:640px;height:400px"></hoshi-flight>`);
  expect(await fromMiddle(page, "sun")).toBeLessThan(6);
  await page.locator("hoshi-flight").evaluate((el) => {
    el.removeAttribute("ra");
    el.removeAttribute("dec");
    el.setAttribute("at", "sun");
    el.setAttribute("at", "gctp-3278");
  });
  expect(await fromMiddle(page, "sun"), "left out, it faces the place, with the Sun behind").toBeUndefined();
});

test("sun-stop is how far from the Sun it stops, in astronomical units, opening there, going home there, and moved when it changes", async ({ page }) => {
  await flightPage(page, `<hoshi-flight sun-stop="40" style="width:640px;height:400px"></hoshi-flight>`);
  expect(await flight(page, (el) => el.sunStop)).toBe(40);
  expect(fromSun((await status(page)).position) / AU).toBeCloseTo(40, 6);
  await flight(page, (el) => el.goTo("hr-7001"));
  await flight(page, (el) => el.goTo("sun"));
  expect(fromSun((await status(page)).position) / AU).toBeCloseTo(40, 6);
  await flight(page, (el) => {
    el.sunStop = 5;
  });
  expect(await page.locator("hoshi-flight").getAttribute("sun-stop")).toBe("5");
  expect(fromSun((await status(page)).position) / AU).toBeCloseTo(5, 6);
  expect((await changes(page)).at(-1)).toBe("home sun");
  await page.locator("hoshi-flight").evaluate((el) => el.removeAttribute("sun-stop"));
  const near = await flight(page, (el) => el.sunStop);
  expect(near, "six of the Sun's radii, as its profile has them").toBeCloseTo((6 * 695_700) / 149_597_870.7, 3);
});

test("the Sun's name is in the element's language", async ({ page }) => {
  await flightPage(page, `<hoshi-flight lang="ja" at="pc_1_0_0" style="width:640px;height:400px"></hoshi-flight>`);
  await expect(page.locator('hoshi-flight [data-mark="sun"] .name')).toHaveText("太陽");
  await page.locator("hoshi-flight").evaluate((el) => el.setAttribute("lang", "en"));
  await expect(page.locator('hoshi-flight [data-mark="sun"] .name')).toHaveText("Sun");
});
