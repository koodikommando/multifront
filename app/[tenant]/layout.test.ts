import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenants";
import CartProvider from "@/components/cart-provider";
import TenantLayout, { generateMetadata } from "@/app/[tenant]/layout";

// Same rationale as app/[tenant]/page.test.ts: TenantLayout imports
// CartProvider/CartDrawer, which pull in lib/cart-actions.ts (next/headers,
// lib/shopify) at module scope, even though those components are never
// actually invoked by these tests (JSX only references them as element
// types). Mocked here as a safety net, matching lib/cart-actions.test.ts.
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/shopify", () => ({
  getProductsByTag: vi.fn(),
  addToCart: vi.fn(),
  createCart: vi.fn(),
  getCart: vi.fn(),
  removeFromCart: vi.fn(),
  updateCartLines: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(notFound).mockClear();
});

describe("generateMetadata", () => {
  it("sets the tenant name as title and noindex/nofollow robots for a known slug", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ tenant: "beta" }),
    });

    expect(metadata).toEqual({
      title: "beta",
      robots: { index: false, follow: false },
    });
  });

  it("returns empty metadata for an unknown slug, without calling notFound", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ tenant: "not-a-real-tenant" }),
    });

    expect(metadata).toEqual({});
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("TenantLayout", () => {
  it("resolves the right tenant and applies its theme for a known slug", async () => {
    const config = getTenant("alpha")!;
    const marker = "children-marker";

    const result = await TenantLayout({
      children: marker,
      params: Promise.resolve({ tenant: "alpha" }),
    });

    expect(result.type).toBe("div");
    expect(result.props.style).toEqual({
      "--tenant-primary": config.theme.primary,
      "--tenant-accent": config.theme.accent,
      "--tenant-background": config.theme.background,
      "--tenant-foreground": config.theme.foreground,
      "--tenant-surface": config.theme.surface,
    });

    const cartProviderEl = result.props.children;
    expect(cartProviderEl.type).toBe(CartProvider);
    expect(cartProviderEl.props.tenantSlug).toBe("alpha");

    const [, main] = cartProviderEl.props.children;
    expect(main.type).toBe("main");
    expect(main.props.children).toBe(marker);
  });

  it("calls notFound() for an unknown slug before rendering any tenant chrome", async () => {
    await expect(
      TenantLayout({
        children: null,
        params: Promise.resolve({ tenant: "not-a-real-tenant" }),
      })
    ).rejects.toThrow();

    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
