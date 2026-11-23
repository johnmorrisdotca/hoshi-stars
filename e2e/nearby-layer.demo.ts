// The Nearby stars layer on the demo's chart: off to begin with, a ring on each nearby star from a close zoom (Proxima Centauri, named), switched by its button and kept in the address, and none drawn twice with the faint layer.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const PROXIMA = "ra=217.43&dec=-62.68&zoom=60";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const rings = (page: Page) => page.locator("#chart [data-nearby-ring]");
const button = (page: Page) => page.locator('#seg-layers button[data-value="nearby"]');

test("the layer is off to begin with, its button turns it on, and the address keeps it", async ({ page }) => {
  await page.goto(`${HOME}?${PROXIMA}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await expect(button(page)).toHaveText("Nearby stars");
  await expect(button(page)).toHaveAttribute("aria-pressed", "false");
  await expect(rings(page)).toHaveCount(0);
  await button(page).click();
  await expect(button(page)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => rings(page).count()).toBeGreaterThan(0);
  await expect(page.locator('#chart [data-nearby-ring="gctp-3278"]')).toHaveCount(1);
  await expect(page.locator("#chart text", { hasText: "Proxima Centauri" }).first()).toBeVisible();
  await expect.poll(() => param(page, "layers")).toContain("nearby");
  await button(page).click();
  await expect(rings(page)).toHaveCount(0);
  await expect.poll(() => param(page, "layers")).not.toContain("nearby");
});

test("an address with the layer opens with it, and a wide view draws none", async ({ page }) => {
  await page.goto(`${HOME}?${PROXIMA}&layers=names,nearby`);
  await expect.poll(() => rings(page).count()).toBeGreaterThan(0);
  await page.goto(`${HOME}?ra=217.43&dec=-62.68&zoom=1&layers=names,nearby`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await expect(rings(page)).toHaveCount(0);
});

test("a nearby star is drawn once: with the faint layer on its dot is the faint layer's, and the ring is added", async ({ page }) => {
  await page.goto(`${HOME}?${PROXIMA}&layers=names,faint,nearby`);
  await expect.poll(() => rings(page).count()).toBeGreaterThan(0);
  await expect(page.getByTestId("faint-note")).toContainText("Stars to magnitude");
  const ids = await page.locator("#chart [data-nearby]").evaluateAll((all) => all.map((node) => node.getAttribute("data-nearby")));
  expect(new Set(ids).size).toBe(ids.length);
  const ringIds = await rings(page).evaluateAll((all) => all.map((node) => node.getAttribute("data-nearby-ring")));
  expect(ids.length).toBeLessThanOrEqual(ringIds.length);
});
