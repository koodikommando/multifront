import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "next/navigation";
import { getTenantSlugs } from "@/lib/tenants";
import { getProductsByTag, type ShopifyProduct } from "@/lib/shopify";
import ProductGrid from "@/components/product-grid";
import TenantPage, { generateStaticParams } from "@/app/[tenant]/page";

// TenantPage's component tree (ProductGrid -> AddToCartButton ->
// CartProvider -> lib/cart-actions.ts) imports next/headers and
// lib/shopify at module scope, same as lib/cart-actions.test.ts. These
// nested components are never actually invoked here — TenantPage's JSX
// only references them as element types, it doesn't render them — so the
// mocks below are a safety net against any real request/Shopify call, not
// something these tests exercise directly (only getProductsByTag is,
// since TenantPage awaits it itself).
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

function makeProduct(overrides: Partial<ShopifyProduct> = {}): ShopifyProduct {
  return {
    id: "gid://shopify/Product/1",
    title: "Test Product",
    handle: "test-product",
    featuredImage: null,
    priceRange: { minVariantPrice: { amount: "10.00", currencyCode: "USD" } },
    variants: {
      nodes: [{ id: "gid://shopify/ProductVariant/1", availableForSale: true }],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(notFound).mockClear();
  vi.mocked(getProductsByTag).mockReset();
});

describe("generateStaticParams", () => {
  it("returns exactly the slugs in the tenant registry, no more, no less", () => {
    const params = generateStaticParams();

    expect(params).toEqual([{ tenant: "alpha" }, { tenant: "beta" }, { tenant: "omega" }]);
    expect(params.map((p) => p.tenant)).toEqual(getTenantSlugs());
  });
});

describe("TenantPage", () => {
  it("resolves the right tenant for a known slug and renders its products", async () => {
    const products = [makeProduct()];
    vi.mocked(getProductsByTag).mockResolvedValue(products);

    const result = await TenantPage({ params: Promise.resolve({ tenant: "alpha" }) });

    expect(getProductsByTag).toHaveBeenCalledWith("team:alpha");
    expect(result.type).toBe("div");

    const [heading, body] = result.props.children;
    const nameSpan = heading.props.children[1];
    expect(nameSpan.props.children).toBe("alpha");

    expect(body.type).toBe(ProductGrid);
    expect(body.props.products).toBe(products);
  });

  it("shows the empty state instead of ProductGrid when there are no products", async () => {
    vi.mocked(getProductsByTag).mockResolvedValue([]);

    const result = await TenantPage({ params: Promise.resolve({ tenant: "beta" }) });

    const [, body] = result.props.children;
    expect(body.type).toBe("p");
    expect(body.props.children).toBe("No products available yet. Check back soon.");
  });

  it("calls notFound() for an unknown slug before any product data is fetched", async () => {
    await expect(
      TenantPage({ params: Promise.resolve({ tenant: "not-a-real-tenant" }) })
    ).rejects.toThrow();

    expect(notFound).toHaveBeenCalledTimes(1);
    expect(getProductsByTag).not.toHaveBeenCalled();
  });
});
