import { test, expect } from "@playwright/test";
import { getTenantSlugs, getTenant } from "@/lib/tenants";

// Deliberately minimal: proves the Playwright setup itself works end-to-end
// (browser launches, dev server starts, a real tenant page loads) before any
// scenario-specific (cart, cross-tenant isolation) suites are layered on top.
test("first tenant's page loads successfully", async ({ page }) => {
  const [slug] = getTenantSlugs();
  const tenant = getTenant(slug);
  if (!tenant) throw new Error(`No tenant config found for slug "${slug}"`);

  const response = await page.goto(`/${slug}`);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    tenant.name
  );
  await expect(page.locator("header")).toContainText(tenant.name);
});
