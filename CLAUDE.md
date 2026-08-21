# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Multifront: a multi-tenant Shopify storefront engine on Next.js 15 (App Router, Turbopack, React 19, TypeScript, Tailwind v4). One deployment serves several independently themed storefronts (`/alpha`, `/beta`, `/omega`, ...) from a single shared Shopify store, each showing only the products tagged for that tenant, with fully separated carts and no cross-tenant enumeration or linking. There is no database — each tenant is a static config entry in `lib/tenants.ts`, and this is category-agnostic (a tenant can be a sports club, a band, an event, etc.).

**Isolation is the core design constraint of this codebase.** Any change touching routing, cart cookies, or the Shopify query layer should be evaluated against: can this let tenant A see or affect tenant B's data?

## Commands

```bash
npm run dev        # Next.js dev server (Turbopack), http://localhost:3000
npm run build      # production build (Turbopack) — prerenders every tenant page, see below
npm run start      # run the production build
npm run lint       # ESLint (next/core-web-vitals, next/typescript)
npx tsc --noEmit   # type check
npm run test       # Vitest, unit + integration, run once
npm run test:e2e   # Playwright e2e suite (see tests/e2e/)
```

Single test file / single test, Vitest: `npx vitest run lib/cart-actions.test.ts` / `npx vitest run -t "test name"`.
Single test file, Playwright: `npx playwright test tests/e2e/smoke.spec.ts` (add `--ui` for the interactive runner, `--headed` to watch the browser).

Both `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_TOKEN` are required env vars (`.env.example` → `.env.local`); `lib/shopify.ts` throws immediately if either is missing. `npm run build` calls the **real** Storefront API at build time for every tenant (see below), so placeholder values fail the build, not just skip validation — same is true when actually loading a tenant page under `npm run dev` or `test:e2e`, since product fetches are real network calls with no mocking anywhere in this repo.

## Architecture

One Next.js app serves N storefronts under a dynamic `[tenant]` route segment.

```
app/[tenant] page  →  app/[tenant]/page.tsx (ISR, static params) → lib/tenants.ts (slug → tag + theme)
                                          ↓
                                   lib/shopify.ts → Shopify Storefront API
CartDrawer / AddToCartButton → lib/cart-actions.ts (Server Actions) → lib/tenants.ts
                                          ↓                              ↓
                                   cart_{slug} cookie              lib/shopify.ts
                                   (httpOnly, Path=/{slug})
```

**Routing & tenancy**
- `app/[tenant]/page.tsx` pre-renders one static route per entry in `lib/tenants.ts` (`generateStaticParams`, `dynamicParams = false`) — any slug not in the registry 404s at the router, before any Shopify call. Pages revalidate every 300s (ISR).
- `app/[tenant]/layout.tsx` resolves the tenant config, injects theme colors as CSS custom properties, and wraps the page in `CartProvider`.
- `app/page.tsx` (root `/`) is intentionally generic and must never list or link to tenant storefronts. `app/robots.ts` disallows all crawling; tenant pages additionally set `robots: noindex`. There is no sitemap — tenant storefronts are reachable only by someone who already has the URL.

**Product data (`lib/shopify.ts`)**
- `server-only` GraphQL client for the Shopify Storefront API, pinned API version, private-token auth via `Shopify-Storefront-Private-Token` (never exposed client-side).
- `getProductsByTag(tag)` queries by the tenant's Shopify tag. `lib/tenants.ts` is the single source of truth for slug → tag mapping — a tenant's product query always comes from server-trusted config, never from the URL. This is the core of store isolation; don't derive a Shopify tag from anything client-supplied.

**Cart handling**
- Cart mutations (`createCart`, `addToCart`, `updateCartLines`, `removeFromCart`, `getCart`) live in `lib/shopify.ts`, always `cache: "no-store"` (per-visitor data).
- `lib/cart-actions.ts` exposes these as `"use server"` Server Actions. Every action re-validates the tenant slug against `lib/tenants.ts` and derives an httpOnly cookie named `cart_{slug}` scoped to `Path=/{slug}` — the cart ID never reaches client JS, and the browser only presents a tenant's cookie on that tenant's own routes. When adding a new cart action, follow the same pattern: validate slug first, derive cookie name from the validated slug (never from client input).
- Because tenant pages are statically rendered (ISR), cart state can't live in server-rendered HTML — `components/cart-provider.tsx` hydrates it client-side on mount via a Server Action call, then keeps it in React context (`useCart`) for `AddToCartButton`/`CartDrawer`.

**Adding a new tenant**: add an entry to `lib/tenants.ts` (name, Shopify tag, theme colors) and tag the corresponding products in Shopify. That's the entire integration surface — the route is picked up automatically via `generateStaticParams`, no other code changes needed.

## Testing

- Vitest tests are colocated with source (`*.test.ts` next to the file), not centralized — e.g. `lib/tenants.test.ts`, `lib/cart-actions.test.ts`, `lib/shopify.test.ts`, `app/[tenant]/page.test.ts`, `app/[tenant]/layout.test.ts`. `app/[tenant]/*.test.ts` call the async Server Components directly and assert on the returned React element tree (`.type`/`.props`) — no DOM renderer/jsdom.
- `lib/shopify.ts` imports `server-only`, which throws unconditionally outside a bundler that aliases it to a no-op. `vitest.config.mts` aliases it to `tests/server-only-shim.ts` (an empty stub) so tests can import server-only code directly in Node.
- `tests/e2e/` holds the Playwright suite (currently a deliberately minimal smoke test: a real tenant page loads with real data, and the root path renders only the generic placeholder — nothing tenant-specific leaks there). `playwright.config.ts`'s `webServer` runs `next dev` on port **3100** (not 3000, to avoid colliding with other local dev servers) rather than a production build, since `next dev` boots faster and doesn't force-prerender every tenant at startup.
- No test in this repo mocks the Shopify network layer at the e2e level — `test:e2e` needs real, working `SHOPIFY_STORE_DOMAIN`/`SHOPIFY_STOREFRONT_TOKEN`, both locally and in CI.
- Not yet covered: client components (`cart-provider.tsx`, `cart-drawer.tsx`, etc.) have no unit tests; the e2e suite has no cart/cross-tenant-isolation scenarios yet (deliberately deferred until the smoke-test baseline is solid).

## Playwright conventions
- Use `getByRole`/`getByText`/`getByLabel` locators (user-facing attributes),
  never CSS class or XPath selectors — the DOM will change, these won't.
- Use web-first assertions (`await expect(locator).toBeVisible()`), never
  manual checks like `expect(await locator.isVisible()).toBe(true)`.
- Each test must be fully isolated — no test should depend on state left by
  another. Use `test.beforeEach` for shared setup (e.g. navigating to a
  tenant page) rather than relying on test execution order.
- Don't test third-party/Shopify-hosted checkout pages directly if the flow
  ever leaves our domain — stop the assertion at the point our app hands off.
- Keep the suite focused on isolation-critical paths (see "Testing" section
  above) — don't expand into full UI/visual coverage without discussing it
  first.

## Playwright MCP
This repo has the Playwright MCP server available for browser automation.
When writing or debugging e2e tests, prefer using it to inspect the real
running app (navigate, take an accessibility snapshot, verify a locator
actually matches) rather than guessing selectors from the source alone —
this requires `npm run dev` (or the Playwright webServer) to be running.
Say "use Playwright MCP" explicitly when you want this behavior; otherwise
Claude Code may default to writing test code without live verification.

## CI

- `.github/workflows/ci.yml` (push + PR to `main`): lint → typecheck → `npm run test` → `npm run build`. Build needs *real* Shopify secrets (not placeholders) because it statically prerenders every tenant page against the live Storefront API at build time — a prior CI iteration used placeholder values here and the build broke, so don't reintroduce that.
- `.github/workflows/e2e.yml` (push + PR to `main`): installs Playwright's chromium browser, runs `npm run test:e2e` with the same real Shopify secrets, uploads the HTML report as an artifact on any non-cancelled run.


## Commit messages
After any prompt where you edit, create, or delete files, end your response
with a suggested one-line commit message in a code block, formatted as:
`type: short description`
(e.g. `feat: add cart drawer state persistence`). Don't commit automatically —
just suggest it.