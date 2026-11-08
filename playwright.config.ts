// The demo's own tests: a real browser, real taps. `pnpm test:demo` builds the site and runs them.
// The server is scripts/dev.ts on port 8251, at the site's real address /hoshi-stars/: this package's block of ports is 8250 to 8274, and tests use 8251.
// The projects are Chromium and WebKit at a desk's width and a phone's. The demo is SVG only, so nothing here asks for the graphics card.
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.TEST_PORT ?? 8251);
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const desk = { viewport: { width: 1280, height: 900 } };

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.demo.{ts,mjs}",
  fullyParallel: true,
  forbidOnly: true,
  workers: process.env.CI ? 2 : 2,
  timeout: 60_000,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, reducedMotion: "reduce", locale: "en-US" },
  webServer: { command: "node scripts/dev.ts", env: { PORT: String(port) }, url: `http://127.0.0.1:${port}/hoshi-stars/`, reuseExistingServer: false },
  projects: [
    { name: "chromium-desk", use: { ...devices["Desktop Chrome"], ...desk } },
    { name: "chromium-phone", use: { ...devices["Desktop Chrome"], ...phone } },
    // WebKit on a desktop viewport with touch: `isMobile` is Chromium's to honour.
    { name: "webkit-desk", use: { ...devices["Desktop Safari"], ...desk } },
    { name: "webkit-phone", use: { ...devices["Desktop Safari"], viewport: phone.viewport, hasTouch: true } },
  ],
});
