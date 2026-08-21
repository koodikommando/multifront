import { test, expect } from "@playwright/test";
import { getTenantSlugs } from "@/lib/tenants";

// These scenarios are tied to specific tenants' *real* Shopify inventory
// state (no seeded fixtures, no mocking at this layer — see
// tests/e2e/README.md for the current known state of each). The slugs are
// named by role rather than derived positionally from getTenantSlugs(),
// since which tenant is "first" in the registry says nothing about its
// stock. A future tenant rename or role reassignment only needs to update
// the values below.
const TENANT_WITH_STOCK_A = "alpha"; // real, in-stock, purchasable products
const TENANT_WITH_STOCK_B = "beta"; // real, in-stock, purchasable products
const TENANT_OUT_OF_STOCK = "omega"; // one product, out of stock
const TENANT_EMPTY = "gamma"; // zero products, empty-state UI

test.beforeAll(() => {
  const registeredSlugs = getTenantSlugs();
  for (const slug of [
    TENANT_WITH_STOCK_A,
    TENANT_WITH_STOCK_B,
    TENANT_OUT_OF_STOCK,
    TENANT_EMPTY,
  ] as const) {
    if (!registeredSlugs.includes(slug)) {
      throw new Error(
        `tests/e2e/cart-isolation.spec.ts expects tenant "${slug}" to exist in lib/tenants.ts, but it doesn't. Update the named constants (and tests/e2e/README.md) to match the current registry and real Shopify tenant data.`
      );
    }
  }
});

test.describe("add-to-cart and cross-tenant cart isolation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${TENANT_WITH_STOCK_A}`);
  });

  test("adding a product opens the cart drawer with that item and sets a cookie scoped to the tenant", async ({
    page,
    context,
  }) => {
    // Scope to a listitem that actually has an enabled "Add to cart"
    // button, rather than assuming the first product is purchasable.
    const purchasableProduct = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Add to cart" }) })
      .first();
    const productTitle = await purchasableProduct
      .getByRole("heading", { level: 2 })
      .innerText();

    await purchasableProduct.getByRole("button", { name: "Add to cart" }).click();

    // Adding to cart doesn't auto-open the drawer (components/cart-drawer.tsx
    // owns its own open state); open it explicitly to inspect contents.
    await page.getByRole("button", { name: /open cart/i }).click();
    const drawer = page.getByRole("dialog", { name: "Cart" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(productTitle)).toBeVisible();

    const cookies = await context.cookies();
    const cartCookie = cookies.find((c) => c.name === `cart_${TENANT_WITH_STOCK_A}`);
    expect(cartCookie).toBeDefined();
    expect(cartCookie?.path).toBe(`/${TENANT_WITH_STOCK_A}`);
    expect(cartCookie?.httpOnly).toBe(true);
    expect(cartCookie?.sameSite).toBe("Lax");
  });

  test("tenant B's cart stays empty and never receives tenant A's cart cookie", async ({
    page,
    context,
  }) => {
    const purchasableProduct = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Add to cart" }) })
      .first();
    await purchasableProduct.getByRole("button", { name: "Add to cart" }).click();
    await page.getByRole("button", { name: /open cart/i }).click();
    await expect(page.getByRole("dialog", { name: "Cart" })).toBeVisible();

    await page.goto(`/${TENANT_WITH_STOCK_B}`);
    await page.getByRole("button", { name: /open cart/i }).click();
    const drawerB = page.getByRole("dialog", { name: "Cart" });
    await expect(drawerB).toBeVisible();
    await expect(drawerB.getByText("Your cart is empty.")).toBeVisible();

    // context.cookies(url) mirrors the browser's own domain/path matching,
    // so this proves tenant A's Path=/{tenantA} cookie would never be sent
    // on a request to tenant B's routes.
    const cookiesVisibleToTenantB = await context.cookies(page.url());
    expect(
      cookiesVisibleToTenantB.some((c) => c.name === `cart_${TENANT_WITH_STOCK_A}`)
    ).toBe(false);
  });

  test("removing the only item in the cart empties it", async ({ page }) => {
    const purchasableProduct = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Add to cart" }) })
      .first();
    const productTitle = await purchasableProduct
      .getByRole("heading", { level: 2 })
      .innerText();

    await purchasableProduct.getByRole("button", { name: "Add to cart" }).click();
    await page.getByRole("button", { name: /open cart/i }).click();
    const drawer = page.getByRole("dialog", { name: "Cart" });
    await expect(drawer.getByText(productTitle)).toBeVisible();

    await drawer.getByRole("button", { name: "Remove" }).click();

    await expect(drawer.getByText(productTitle)).not.toBeVisible();
    await expect(drawer.getByText("Your cart is empty.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open cart, 0 items" })
    ).toBeVisible();
  });
});

test("omega: out-of-stock product is shown but cannot be added to cart", async ({
  page,
}) => {
  await page.goto(`/${TENANT_OUT_OF_STOCK}`);

  const products = page.getByRole("listitem");
  await expect(products).toHaveCount(1);
  await expect(products.getByRole("heading", { level: 2 })).toBeVisible();

  // AddToCartButton always renders — it swaps label/disabled state rather
  // than disappearing (components/add-to-cart-button.tsx).
  const soldOutButton = products.getByRole("button", { name: "Sold out" });
  await expect(soldOutButton).toBeVisible();
  await expect(soldOutButton).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
});

test("gamma: empty catalog shows the empty-state message and no product/cart UI", async ({
  page,
}) => {
  await page.goto(`/${TENANT_EMPTY}`);

  await expect(
    page.getByText("No products available yet. Check back soon.")
  ).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add to cart" })
  ).toHaveCount(0);
});

test("an unknown tenant slug 404s", async ({ page }) => {
  const response = await page.goto("/this-tenant-does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(page.getByText(/this page could not be found/i)).toBeVisible();
});
