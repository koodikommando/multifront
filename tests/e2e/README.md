# E2E test data

This suite runs against the **real, connected Shopify store** — nothing here is mocked or seeded. `SHOPIFY_STORE_DOMAIN`/`SHOPIFY_STOREFRONT_TOKEN` must point at a store where the tenants below are tagged the way this suite expects, or the affected tests will fail (not skip).

No fixtures are created or torn down by this suite. Each test picks a tenant whose *real* inventory state already matches what the scenario needs, rather than seeding data:

| Constant (`cart-isolation.spec.ts`) | Current slug | Real Shopify state | Used by |
| --- | --- | --- | --- |
| `TENANT_WITH_STOCK_A` | `alpha` | Real, in-stock, purchasable product(s) | Add-to-cart, cart cookie scoping, cross-tenant isolation (as "tenant A") |
| `TENANT_WITH_STOCK_B` | `beta` | Real, in-stock, purchasable product(s) | Cross-tenant isolation (as "tenant B": proves `TENANT_WITH_STOCK_A`'s cart/cookie doesn't leak here) |
| `TENANT_OUT_OF_STOCK` | `omega` | Exactly one product, out of stock | Out-of-stock UI (product visible, "Add to cart" replaced by a disabled "Sold out") |
| `TENANT_EMPTY` | `gamma` | Zero products | Empty-catalog UI ("No products available yet. Check back soon.", no product grid) |

These slugs are named by role (`TENANT_WITH_STOCK_A`, etc.) at the top of `cart-isolation.spec.ts` rather than derived positionally from `getTenantSlugs()` — registry order says nothing about which tenants actually have stock. A `test.beforeAll` in that file calls `getTenantSlugs()` and fails immediately, with a clear error, if any of the four constants' slugs no longer exist in the registry.

If the real store's data changes (a tenant gets restocked, a new tenant is added, `omega` sells its last unit, etc.), update both the constants' values in `cart-isolation.spec.ts` and this table to match — don't add fixture/seed data to make the old mapping true again.

`smoke.spec.ts` doesn't depend on a specific inventory state — it only asserts that the first tenant's page loads and that the root path renders the generic platform placeholder.
