// The planisphere page: the wheel draws, turning the disc (the arrow keys, a drag) or setting a date changes which named stars are inside the horizon window, and the stars inside the window on the screen are the ones horizontal() puts above the horizon of that place at that moment, in the north and in the south. English and Japanese, a phone layout.
import { expect, test, type Page } from "@playwright/test";
import { horizontal } from "../src/sky.ts";
import { starByName, starPosition } from "../src/stars.ts";

const PAGE = "/hoshi-stars/planisphere.html";
const NAMES = ["Sirius", "Canopus", "Arcturus", "Vega", "Capella", "Rigel", "Procyon", "Betelgeuse", "Altair", "Aldebaran", "Antares", "Spica", "Pollux", "Fomalhaut", "Deneb", "Regulus", "Polaris", "Achernar", "Acrux", "Alnilam", "Dubhe", "Mirfak"];
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const summary = (page: Page) => page.getByTestId("pl-summary");

/** The moment the page shows on its own clock (the Sun's time at longitude 0, read as UTC), from its date and time boxes. */
async function shown(page: Page): Promise<number> {
  const [date, time] = [await page.locator("#pl-date").inputValue(), await page.locator("#pl-time").inputValue()];
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  return Date.UTC(y, m - 1, d, h, mi);
}
/** Which of the named stars the picture puts inside the window, read from where the circles are on the screen, against the sky's own answer. */
async function compare(page: Page, latitude: number): Promise<{ drawn: Set<string>; sky: Map<string, number>; checked: number }> {
  const when = await shown(page);
  const stars = NAMES.map((name) => ({ name, hr: starByName(name)!.hr }));
  const spots = await page.evaluate((hrs) => {
    const w = document.querySelector(".wh-window")!.getBoundingClientRect();
    const [x, y, r] = [w.x + w.width / 2, w.y + w.height / 2, w.width / 2];
    return hrs.map((hr) => {
      const node = document.querySelector(`#wh-disc circle[data-hr="${hr}"]`);
      if (node === null) return null;
      const b = node.getBoundingClientRect();
      return Math.hypot(b.x + b.width / 2 - x, b.y + b.height / 2 - y) <= r;
    });
  }, stars.map((s) => s.hr));
  const drawn = new Set<string>();
  const sky = new Map<string, number>();
  let checked = 0;
  stars.forEach((star, i) => {
    const altitude = horizontal(starPosition(starByName(star.name)!), { latitude, longitude: 0 }, when).altitude;
    sky.set(star.name, altitude);
    if (spots[i] === true) drawn.add(star.name);
    // a star within two degrees of the horizon may be on either side: the disc is not carried to the date (up to about 0.4 degrees of precession in 26 years), and the circle's place is read from the screen
    if (spots[i] !== null && Math.abs(altitude) > 2) {
      expect(spots[i], `${star.name} at latitude ${latitude}, ${new Date(when).toISOString()}: altitude ${altitude.toFixed(1)}`).toBe(altitude > 0);
      checked += 1;
    }
  });
  return { drawn, sky, checked };
}
const listed = (page: Page): Promise<string[]> => page.locator("#pl-list li").allTextContents();

test("the wheel draws: stars, the rings of hours and months, the window and the plate, and the page fits the screen", async ({ page }) => {
  await page.goto(`${PAGE}?date=2026-11-08&time=21:00`);
  expect(await page.locator("#wh-disc circle[data-hr]").count()).toBeGreaterThan(1000);
  await expect(page.locator(".wh-window")).toHaveCount(1);
  await expect(page.locator("text[data-month]")).toHaveCount(12);
  await expect(page.locator("text.wh-ra-hour")).toHaveCount(24);
  await expect(page.locator("text.wh-clock-hour")).toHaveCount(24);
  await expect(summary(page)).toContainText("named stars are in the window");
  expect((await listed(page)).length).toBeGreaterThan(10);
  // evenly spaced rings: the sky's hours are 15 degrees apart round the pole, whichever way the disc is turned
  const gaps = await page.evaluate(() => {
    const pin = document.querySelector(".wh-pin")!.getBoundingClientRect();
    const [x, y] = [pin.x + pin.width / 2, pin.y + pin.height / 2];
    const angle = (selector: string): number[] => [...document.querySelectorAll(selector)].map((n) => { const b = n.getBoundingClientRect(); return (Math.atan2(b.x + b.width / 2 - x, -(b.y + b.height / 2 - y)) * 180) / Math.PI; });
    const steps = (list: number[]): number[] => list.slice(1).map((a, i) => ((a - list[i]! + 540) % 360) - 180);
    return { ra: steps(angle("text.wh-ra-hour")), clock: steps(angle("text.wh-clock-hour")) };
  });
  for (const step of [...gaps.ra, ...gaps.clock]) expect(Math.abs(Math.abs(step) - 15)).toBeLessThan(0.6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const box = (await page.getByTestId("pl-wheel").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const small = await page.locator(".kids-picks button").evaluateAll((els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).filter((el) => el.getBoundingClientRect().height < 47.5 || el.getBoundingClientRect().width < 47.5).length);
  expect(small).toBe(0);
});

test("the stars inside the window are the stars above the horizon, north and south, in every season", async ({ page }) => {
  for (const [query, latitude] of [["hemi=n&lat=45&date=2026-12-21&time=21:00", 45], ["hemi=n&lat=45&date=2026-06-21&time=23:00", 45], ["hemi=n&lat=60&date=2026-03-20&time=03:00", 60], ["hemi=s&lat=34&date=2026-12-21&time=21:00", -34], ["hemi=s&lat=34&date=2026-06-21&time=01:00", -34], ["hemi=s&lat=55&date=2026-09-22&time=20:00", -55]] as const) {
    await page.goto(`${PAGE}?${query}`);
    const { checked } = await compare(page, latitude);
    expect(checked, query).toBeGreaterThan(12);
  }
  // Canopus never rises at 60 north and Polaris never rises in the south: named in the list or not by the same window
  await page.goto(`${PAGE}?hemi=n&lat=60&date=2026-12-21&time=21:00`);
  expect(await listed(page)).toContain("Polaris");
  expect(await listed(page)).not.toContain("Canopus");
  await page.goto(`${PAGE}?hemi=s&lat=34&date=2026-12-21&time=21:00`);
  expect(await listed(page)).toContain("Canopus");
  expect(await listed(page)).not.toContain("Polaris");
});

test("turning the disc with the arrow keys moves the sky: the stars in the window change, and still match the horizon", async ({ page }) => {
  await page.goto(`${PAGE}?date=2026-12-21&time=18:00`);
  const wheel = page.getByTestId("pl-wheel");
  const first = await listed(page);
  const turn = async (): Promise<number> => Number(await wheel.getAttribute("data-turn"));
  const before = await turn();
  await wheel.focus();
  await page.keyboard.press("ArrowLeft");
  expect(await turn()).toBeCloseTo(before - 3.75, 1);
  await page.keyboard.press("ArrowRight");
  expect(await turn()).toBeCloseTo(before, 1);
  // the north's disc turns clockwise as the evening goes backward: ArrowRight is earlier, 15 minutes a press, and Shift is an hour
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#pl-time")).toHaveValue("17:45");
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(page.locator("#pl-time")).toHaveValue("18:45");
  // twelve hours on, a different sky
  for (let i = 0; i < 11; i += 1) await page.keyboard.press("Shift+ArrowLeft");
  // eleven sidereal hours of 59 min 50 s each after 18:45
  await expect(page.locator("#pl-time")).toHaveValue("05:43");
  const later = await listed(page);
  expect(later).not.toEqual(first);
  expect(first).toContain("Capella");
  const { checked } = await compare(page, 45);
  expect(checked).toBeGreaterThan(12);
  await page.keyboard.press("PageUp");
  await expect(page.locator("#pl-date")).toHaveValue("2026-12-23");
  await expect.poll(() => param(page, "time")).toBe("05:43");
  await expect.poll(() => param(page, "date")).toBe("2026-12-23");
});

test("setting the date changes the sky: Betelgeuse in the winter evening and Vega in the summer one", async ({ page }) => {
  await page.goto(`${PAGE}?hemi=n&lat=45&time=22:00&date=2026-12-21`);
  expect(await listed(page)).toContain("Betelgeuse");
  expect(await listed(page)).not.toContain("Arcturus");
  await page.locator("#pl-date").fill("2026-06-21");
  await expect(summary(page)).toContainText("2026-06-21");
  expect(await listed(page)).toContain("Vega");
  expect(await listed(page)).toContain("Arcturus");
  expect(await listed(page)).not.toContain("Betelgeuse");
  const { checked } = await compare(page, 45);
  expect(checked).toBeGreaterThan(12);
  await page.locator("#pl-time").fill("12:00");
  await expect(summary(page)).toContainText("12:00");
  await expect.poll(() => param(page, "time")).toBe("12:00");
  await expect.poll(() => param(page, "date")).toBe("2026-06-21");
});

test("the hemisphere and the latitude are in the address and come back from it", async ({ page }) => {
  await page.goto(`${PAGE}?date=2026-11-08&time=21:00`);
  await page.locator('#pl-hemisphere button[data-value="s"]').click();
  await expect(page.locator('#pl-hemisphere button[data-value="s"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("#pl-latitude").fill("34");
  await expect(summary(page)).toContainText("latitude 34 S");
  await expect.poll(() => param(page, "hemi")).toBe("s");
  await expect.poll(() => param(page, "lat")).toBe("34");
  await expect.poll(() => param(page, "date")).toBe("2026-11-08");
  await expect.poll(() => param(page, "time")).toBe("21:00");
  await page.reload();
  await expect(page.locator('#pl-hemisphere button[data-value="s"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#pl-latitude")).toHaveValue("34");
  await expect(page.locator("#pl-date")).toHaveValue("2026-11-08");
  await expect(page.locator("[data-direction='north']")).toHaveCount(1);
  const { checked } = await compare(page, -34);
  expect(checked).toBeGreaterThan(12);
});

test("dragging the wheel turns it: a quarter turn clockwise in the north is six hours earlier", async ({ page }) => {
  await page.goto(`${PAGE}?hemi=n&lat=45&date=2026-12-21&time=18:00`);
  await page.getByTestId("pl-svg").scrollIntoViewIfNeeded();
  const svg = (await page.getByTestId("pl-svg").boundingBox())!;
  const [x, y, r] = [svg.x + svg.width / 2, svg.y + svg.height / 2, svg.width * 0.3];
  await page.mouse.move(x, y - r);
  await page.mouse.down();
  for (let step = 1; step <= 9; step += 1) await page.mouse.move(x + r * Math.sin((step * 10 * Math.PI) / 180), y - r * Math.cos((step * 10 * Math.PI) / 180));
  await page.mouse.move(x + r, y);
  await page.mouse.up();
  const [h, m] = (await page.locator("#pl-time").inputValue()).split(":").map(Number) as [number, number];
  expect(Math.abs(h * 60 + m - (12 * 60 + 1)), "a quarter turn of the sky is six hours of sidereal time, 5 h 59 min of the clock").toBeLessThan(3);
  await expect.poll(() => param(page, "time")).not.toBeNull();
  const { checked } = await compare(page, 45);
  expect(checked).toBeGreaterThan(12);
});

test("Japanese words, the stars in katakana, and the dark page; and the wheel draws nothing at rest", async ({ page }) => {
  await page.goto(`${PAGE}?hemi=n&lat=45&date=2026-12-21&time=21:00&lang=ja`);
  await expect(page.locator("#pl-heading")).toHaveText("星座早見盤");
  await expect(summary(page)).toContainText("北緯45度");
  expect(await listed(page)).toContain("ベテルギウス");
  await expect(page.locator("[data-direction='north']")).toHaveText("北");
  await expect(page.locator("text.wh-name").first()).toHaveText("シリウス");
  const star = page.locator("#wh-disc circle[data-hr]").first();
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  const light = await star.evaluate((n) => getComputedStyle(n).fill);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const dark = await star.evaluate((n) => getComputedStyle(n).fill);
  expect(light).not.toEqual(dark);
  // at rest nothing changes: no mutation in the page for a second
  await page.waitForTimeout(300);
  const changes = await page.evaluate(() => new Promise<number>((resolve) => {
    let count = 0;
    new MutationObserver((list) => { count += list.length; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    setTimeout(() => resolve(count), 1000);
  }));
  expect(changes).toBe(0);
});

test.describe("the time is the Sun's time, said beside the time boxes, and Now is the device's own clock", () => {
  // 05:30 UTC on 13 November is 21:30 on the 12th in Vancouver: the UTC date and the device's date differ
  test.use({ timezoneId: "America/Vancouver" });
  test("the page starts at 21:00 on the reader's date and Now sets the dial to the device's date and clock time", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-13T05:30:00Z"));
    await page.goto(PAGE);
    await expect(page.locator("#pl-date")).toHaveValue("2026-11-12");
    await expect(page.locator("#pl-time")).toHaveValue("21:00");
    await page.goto(`${PAGE}?date=2026-06-21&time=03:00`);
    await page.locator("#pl-now").click();
    await expect(page.locator("#pl-date")).toHaveValue("2026-11-12");
    await expect(page.locator("#pl-time")).toHaveValue("21:30");
    await expect(summary(page)).toContainText("2026-11-12, 21:30");
    await expect.poll(() => param(page, "date")).toBe("2026-11-12");
    await expect.poll(() => param(page, "time")).toBe("21:30");
    // the sky is the one for those numbers on the wheel's own clock
    const { checked } = await compare(page, 45);
    expect(checked).toBeGreaterThan(12);
  });

  test("the note beside the time boxes says it is not the zone's clock, and that the sky can be an hour out, in English and Japanese", async ({ page }) => {
    for (const [lang, words] of [["en", ["not the clock of your time zone", "up to about an hour", "daylight saving"]], ["ja", ["時間帯の時計ではありません", "最大1時間", "サマータイム"]]] as const) {
      await page.goto(`${PAGE}?date=2026-11-08&time=21:00&lang=${lang}`);
      const note = page.getByTestId("pl-time-note");
      for (const word of words) await expect(note).toContainText(word);
      await expect(page.locator("#pl-now")).toHaveText(lang === "ja" ? "いま" : "Now");
      // it sits with the time control: under the date and time row, above the wheel
      const [time, noteBox, wheel] = await Promise.all([page.locator("#pl-time").boundingBox(), note.boundingBox(), page.getByTestId("pl-wheel").boundingBox()]);
      expect(noteBox!.y).toBeGreaterThan(time!.y);
      expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(wheel!.y + 1);
      await expect(page.locator("label", { has: page.locator("#pl-time") })).toContainText(lang === "ja" ? "太陽時" : "the Sun's time");
    }
  });
});

test("a drag is not read out frame by frame: the summary is silent while the hand is down and speaks when it is lifted", async ({ page }) => {
  await page.goto(`${PAGE}?hemi=n&lat=45&date=2026-12-21&time=18:00`);
  await expect(summary(page)).toHaveAttribute("role", "status");
  await expect(summary(page)).not.toHaveAttribute("aria-live", "off");
  await page.getByTestId("pl-svg").scrollIntoViewIfNeeded();
  const svg = (await page.getByTestId("pl-svg").boundingBox())!;
  const [x, y, r] = [svg.x + svg.width / 2, svg.y + svg.height / 2, svg.width * 0.3];
  await page.mouse.move(x, y - r);
  await page.mouse.down();
  await page.mouse.move(x + r * Math.sin(0.3), y - r * Math.cos(0.3));
  await expect(summary(page)).toHaveAttribute("aria-live", "off");
  await page.mouse.move(x + r * Math.sin(0.6), y - r * Math.cos(0.6));
  await expect(page.getByTestId("pl-wheel")).toHaveAttribute("aria-valuetext", "2026-12-21 18:00");
  await page.mouse.up();
  await expect(summary(page)).not.toHaveAttribute("aria-live", "off");
  await expect(page.getByTestId("pl-wheel")).toHaveAttribute("aria-valuetext", /^2026-12-21 17:/);
});
