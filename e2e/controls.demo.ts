// No control is left in the browser's own style, every control of the demo is big enough to touch, and nothing scrolls the page sideways: in light and in dark, in both languages.
import { expect, test, type Page } from "@playwright/test";

const ADDRESSES = ["/hoshi-stars/", "/hoshi-stars/?lang=ja", "/hoshi-stars/embed.html", "/hoshi-stars/docs/index.html", "/hoshi-stars/docs/ja/index.html", "/hoshi-stars/constellations.html", "/hoshi-stars/constellations.html?lang=ja", "/hoshi-stars/constellation.html?c=Ori", "/hoshi-stars/constellation-list.html", "/hoshi-stars/constellation-list.html?lang=ja", "/hoshi-stars/birthday.html?date=2020-12-01", "/hoshi-stars/birthday.html?date=2020-12-01&lang=ja", "/hoshi-stars/layers-3d.html?spin=off", "/hoshi-stars/layers-3d.html?spin=off&lang=ja"] as const;
const SCHEMES = ["light", "dark"] as const;

/** Visible controls that still look as the browser draws them: the same border, ground and corners as a fresh, unstyled control of the same kind. */
async function unstyled(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const look = (el: Element) => {
      const s = getComputedStyle(el);
      return [s.borderTopStyle, s.borderTopWidth, s.borderTopColor, s.backgroundColor, s.borderTopLeftRadius, s.backgroundImage].join("|");
    };
    const probes = new Map<string, string>();
    const probe = (kind: string) => {
      const cached = probes.get(kind);
      if (cached !== undefined) return cached;
      const el = document.createElement(kind === "checkbox" || kind === "radio" || kind === "search" || kind === "range" ? "input" : kind);
      if (el instanceof HTMLInputElement) el.type = kind;
      el.style.cssText = "all: revert; position: absolute; visibility: hidden";
      document.body.append(el);
      const signature = look(el);
      probes.set(kind, signature);
      el.remove();
      return signature;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const kindOf = (el: Element) => {
      if (el instanceof HTMLInputElement) return ["checkbox", "radio", "search", "text"].includes(el.type) ? el.type : "";
      const tag = el.tagName.toLowerCase();
      return tag === "button" || tag === "select" ? tag : "";
    };
    return [...document.querySelectorAll("button, select, input")]
      .filter((el) => {
        const kind = kindOf(el);
        return kind !== "" && visible(el) && look(el) === probe(kind);
      })
      .map((el) => `${kindOf(el)}${el.id === "" ? "" : `#${el.id}`}`);
  });
}

for (const scheme of SCHEMES) {
  for (const path of ADDRESSES) {
    test(`${path} has no control in the browser's own style (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await expect(page.locator(path.includes("embed") ? "svg circle" : "header").first()).toBeVisible();
      expect(await unstyled(page)).toEqual([]);
    });
  }
}

test("every control of the demo is at least 48 px high, the family's own at least 44, and nothing scrolls the page sideways", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await expect(page.locator("#chart circle").first()).toBeVisible();
  const small = await page.evaluate(() => {
    const own = (el: Element) => el.closest(".sky, .more") !== null && el.closest("kazoku-embed-panel") === null;
    return [...document.querySelectorAll("button, select, input")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.height < (own(el) ? 48 : 44) - 0.5;
      })
      .map((el) => `${el.tagName}#${el.id}.${el.className} ${Math.round(el.getBoundingClientRect().height)}`);
  });
  expect(small).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
