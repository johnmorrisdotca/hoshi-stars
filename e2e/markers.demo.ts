// The markers page: your own dated points on <hoshi-chart>. The sample opens drawn, the two-handle slider chooses the days shown (by hand and by key), Play moves the window and Pause stops it, a click or Enter
// on a point shows its card, CSV and JSON go out and come back, a file that holds no points says so, the dates are the reader's own, and the page keeps to its width on a phone.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/markers.html";
const markerIds = (page: Page) => page.locator("#chart").evaluate((el) => [...el.shadowRoot!.querySelectorAll("svg g[data-marker]")].map((g) => g.getAttribute("data-marker")));
const draws = (page: Page) => page.locator("#chart").evaluate((el) => (el as unknown as { _stats: { draws: number } })._stats.draws);
const setRange = (page: Page, id: "from" | "to", value: number) =>
  page.evaluate(([name, v]) => {
    const input = document.getElementById(name as string) as HTMLInputElement;
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [id, value] as const);

async function open(page: Page, query = ""): Promise<string[]> {
  const said: string[] = [];
  page.on("console", (message) => said.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => said.push(`pageerror: ${error.message}`));
  await page.goto(`${PAGE}${query}`);
  await expect.poll(() => markerIds(page).then((ids) => ids.length)).toBeGreaterThan(5);
  return said;
}

test("the sample opens with every point, and draws nothing at rest", async ({ page }) => {
  const said = await open(page);
  expect((await markerIds(page)).length).toBe(29);
  await expect(page.getByTestId("count")).toHaveText("29 of 29 points shown");
  await expect(page.locator("#chart").locator("svg path[data-track]")).toHaveCount(2);
  const before = await draws(page);
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(before);
  expect(said.filter((line) => line.startsWith("error") || line.startsWith("pageerror") || line.startsWith("warning"))).toEqual([]);
});

test("the two handles choose the days shown: the points outside go, the tracks shorten, and a handle pushes the other", async ({ page }) => {
  await open(page);
  const last = Number(await page.locator("#to").getAttribute("max"));
  expect(last).toBeGreaterThan(15);
  await setRange(page, "from", 5);
  await setRange(page, "to", 10);
  // the two handles are moved one after the other and the chart redraws on a frame of its own, so the first handle's drawing can be read before the second one's: wait for the days of both
  await expect.poll(() => markerIds(page), { message: "the points of the days 5 to 10 only" }).not.toContain("comet-20");
  const ids = await markerIds(page);
  // the comet's points of those days, and none of the first days
  expect(ids).toContain("comet-8");
  expect(ids).not.toContain("comet-1");
  await expect(page.getByTestId("count")).toHaveText(/^\d+ of 29 points shown$/);
  // pushing: the left handle taken past the right one carries it along
  await setRange(page, "from", 14);
  expect(await page.locator("#to").inputValue()).toBe("14");
  await setRange(page, "to", 3);
  expect(await page.locator("#from").inputValue()).toBe("3");
  // the whole span again
  await setRange(page, "from", 0);
  await setRange(page, "to", last);
  await expect.poll(async () => (await markerIds(page)).length).toBe(29);
});

test("a handle is moved by the keys and by a drag, and says its day", async ({ page }) => {
  await open(page);
  const last = Number(await page.locator("#to").getAttribute("max"));
  await page.locator("#to").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#to")).toHaveValue(String(last - 2));
  await expect.poll(async () => (await markerIds(page)).length).toBeLessThan(29);
  expect(await page.locator("#to").getAttribute("aria-valuetext")).toBe(await page.getByTestId("to-out").textContent());
  // a drag of the left thumb along the track
  const box = (await page.locator("#from").boundingBox())!;
  await page.mouse.move(box.x + 11, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(Number(await page.locator("#from").inputValue())).toBeGreaterThan(3);
});

test("Play moves the window along the days and Pause stops it", async ({ page }) => {
  await open(page);
  await page.getByTestId("play").click();
  await expect(page.getByTestId("play")).toHaveAttribute("aria-pressed", "true");
  // from the whole range it opens on a window of three days and moves it on
  await expect.poll(async () => Number(await page.locator("#from").inputValue()), { timeout: 8000 }).toBeGreaterThan(1);
  await page.getByTestId("play").click();
  await expect(page.getByTestId("play")).toHaveAttribute("aria-pressed", "false");
  const stopped = await page.locator("#from").inputValue();
  await page.waitForTimeout(1600);
  expect(await page.locator("#from").inputValue()).toBe(stopped);
});

test("a click on a point shows its card, and so does Enter on a point chosen with the keyboard", async ({ page }) => {
  await open(page);
  // the first star of the log (Betelgeuse), found on the chart
  const at = await page.locator("#chart").evaluate((el) => {
    const g = el.shadowRoot!.querySelector('g[data-marker="seen-2061"] circle')!.getBoundingClientRect();
    return { x: g.x + g.width / 2, y: g.y + g.height / 2 };
  });
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("card").locator("h2")).toHaveText("Betelgeuse");
  await expect(page.getByTestId("card")).toContainText("Stars I've seen (sample)");
  // another one, by key: from the chart, Tab to the first point and on to the second (Rigel), Enter
  await page.locator("#chart").evaluate((el) => (el as HTMLElement).focus());
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("card").locator("h2")).toHaveText("Rigel");
  await expect(page.getByTestId("card").locator("dt").first()).toHaveText("When");
});

test("the points go out as CSV and JSON and come back the same", async ({ page }) => {
  await open(page);
  const csv = page.waitForEvent("download");
  await page.getByTestId("export-csv").click();
  const csvFile = await csv;
  expect(csvFile.suggestedFilename()).toBe("hoshi-markers.csv");
  const csvPath = (await csvFile.path())!;
  const csvText = readFileSync(csvPath, "utf8");
  expect(csvText.split("\n")[0]).toBe("id,ra,dec,date,label,color,size,group");
  expect(csvText.trim().split("\n")).toHaveLength(30);
  const json = page.waitForEvent("download");
  await page.getByTestId("export-json").click();
  const jsonFile = await json;
  expect(jsonFile.suggestedFilename()).toBe("hoshi-markers.json");
  const list = JSON.parse(readFileSync((await jsonFile.path())!, "utf8")) as Array<{ id: string }>;
  expect(list).toHaveLength(29);
  // three points from a file replace them, and the CSV and the JSON, brought back, are the same 29
  await page.getByTestId("import").setInputFiles({ name: "three.csv", mimeType: "text/csv", buffer: Buffer.from("ra,dec,date,label\n10,10,2026-03-01,A\n20,20,2026-03-03,B\n30,30,2026-03-05,C\n") });
  await expect(page.getByTestId("message")).toHaveText("Read 3 points from three.csv.");
  await expect.poll(async () => (await markerIds(page)).length).toBe(3);
  await page.getByTestId("import").setInputFiles({ name: "hoshi-markers.csv", mimeType: "text/csv", buffer: readFileSync(csvPath) });
  await expect(page.getByTestId("message")).toHaveText("Read 29 points from hoshi-markers.csv.");
  await expect.poll(async () => (await markerIds(page)).length).toBe(29);
  await page.getByTestId("import").setInputFiles({ name: "hoshi-markers.json", mimeType: "application/json", buffer: readFileSync((await jsonFile.path())!) });
  await expect(page.getByTestId("message")).toHaveText("Read 29 points from hoshi-markers.json.");
  await expect.poll(async () => (await markerIds(page)).length).toBe(29);
});

test("a file with no points says so and leaves the chart as it was", async ({ page }) => {
  await open(page);
  await page.getByTestId("import").setInputFiles({ name: "empty.csv", mimeType: "text/csv", buffer: Buffer.from("name,colour\nA,red\n") });
  await expect(page.getByTestId("message")).toContainText("No points found in empty.csv");
  await page.getByTestId("import").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("[{not json") });
  await expect(page.getByTestId("message")).toHaveText("Could not read bad.json.");
  expect((await markerIds(page)).length).toBe(29);
  await page.getByTestId("sample").click();
  await expect(page.getByTestId("message")).toHaveText("The sample is back.");
});

test.describe("the reader's own day", () => {
  // a browser in Kiritimati, 14 hours ahead of UTC: a date with no time is that day there, not the one UTC midnight lands on
  test.use({ timezoneId: "Pacific/Kiritimati" });
  test("dates are shown in the reader's calendar, and a date with no time is the reader's own day", async ({ page }) => {
    await open(page);
    await page.getByTestId("import").setInputFiles({ name: "days.csv", mimeType: "text/csv", buffer: Buffer.from("ra,dec,date,label\n10,10,2026-03-08,A\n20,20,2026-03-12,B\n") });
    await expect(page.getByTestId("message")).toHaveText("Read 2 points from days.csv.");
    await expect(page.getByTestId("from-out")).toHaveText("Mar 8, 2026");
    await expect(page.getByTestId("to-out")).toHaveText("Mar 12, 2026");
    expect(await page.locator("#to").getAttribute("max")).toBe("4");
    await setRange(page, "to", 1);
    await expect.poll(() => markerIds(page).then((ids) => ids.length)).toBe(1);
  });
});

test("the page is in Japanese when asked, and keeps to its width on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "?lang=ja");
  await expect(page.locator("h1")).toHaveText("自分の点を星図に置く");
  await expect(page.getByTestId("count")).toHaveText("29点のうち29点を表示");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("ja");
});
