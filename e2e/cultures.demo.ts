// Sky cultures: the Sky culture choice is kept in the address (culture=chinese), picking one redraws the figures and names that culture uses, picking a figure shows its card, and the Japanese and Chinese labels fit.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${HOME}${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
}
const choice = (page: Page, label: string) => page.getByTestId("cultures").getByRole("button", { name: label, exact: true });
const labels = (page: Page): Promise<string[]> => page.locator("#chart text").allTextContents();

test("the demo opens in the Western sky, with no culture in the address, and offers the three cultures", async ({ page }) => {
  await open(page, "");
  await expect(page.getByTestId("cultures").getByRole("button")).toHaveText(["Western", "Japanese", "Chinese"]);
  await expect(choice(page, "Western")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("culture-note")).toContainText("Big Dipper");
  expect(param(page, "culture")).toBeNull();
});

test("choosing the Chinese sky writes culture=chinese, redraws the figures and names, and choosing Western takes it out again", async ({ page }) => {
  await open(page, "?ra=165&dec=55&zoom=4");
  const western = await page.locator("#chart").innerHTML();
  expect(await labels(page)).toContain("Ursa Major");
  await choice(page, "Chinese").click();
  await expect.poll(() => param(page, "culture")).toBe("chinese");
  await expect(choice(page, "Chinese")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("culture-note")).toContainText("Three Enclosures");
  await expect.poll(() => page.locator("#chart").innerHTML()).not.toBe(western);
  await expect.poll(() => labels(page)).toContain("北斗");
  expect(await labels(page)).not.toContain("Ursa Major");
  await choice(page, "Western").click();
  await expect.poll(() => param(page, "culture")).toBeNull();
  await expect.poll(() => labels(page)).toContain("Ursa Major");
});

test("an address with culture= opens in that sky, and a word that is no culture is the Western sky", async ({ page }) => {
  await open(page, "?culture=japanese&ra=60&dec=20&zoom=2.2");
  await expect(choice(page, "Japanese")).toHaveAttribute("aria-pressed", "true");
  expect(await labels(page)).toContain("昴");
  await open(page, "?culture=klingon");
  await expect(choice(page, "Western")).toHaveAttribute("aria-pressed", "true");
});

test("a figure is found by its name in any language, and picking it shows its card with its names, reading and stars", async ({ page }) => {
  await open(page, "?culture=chinese");
  await page.getByTestId("search").fill("beidou");
  await page.getByTestId("results").locator("button").first().click();
  await expect.poll(() => param(page, "pick")).toBe("C:bei3-dou3");
  const card = page.getByTestId("picked");
  await expect(card).toContainText("北斗");
  await expect(card).toContainText("běi dǒu");
  await expect(card).toContainText("Dubhe");
  await expect(card).toContainText("Ursa Major");
  await expect(card).toContainText("our own joins");
  await open(page, "?culture=chinese&pick=C:jiao3-xiu4");
  await expect(page.getByTestId("picked")).toContainText("Horn");
  await expect(page.getByTestId("picked")).toContainText("Azure Dragon");
  await expect(page.getByTestId("picked")).toContainText("Spica");
  await open(page, "?culture=japanese");
  await page.getByTestId("search").fill("むつらぼし");
  await page.getByTestId("results").locator("button").first().click();
  await expect.poll(() => param(page, "pick")).toBe("C:subaru");
  await expect(page.getByTestId("picked")).toContainText("すばる");
  await expect(page.getByTestId("picked")).toContainText("the Pleiades");
  await open(page, "?culture=western");
  await page.getByTestId("search").fill("天龙座");
  await page.getByTestId("results").locator("button").first().click();
  await expect.poll(() => param(page, "pick")).toBe("C:Dra");
  await expect(page.getByTestId("picked")).toContainText("tiān lóng zuò");
  await expect(page.getByTestId("picked")).toContainText("天龍座 / 天龙座");
});

test("a figure with stars not in our data says so on its card, and draws only the stars it has", async ({ page }) => {
  await open(page, "?culture=chinese&pick=C:yu3-lin2-jun1");
  await expect(page.getByTestId("figure-note").first()).toContainText(/At least \d+ of its stars are not in our data \(fainter than magnitude 6\.0, which the catalogue does not hold, or not named in our source\)/);
  await open(page, "?culture=chinese&pick=C:bei3-dou3");
  await expect(page.getByTestId("picked")).not.toContainText("not in our data");
});

test("a pick that is not in the new culture is dropped when the culture changes", async ({ page }) => {
  await open(page, "?culture=japanese&pick=C:subaru");
  await expect(page.getByTestId("picked")).toContainText("すばる");
  await choice(page, "Chinese").click();
  await expect.poll(() => param(page, "pick")).toBeNull();
  await expect(page.getByTestId("picked")).toContainText("Tap the chart");
});

test("tapping on a line of a Chinese figure picks the figure", async ({ page }) => {
  await open(page, "?culture=chinese&ra=190&dec=55&zoom=9&layers=lines");
  await page.locator("#chart").scrollIntoViewIfNeeded();
  const spot = await page.evaluate(() => {
    const svg = document.getElementById("chart")!;
    const box = svg.getBoundingClientRect();
    const stars = [...svg.querySelectorAll("circle")].map((c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))] as const);
    const d = svg.querySelector("path[stroke='#6f93e0']")?.getAttribute("d") ?? "";
    for (const piece of d.split("M").filter(Boolean)) {
      const [a, b] = piece.split("L").map((p) => p.split(" ").map(Number)) as [number[], number[]];
      const x = (a[0]! + b[0]!) / 2;
      const y = (a[1]! + b[1]!) / 2;
      if (x < 20 || y < 20 || x > box.width - 20 || y > box.height - 20) continue;
      if (stars.every(([sx, sy]) => Math.hypot(sx - x, sy - y) > 26)) return { x: box.left + x, y: box.top + y };
    }
    return undefined;
  });
  expect(spot).toBeDefined();
  await page.mouse.click(spot!.x, spot!.y);
  await expect.poll(() => param(page, "pick") ?? "").toMatch(/^C:[a-z0-9-]+$/);
  await expect(page.getByTestId("picked").locator("h3")).not.toBeEmpty();
});

test("the names of the figures in Japanese and Chinese are at least 12 pixels, stay inside the chart and do not overlap, at a phone's width too", async ({ page }) => {
  for (const culture of ["chinese", "japanese"]) {
    await open(page, `?culture=${culture}&ra=270&dec=-20&zoom=1.6&lang=ja`);
    const found = await page.evaluate(() => {
      const svg = document.getElementById("chart")!;
      const at = svg.getBoundingClientRect();
      const cjk = [...svg.querySelectorAll("text")].filter((t) => /[\u3040-\u309f\u4e00-\u9fff]/.test(t.textContent ?? ""));
      const boxes = cjk.map((t) => {
        const r = t.getBoundingClientRect();
        return { text: t.textContent, size: Number(t.getAttribute("font-size")), x0: r.left - at.left, y0: r.top - at.top, x1: r.right - at.left, y1: r.bottom - at.top, w: at.width, h: at.height };
      });
      return boxes;
    });
    expect(found.length, culture).toBeGreaterThan(10);
    for (const b of found) {
      expect(b.size, `${b.text} is ${b.size}px`).toBeGreaterThanOrEqual(12);
      expect(b.x0, `${b.text} sticks out on the left`).toBeGreaterThanOrEqual(-3);
      expect(b.y0, `${b.text} sticks out at the top`).toBeGreaterThanOrEqual(-3);
      expect(b.x1, `${b.text} sticks out on the right`).toBeLessThanOrEqual(b.w + 3);
      expect(b.y1, `${b.text} sticks out at the bottom`).toBeLessThanOrEqual(b.h + 3);
    }
    for (let i = 0; i < found.length; i++) {
      for (let j = i + 1; j < found.length; j++) {
        const a = found[i]!;
        const b = found[j]!;
        const wide = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const high = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        expect(wide > 3 && high > 3, `${a.text} and ${b.text} overlap`).toBe(false);
      }
    }
  }
});

test("the Chinese sky has a Mansions switch: hour circles through the determinative stars, dashed, kept in the address, and the switch is there only in that sky", async ({ page }) => {
  const mansions = page.locator('#seg-layers button[data-value="mansions"]');
  const circles = () => page.locator('#chart path[data-layer="mansions"]').count();
  await open(page, "?ra=225&dec=-12&zoom=3");
  await expect(mansions).toBeHidden();
  await open(page, "?culture=chinese&ra=225&dec=-12&zoom=3");
  await expect(mansions).toBeVisible();
  await expect(mansions).toHaveText("Mansions");
  await expect(mansions).toHaveAttribute("aria-pressed", "false");
  expect(await circles()).toBe(0);
  await mansions.click();
  await expect(mansions).toHaveAttribute("aria-pressed", "true");
  await expect.poll(circles).toBe(1);
  await expect.poll(() => param(page, "layers")).toContain("mansions");
  // the circles of 角, 亢, 房 and 心 are in view round Libra and Scorpius
  const lines = await page.locator('#chart path[data-layer="mansions"]').evaluate((path) => (path.getAttribute("d")!.match(/M/g) ?? []).length);
  expect(lines).toBeGreaterThanOrEqual(4);
  await open(page, "?culture=chinese&lang=ja&layers=milky,lines,mansions,names");
  await expect(mansions).toHaveText("二十八宿");
  await expect.poll(circles).toBe(1);
});
