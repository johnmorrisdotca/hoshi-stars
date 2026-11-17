// "See it in my sky": the element turned to a target. A planet that is up is centred and ringed with its name; a star that is down says so, which way it is and when it rises (and a star that never rises or never sets says that);
// a constellation is framed whole with its lines lit; a point a page gives is ringed and follows when the page moves it; the page's own marks are drawn, named and pressable by a tap and by the keyboard; the view glides (and
// a hand on the sky stops it) unless the reader prefers reduced motion; and nothing is drawn at rest (the freeze rule): a fixed sky asks for no frame, the same marks again draw nothing, and a glide asks for one frame at a time
// and none once it has arrived. The demo's own control (a kind, then one of its choices) and its sample marks are played too.
import { COUNT_SCRIPT, readCounts, untilStill } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { cameraAxes, localFrame, projectDirection, resolveTarget } from "../src/my-sky/index.ts";

const PAGE = "/hoshi-stars/my-sky.html";
const VANCOUVER = { latitude: 49.28, longitude: -123.12 };
/** A Vancouver evening: 04:00 UTC on 17 November 2026. Saturn is up in the south-east, Sirius is 25 degrees below the horizon (it rises about 23:30 local), Acrux never rises, Polaris never sets and Cassiopeia and Cygnus are up. */
const EVENING = "place=vancouver&t=2026-11-17T04:00:00Z";
const EVENING_MS = Date.UTC(2026, 10, 17, 4);

interface TargetReport {
  kind: string;
  label: { en: string; ja: string };
  altitude: number;
  azimuth: number;
  up: boolean;
  rise: number | null;
  set: number | null;
  always: boolean;
  never: boolean;
}
interface SkyElement extends HTMLElement {
  heading: number;
  pitch: number;
  fov: number;
  target: unknown;
  marks: unknown;
  time: Date | null;
  setView(change: { heading?: number; pitch?: number; fov?: number }): void;
  sky: { target: TargetReport | null } | undefined;
  _stats: { draws: number; ring: { x: number; y: number; r: number } | null; marks: Array<{ id: string; x: number; y: number }>; gliding: boolean };
}

const sky = (page: Page) => page.locator("hoshi-my-sky");
const view = (page: Page) => sky(page).evaluate((el) => ({ heading: (el as SkyElement).heading, pitch: (el as SkyElement).pitch, fov: (el as SkyElement).fov }));
const stats = (page: Page) => sky(page).evaluate((el) => (el as SkyElement)._stats);
const aimed = (page: Page) => sky(page).evaluate((el) => (el as SkyElement).sky?.target ?? null);
const aim = (page: Page, target: unknown) => sky(page).evaluate((el, value) => ((el as SkyElement).target = value), target);
/** Collect `hoshi-sky-target` events on `window.targets`. */
const listen = (page: Page) =>
  sky(page).evaluate((el) => {
    const w = window as unknown as { targets: unknown[]; targetListener?: EventListener };
    w.targets = [];
    if (w.targetListener !== undefined) el.removeEventListener("hoshi-sky-target", w.targetListener);
    w.targetListener = (event) => w.targets.push((event as CustomEvent).detail);
    el.addEventListener("hoshi-sky-target", w.targetListener);
  });
const heard = (page: Page) => page.evaluate(() => (window as unknown as { targets: Array<Record<string, unknown>> }).targets);

async function ready(page: Page, query: string): Promise<void> {
  await page.goto(`${PAGE}?${query}`);
  await expect(sky(page).locator(".title")).not.toHaveText("");
  await sky(page).scrollIntoViewIfNeeded();
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(0);
  // the times are written in a zone with no daylight saving (UTC-7), so the words are the same on every machine
  await sky(page).evaluate((el) => el.setAttribute("timezone", "Etc/GMT+7"));
}

const gap = (a: number, b: number): number => Math.min(Math.abs(a - b) % 360, 360 - (Math.abs(a - b) % 360));

/** How many pixels of the picture are the ring's gold, and how many are the lit lines' pale blue. */
const colours = (page: Page) =>
  sky(page).evaluate((el) => {
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>("canvas.sky")!;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let gold = 0;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (r > 235 && g > 190 && g < 245 && b > 90 && b < 175) gold++;
      if (r > 195 && r < 235 && g > 210 && g < 245 && b > 240) lit++;
    }
    return { gold, lit };
  });

test("a planet that is up: the view is centred on it, it is ringed with its name, and the page is told", async ({ page }) => {
  await ready(page, EVENING);
  await listen(page);
  const before = await colours(page);
  await aim(page, "planet:saturn");
  await expect.poll(async () => (await stats(page)).ring).not.toBeNull();
  const saturn = (await aimed(page))!;
  expect(saturn.kind).toBe("planet");
  expect(saturn.up).toBe(true);
  expect(saturn.label.en).toBe("Saturn");
  // the middle of the picture is Saturn: the heading is its azimuth and the pitch its altitude (reduced motion is on in every project, so the view jumps)
  const now = await view(page);
  expect(gap(now.heading, saturn.azimuth)).toBeLessThan(0.5);
  expect(now.pitch).toBeCloseTo(saturn.altitude, 0);
  const box = (await sky(page).boundingBox())!;
  const ring = (await stats(page)).ring!;
  expect(Math.abs(ring.x - box.width / 2)).toBeLessThan(3);
  expect(Math.abs(ring.y - box.height / 2)).toBeLessThan(3);
  // the ring is drawn in gold, and its name is written in the card
  expect((await colours(page)).gold).toBeGreaterThan(before.gold + 40);
  await expect(sky(page).locator(".target")).toContainText(/^Saturn: \d+° above the horizon, (south|south-east|south-west)/);
  await expect(sky(page).locator(".target")).toContainText(/Sets (tomorrow )?\d{1,2}:\d{2} [ap]\.?m\.?/i);
  expect(await heard(page)).toEqual([expect.objectContaining({ target: "planet:saturn", kind: "planet", label: "Saturn", reached: true, up: true })]);
  // `sky` reports it, with its rise and set
  expect(saturn.set).not.toBeNull();
  expect(saturn.always || saturn.never).toBe(false);
});

test("a star that is down says so, with the way it lies and when it rises; one that never rises, one that never sets and a name that is nothing say that", async ({ page }) => {
  await ready(page, EVENING);
  await listen(page);
  await aim(page, "sirius");
  await expect(sky(page).locator(".target")).toContainText("Sirius is below the horizon");
  await expect(sky(page).locator(".target")).toContainText(/down, toward the east/);
  await expect(sky(page).locator(".target")).toContainText(/Rises 11:3\d p\.?m\.?/i);
  const sirius = (await aimed(page))!;
  expect(sirius).toMatchObject({ kind: "star", up: false, always: false, never: false });
  expect(sirius.altitude).toBeLessThan(-20);
  expect(sirius.rise).toBeGreaterThan(EVENING_MS);
  expect(sirius.rise).toBeLessThan(EVENING_MS + 4 * 3_600_000);
  // faced toward it at the horizon, with its marker on the horizon in view
  const now = await view(page);
  expect(gap(now.heading, sirius.azimuth)).toBeLessThan(0.5);
  expect(now.pitch).toBe(10);
  expect((await stats(page)).ring).not.toBeNull();
  expect(await heard(page)).toEqual([expect.objectContaining({ target: "sirius", kind: "star", label: "Sirius", reached: true, up: false })]);
  // a star that never rises here
  await aim(page, "acrux");
  await expect(sky(page).locator(".target")).toContainText("Acrux never rises from here");
  expect(await aimed(page)).toMatchObject({ up: false, never: true, rise: null, set: null });
  // a star that never sets
  await aim(page, "polaris");
  await expect(sky(page).locator(".target")).toContainText("Polaris is always above the horizon here");
  expect(await aimed(page)).toMatchObject({ up: true, always: true });
  expect(gap((await view(page)).heading, 0)).toBeLessThan(3);
  // an id that names nothing: the card says so, `sky.target` is null, nothing is ringed and the view stays
  const kept = await view(page);
  await aim(page, "nothing-here");
  await expect(sky(page).locator(".target")).toHaveText("Nothing called nothing-here was found");
  expect(await aimed(page)).toBeNull();
  expect((await stats(page)).ring).toBeNull();
  expect(await view(page)).toEqual(kept);
  // `null` takes the target away
  await aim(page, "planet:saturn");
  await expect(sky(page).locator(".target")).toBeVisible();
  await aim(page, null);
  await expect(sky(page).locator(".target")).toBeHidden();
  expect(await aimed(page)).toBeNull();
});

test("a planet that is down says which way and when it rises, and a planet that is not one of the five is nothing", async ({ page }) => {
  await ready(page, EVENING);
  await aim(page, "planet:mars");
  await expect(sky(page).locator(".target")).toContainText(/^Mars is below the horizon: \d+° down, toward the (east|south-east|north-east)/);
  await expect(sky(page).locator(".target")).toContainText(/Rises (tomorrow )?\d{1,2}:\d{2} [ap]\.?m\.?/i);
  await aim(page, "planet:pluto");
  await expect(sky(page).locator(".target")).toContainText("Nothing called planet:pluto was found");
});

test("the Moon and the Sun: the Moon is centred and ringed, the Sun is below the horizon at night with the time it rises", async ({ page }) => {
  await ready(page, EVENING);
  await aim(page, "moon");
  await expect(sky(page).locator(".target")).toContainText(/^Moon: 20° above the horizon, south-west/);
  const moon = (await aimed(page))!;
  expect(moon.up).toBe(true);
  expect(moon.kind).toBe("moon");
  expect((await view(page)).pitch).toBeCloseTo(moon.altitude, 0);
  await aim(page, "sun");
  await expect(sky(page).locator(".target")).toContainText(/^Sun is below the horizon: \d+° down/);
  await expect(sky(page).locator(".target")).toContainText(/Rises tomorrow 8:2\d a\.?m\.?/i);
});

for (const abbreviation of ["Cas", "Cyg"]) {
  test(`the constellation ${abbreviation} is framed whole, faced at its middle, with its lines lit and its name written`, async ({ page }) => {
    await ready(page, EVENING);
    await listen(page);
    const before = await colours(page);
    await aim(page, `constellation:${abbreviation}`);
    await expect.poll(async () => (await stats(page)).ring).not.toBeNull();
    const now = await view(page);
    expect(now.fov).toBeGreaterThanOrEqual(20);
    expect(now.fov).toBeLessThanOrEqual(130);
    // every star of the figure is inside the picture, with a margin
    const found = resolveTarget(`constellation:${abbreviation}`);
    if (found === "later" || found === undefined || found.figure === undefined) throw new Error("no figure");
    const box = (await sky(page).boundingBox())!;
    const camera = { ...now, width: Math.round(box.width), height: Math.round(box.height) };
    const axes = cameraAxes(camera.heading, camera.pitch);
    const frame = localFrame(VANCOUVER, EVENING_MS);
    for (const star of found.figure.stars) {
      const spot = { x: 0, y: 0 };
      const placed = projectDirection(camera, axes, frame.fromJ2000(star.rightAscension, star.declination, { east: 0, north: 0, up: 0 }), spot);
      expect(placed, "a star of the figure is in front of the camera").toBe(true);
      expect(spot.x).toBeGreaterThan(8);
      expect(spot.x).toBeLessThan(camera.width - 8);
      expect(spot.y).toBeGreaterThan(8);
      expect(spot.y).toBeLessThan(camera.height - 8);
    }
    // the lines are lit over the faint ones, and the name is in the card
    expect((await colours(page)).lit).toBeGreaterThan(before.lit + 60);
    await expect(sky(page).locator(".target")).toContainText(new RegExp(`^${found.label.en}: \\d+° above the horizon`));
    expect(await heard(page)).toEqual([expect.objectContaining({ kind: "constellation", label: found.label.en, reached: true, up: true })]);
  });
}

test("a constellation below the horizon says so, and the Japanese words follow the page", async ({ page }) => {
  await ready(page, EVENING);
  await aim(page, "constellation:Cru");
  await expect(sky(page).locator(".target")).toContainText("Crux is below the horizon");
  await expect(sky(page).locator(".target")).toContainText("Crux never rises from here");
  await page.goto(`${PAGE}?${EVENING}&lang=ja&target=sirius`);
  await expect(sky(page).locator(".target")).toContainText("シリウスは地平線の下にあります。東の方角、地平線から");
  await expect(sky(page).locator(".target")).toContainText(/に昇ります/);
  await aim(page, "planet:saturn");
  await expect(sky(page).locator(".target")).toContainText(/^土星: 地平線から\d+°、.+の方角/);
  await aim(page, "acrux");
  await expect(sky(page).locator(".target")).toContainText("アクルックスはここでは、一度も昇りません");
  await aim(page, "elsewhere");
  await expect(sky(page).locator(".target")).toHaveText("「elsewhere」は見つかりませんでした");
});

test("a point a page gives is ringed with its label and follows when the page moves it; a target set before the place is found when it comes", async ({ page }) => {
  await ready(page, EVENING);
  await aim(page, { azimuth: 120, altitude: 30, label: "Probe" });
  await expect(sky(page).locator(".target")).toContainText("Probe: 30° above the horizon, south-east");
  const first = (await stats(page)).ring!;
  const box = (await sky(page).boundingBox())!;
  expect(Math.abs(first.x - box.width / 2)).toBeLessThan(3);
  expect(Math.abs(first.y - box.height / 2)).toBeLessThan(3);
  expect(await aimed(page)).toMatchObject({ kind: "point", up: true, azimuth: 120, altitude: 30, rise: null, set: null });
  expect(await sky(page).evaluate((el) => (el as SkyElement).target)).toEqual({ azimuth: 120, altitude: 30, label: "Probe" });
  // the page sets the point again a little way off: the ring moves to it, and the view glides there again
  await aim(page, { azimuth: 130, altitude: 34, label: "Probe" });
  await expect.poll(async () => Math.round((await view(page)).heading)).toBe(130);
  // below the horizon
  await aim(page, { azimuth: 250, altitude: -12, label: "Probe" });
  await expect(sky(page).locator(".target")).toContainText("Probe is below the horizon: 12° down, toward the west");
  // an element made by a page's script, given its target before its place: it turns when the place arrives
  const arrived = await page.evaluate(async () => {
    const el = document.createElement("hoshi-my-sky") as SkyElement;
    el.setAttribute("time", "2026-11-17T04:00:00Z");
    el.style.cssText = "display:block;width:400px;height:500px";
    document.body.append(el);
    el.target = "planet:saturn";
    await new Promise((resolve) => setTimeout(resolve, 100));
    const early = el.sky?.target ?? null;
    el.setAttribute("latitude", "49.28");
    el.setAttribute("longitude", "-123.12");
    await new Promise((resolve) => setTimeout(resolve, 300));
    const result = { early, target: el.sky?.target ?? null, heading: el.heading, pitch: el.pitch };
    el.remove();
    return result;
  });
  expect(arrived.early).toBeNull();
  expect(arrived.target?.label.en).toBe("Saturn");
  expect(arrived.pitch).toBeCloseTo(arrived.target!.altitude, 0);
  expect(gap(arrived.heading, arrived.target!.azimuth)).toBeLessThan(0.5);
});

test("a fixed sky moved on in time keeps the ring on the object: Sirius rises and the state changes with the time", async ({ page }) => {
  await ready(page, EVENING);
  await aim(page, "sirius");
  await expect(sky(page).locator(".target")).toContainText("Sirius is below the horizon");
  const down = (await aimed(page))!;
  // four hours on, it has risen: the card says where it is, and the ring is drawn on it (the view stayed)
  await sky(page).evaluate((el) => ((el as SkyElement).time = new Date(Date.UTC(2026, 10, 17, 8))));
  await expect(sky(page).locator(".target")).toContainText(/^Sirius: \d+° above the horizon, /);
  const up = (await aimed(page))!;
  expect(up.up).toBe(true);
  expect(up.altitude).toBeGreaterThan(down.altitude + 20);
  expect(up.set).toBeGreaterThan(Date.UTC(2026, 10, 17, 8));
  expect(await view(page)).toMatchObject({ pitch: 10 });
  expect((await stats(page)).ring).not.toBeNull();
});

test("the page's own marks are drawn and named, and a press on one tells the page its id, with a tap and with the keyboard", async ({ page }) => {
  await ready(page, EVENING);
  await sky(page).evaluate((el) => {
    (window as unknown as { pressed: unknown[] }).pressed = [];
    el.addEventListener("hoshi-sky-mark", (event) => (window as unknown as { pressed: unknown[] }).pressed.push((event as CustomEvent).detail));
    (el as SkyElement).marks = [
      { id: "iss", azimuth: 180, altitude: 35, label: "ISS", kind: "satellite" },
      { id: "probe", azimuth: 200, altitude: 45, label: "Probe" },
      { id: "under", azimuth: 180, altitude: -5, label: "Below" },
      { id: "behind", azimuth: 0, altitude: 30, label: "Behind you" },
      { id: "bad", azimuth: Number.NaN, altitude: 3, label: "bad" },
    ];
  });
  // three are in front of the camera, the one behind is not drawn and the bad one is dropped
  await expect.poll(async () => (await stats(page)).marks.map((m) => m.id).sort()).toEqual(["iss", "probe", "under"]);
  expect(await sky(page).evaluate((el) => ((el as SkyElement).marks as unknown[]).length)).toBe(4);
  const box = (await sky(page).boundingBox())!;
  const at = async (id: string) => (await stats(page)).marks.find((m) => m.id === id)!;
  // the ISS faces the middle of the picture, and is drawn in the mark's gold
  const iss = await at("iss");
  expect(Math.abs(iss.x - box.width / 2)).toBeLessThan(3);
  expect(Math.abs(iss.y - box.height / 2)).toBeLessThan(3);
  expect(
    await sky(page).evaluate((el, spot) => {
      const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>("canvas.sky")!;
      const ratio = canvas.width / el.getBoundingClientRect().width;
      const [r, g, b] = canvas.getContext("2d")!.getImageData(Math.round(spot.x * ratio), Math.round(spot.y * ratio), 1, 1).data;
      return [r, g, b];
    }, iss),
  ).toEqual([255, 207, 122]);
  // a tap on a mark sends its id and nothing else; a tap beside it sends nothing
  // the page may scroll when the element takes the focus: the box is read again for each tap
  const tap = async (spot: { x: number; y: number }) => {
    const now = (await sky(page).boundingBox())!;
    await page.mouse.click(now.x + spot.x, now.y + spot.y);
  };
  await tap(iss);
  await tap(await at("probe"));
  expect(await page.evaluate(() => (window as unknown as { pressed: Array<{ id: string }> }).pressed.map((p) => p.id))).toEqual(["iss", "probe"]);
  expect(await page.evaluate(() => (window as unknown as { pressed: unknown[] }).pressed[0])).toEqual({ id: "iss", label: "ISS", kind: "satellite", azimuth: 180, altitude: 35 });
  await tap({ x: box.width * 0.9, y: box.height * 0.9 });
  expect(await page.evaluate(() => (window as unknown as { pressed: unknown[] }).pressed.length)).toBe(2);
  // the keyboard: each mark is a button in a list for a screen reader and for Tab
  await expect(sky(page).locator(".marklist button")).toHaveCount(4);
  await sky(page).locator('.marklist button[data-mark="behind"]').focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as unknown as { pressed: Array<{ id: string }> }).pressed.at(-1)!.id)).toBe("behind");
  // a page that takes its marks away leaves nothing
  await sky(page).evaluate((el) => ((el as SkyElement).marks = []));
  await expect.poll(async () => (await stats(page)).marks.length).toBe(0);
  await expect(sky(page).locator(".marklist button")).toHaveCount(0);
});

test("the freeze rule: at rest nothing is drawn and no frame is asked for; the same marks again draw nothing and new places draw once", async ({ page }) => {
  await page.addInitScript(COUNT_SCRIPT);
  await ready(page, EVENING);
  await aim(page, "planet:saturn");
  await sky(page).evaluate((el) => ((el as SkyElement).marks = [{ id: "iss", azimuth: 180, altitude: 35, label: "ISS", kind: "satellite" }]));
  await expect.poll(async () => (await stats(page)).marks.length).toBe(1);
  await untilStill(page, async (p) => [(await stats(p)).draws, (await readCounts(p)).rafRequests], { quietMs: 800 });
  const rest = { draws: (await stats(page)).draws, counts: await readCounts(page) };
  await page.waitForTimeout(2000);
  expect((await stats(page)).draws).toBe(rest.draws);
  expect((await readCounts(page)).rafRequests).toBe(rest.counts.rafRequests);
  // the same marks again, as a page that sends them every second would: nothing is drawn, no frame is asked for
  for (let i = 0; i < 5; i++) await sky(page).evaluate((el) => ((el as SkyElement).marks = [{ id: "iss", azimuth: 180, altitude: 35, label: "ISS", kind: "satellite" }]));
  await page.waitForTimeout(500);
  expect((await stats(page)).draws).toBe(rest.draws);
  expect((await readCounts(page)).rafRequests).toBe(rest.counts.rafRequests);
  // the satellite moved: one draw for each change, and nothing between
  await sky(page).evaluate((el) => ((el as SkyElement).marks = [{ id: "iss", azimuth: 182, altitude: 36, label: "ISS", kind: "satellite" }]));
  await expect.poll(async () => (await stats(page)).draws).toBe(rest.draws + 1);
  await page.waitForTimeout(500);
  expect((await stats(page)).draws).toBe(rest.draws + 1);
  // the same target again is a new request (it turns to it again) and then rests again
  await aim(page, "planet:saturn");
  await untilStill(page, async (p) => [(await stats(p)).draws, (await readCounts(p)).rafRequests], { quietMs: 800 });
  const after = (await stats(page)).draws;
  await page.waitForTimeout(1500);
  expect((await stats(page)).draws).toBe(after);
});

test("a glide asks for one frame at a time, stops once it has arrived, and a hand on the sky stops it and says it did not get there", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "the timings of a glide are held to in Chromium");
  await page.addInitScript(COUNT_SCRIPT);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page, EVENING);
  await listen(page);
  await untilStill(page, async (p) => [(await stats(p)).draws, (await readCounts(p)).rafRequests], { quietMs: 600 });
  const start = await readCounts(page);
  const drawsStart = (await stats(page)).draws;
  await aim(page, "constellation:Cas");
  expect((await stats(page)).gliding).toBe(true);
  // while it glides, never more than one frame is outstanding
  let widest = 0;
  for (let i = 0; i < 30 && (await stats(page)).gliding; i++) {
    const counts = await readCounts(page);
    widest = Math.max(widest, counts.rafRequests - counts.rafCallbacks);
    await page.waitForTimeout(40);
  }
  expect(widest).toBeLessThanOrEqual(2);
  await expect.poll(async () => (await heard(page)).length, { timeout: 5000 }).toBe(1);
  expect(await heard(page)).toEqual([expect.objectContaining({ kind: "constellation", reached: true })]);
  expect((await stats(page)).gliding).toBe(false);
  // it went through the views on the way: more than one draw, fewer than a frame every 16 ms for a 1.5 s turn at most
  const drawn = (await stats(page)).draws - drawsStart;
  expect(drawn).toBeGreaterThan(3);
  expect(drawn).toBeLessThan(120);
  // and then nothing
  await untilStill(page, async (p) => [(await stats(p)).draws, (await readCounts(p)).rafRequests], { quietMs: 800 });
  const rest = await readCounts(page);
  const restDraws = (await stats(page)).draws;
  await page.waitForTimeout(1500);
  expect((await readCounts(page)).rafRequests).toBe(rest.rafRequests);
  expect((await stats(page)).draws).toBe(restDraws);
  expect(rest.rafRequests).toBeGreaterThan(start.rafRequests);
  // a hand on the sky (an arrow key) stops a glide where it is
  await sky(page).evaluate((el) => (el as SkyElement).setView({ heading: 180, pitch: 35, fov: 90 }));
  await listen(page);
  await aim(page, "constellation:Cas");
  expect((await stats(page)).gliding).toBe(true);
  await sky(page).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await stats(page)).gliding).toBe(false);
  const stopped = await view(page);
  await page.waitForTimeout(800);
  expect(await view(page)).toEqual(stopped);
  expect(await heard(page)).toEqual([expect.objectContaining({ kind: "constellation", reached: false })]);
});

test("the demo's control: a kind, then one of its choices, turns the sky and is kept in the address; Clear takes it away", async ({ page }) => {
  await ready(page, EVENING);
  await expect(page.locator("#choices-row")).toBeHidden();
  await page.locator('button[data-kind="planet"]').click();
  await expect(page.locator("#choices-row")).toBeVisible();
  await page.locator('button[data-target="planet:saturn"]').click();
  await expect(page.locator('button[data-target="planet:saturn"]')).toHaveAttribute("aria-pressed", "true");
  await expect(sky(page).locator(".target")).toContainText(/^Saturn: \d+° above the horizon/);
  await expect.poll(() => new URL(page.url()).searchParams.get("target")).toBe("planet:saturn");
  expect(await sky(page).evaluate((el) => (el as SkyElement).target)).toBe("planet:saturn");
  await page.locator('button[data-kind="star"]').click();
  await page.locator('button[data-target="acrux"]').click();
  await expect(sky(page).locator(".target")).toContainText("Acrux never rises from here");
  await page.locator('button[data-kind="constellation"]').click();
  await expect(sky(page).locator(".target")).toContainText(/Orion/);
  await page.locator('button[data-kind="moon"]').click();
  await expect(page.locator("#choices-row")).toBeHidden();
  await expect(sky(page).locator(".target")).toContainText(/^Moon: /);
  await page.locator("#look-clear").click();
  await expect(sky(page).locator(".target")).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.get("target")).toBeNull();
  // an address that names a target opens turned to it
  await page.goto(`${PAGE}?${EVENING}&target=planet:saturn`);
  await expect(sky(page).locator(".target")).toContainText(/^Saturn: /);
  await expect(page.locator('button[data-kind="planet"]')).toHaveAttribute("aria-pressed", "true");
  // the page fits the width of the screen with the new rows
  const fit = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  expect(fit.scroll).toBeLessThanOrEqual(fit.width);
  const card = (await sky(page).locator(".target").boundingBox())!;
  const host = (await sky(page).boundingBox())!;
  expect(card.x).toBeGreaterThanOrEqual(host.x);
  expect(card.x + card.width).toBeLessThanOrEqual(host.x + host.width);
});

test("the demo's sample marks: shown on a press of the button, a press on one says its id, and hidden again", async ({ page }) => {
  await ready(page, EVENING);
  await page.locator("#marks").click();
  await expect(page.locator("#marks")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await stats(page)).marks.length).toBeGreaterThanOrEqual(1);
  await expect(sky(page).locator(".marklist button")).toHaveCount(3);
  await expect(page.locator("#mark-note")).toContainText("sample");
  await sky(page).locator('.marklist button[data-mark="sample-satellite"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#mark-note")).toHaveText("Pressed Sample satellite (id: sample-satellite).");
  await page.locator("#marks").click();
  await expect.poll(async () => (await stats(page)).marks.length).toBe(0);
});
