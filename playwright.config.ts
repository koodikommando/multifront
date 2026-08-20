import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",

  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // `next dev` boots faster than a full production build and, unlike
  // `next start`, doesn't require prerendering every tenant against the
  // real Storefront API at startup (app/[tenant]/page.tsx sets
  // dynamicParams = false + generateStaticParams). The page itself still
  // calls the real API per-request, so SHOPIFY_STORE_DOMAIN /
  // SHOPIFY_STOREFRONT_TOKEN must point at a real store either way — see
  // README/CI for where those come from locally vs. in CI.
  webServer: {
    // Fixed, non-default port: 3000 is commonly occupied by other local
    // projects, and reuseExistingServer would silently attach to whatever
    // is already listening there instead of failing loudly.
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
