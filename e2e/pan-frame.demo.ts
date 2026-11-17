// A pan frame is cheap: dragging the demo's map at zoom 80 over Cygnus (the Milky Way, the lines, the names, the pictures and the grid on) draws each frame in a few milliseconds. It was 22 ms at the
// 95th percentile on a laptop drawing in software and 92 to 118 ms with the CPU slowed five times, and almost all of it was the names' placing: the four 20,000-pixel edges of the chart were entered
// in a hundred thousand cells of the label grid on every frame. THROTTLE=4 slows the CPU four times (CDP), as the ticket's runs did.
// The time bar is this computer's: 12 ms for each step of slowing (measured 2.6 ms at none and 10.6 at four, the old code 26 and 116). On CI a shared runner's times say how busy its neighbours are,
// so there the bar is 50 ms (the old code took about 100 there), a fifth of the old frame and four times the new.
import { expect, test } from "@playwright/test";

const THROTTLE = Number(process.env.THROTTLE ?? 1);
const CYGNUS = "ra=305&dec=38";

const p95Of = (frames: number[]): number => [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)]!;
const medianOf = (frames: number[]): number => [...frames].sort((a, b) => a - b)[Math.floor(frames.length / 2)]!;

test("panning at zoom 80 over Cygnus draws each frame in a few milliseconds", async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || isMobile, "the drag is a Chromium mouse drag; the frame budget is measured once");
  test.setTimeout(240_000);
  // a frame is the callback that put a drawing in the map: the time from its start to its end
  await page.addInitScript(() => {
    const w = window as unknown as { drawMs: number[]; drew: boolean };
    w.drawMs = [];
    w.drew = false;
    const html = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML")!;
    Object.defineProperty(Element.prototype, "innerHTML", {
      ...html,
      set(value: string) {
        if (this.tagName === "svg") w.drew = true;
        html.set!.call(this, value);
      },
    });
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raf((t) => {
        w.drew = false;
        const start = performance.now();
        cb(t);
        if (w.drew) w.drawMs.push(performance.now() - start);
      });
  });
  if (THROTTLE !== 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  await page.goto(`/hoshi-stars/?${CYGNUS}&zoom=80&layers=milky,lines,names,pictures,grid`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await page.waitForTimeout(800);
  await page.locator("#chart-box").scrollIntoViewIfNeeded();
  await page.evaluate(() => { (window as unknown as { drawMs: number[] }).drawMs = []; });
  const box = (await page.locator("#chart-box").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const drawn = (): Promise<number> => page.evaluate(() => (window as unknown as { drawMs: number[] }).drawMs.length);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 120; i++) {
    const before = await drawn();
    await page.mouse.move(x + Math.sin(i / 15) * 160, y + Math.cos(i / 15) * 90);
    await expect.poll(drawn, { timeout: 10_000, intervals: [5] }).toBeGreaterThan(before);
  }
  await page.mouse.up();
  const frames = (await page.evaluate(() => (window as unknown as { drawMs: number[] }).drawMs)).slice(10);
  expect(frames.length).toBeGreaterThanOrEqual(100);
  const bar = process.env.CI ? 50 : 12 * THROTTLE;
  console.log(`pan frames at zoom 80 over Cygnus, CPU slowed ${THROTTLE} times: median ${medianOf(frames).toFixed(1)} ms, 95th percentile ${p95Of(frames).toFixed(1)} ms (${frames.length} frames; bar ${bar})`);
  expect(p95Of(frames), `the 95th percentile of ${frames.length} pan frames, ms`).toBeLessThan(bar);
});
