// The data credits: every page of the demo shows where its stars come from, and a link to every credit, without opening a menu. The family pages carry them in the footer, the bare pages made for an iframe in a corner.
import { expect, test } from "@playwright/test";

const NOTICE = "https://github.com/johnmorrisdotca/hoshi-stars/blob/main/NOTICE.md";
const PAGES = ["", "kids.html", "tonight.html", "life.html", "planisphere.html", "tap-dots.html", "constellations.html", "constellation.html?c=Ori", "constellation-list.html", "whole-sky.html", "birthday.html?date=2020-12-01", "quiz.html?c=Ori", "layers-3d.html?spin=off"];
const FRAMES = ["embed.html", "embed-layers.html?spin=off", "embed-quiz.html?level=88", "embed.html?c=Ori&zoom=4", "star.html?star=2491", "star.html?star=2491&view=compare"];

for (const lang of ["en", "ja"] as const) {
  for (const path of PAGES) {
    test(`${path || "the home page"} in ${lang} shows its credits in the footer`, async ({ page }) => {
      await page.goto(`/hoshi-stars/${path}${path.includes("?") ? "&" : "?"}lang=${lang}`);
      const footer = page.locator("footer");
      await expect(footer.locator('[data-say="foot"]')).toContainText(lang === "ja" ? "イェール輝星カタログ" : "Yale Bright Star Catalogue");
      const all = footer.locator(`a[href="${NOTICE}"]`);
      await expect(all).toBeVisible();
      await expect(all).toContainText(lang === "ja" ? "出典" : "credit");
    });
  }
  for (const path of FRAMES) {
    test(`${path} in ${lang} names its source in a corner`, async ({ page }) => {
      await page.goto(`/hoshi-stars/${path}${path.includes("?") ? "&" : "?"}lang=${lang}`);
      const credit = page.getByTestId("frame-credit");
      await expect(credit).toBeVisible();
      await expect(credit).toContainText(lang === "ja" ? "イェール輝星カタログ" : "Yale Bright Star Catalogue");
      await expect(credit).toHaveAttribute("href", NOTICE);
      const box = (await credit.boundingBox())!;
      const size = page.viewportSize()!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      for (const button of await page.locator("button").all()) {
        const other = await button.boundingBox();
        if (other !== null) expect(box.y + box.height <= other.y || other.y + other.height <= box.y || box.x + box.width <= other.x || other.x + other.width <= box.x, "the credit covers a button").toBe(true);
      }
    });
  }
}
