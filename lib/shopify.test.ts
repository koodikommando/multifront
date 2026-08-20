import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ShopifyError,
  addToCart,
  createCart,
  getCart,
  getProductsByTag,
  removeFromCart,
  updateCartLines,
  type ShopifyCart,
} from "@/lib/shopify";

function makeCart(overrides: Partial<ShopifyCart> = {}): ShopifyCart {
  return {
    id: "gid://shopify/Cart/default",
    checkoutUrl: "https://example.myshopify.com/cart/c/default",
    totalQuantity: 1,
    cost: { subtotalAmount: { amount: "10.00", currencyCode: "USD" } },
    lines: { nodes: [] },
    ...overrides,
  };
}

function mockResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; statusText?: string } = {}
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  process.env.SHOPIFY_STORE_DOMAIN = "test-store.myshopify.com";
  process.env.SHOPIFY_STOREFRONT_TOKEN = "test-token";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SHOPIFY_STORE_DOMAIN;
  delete process.env.SHOPIFY_STOREFRONT_TOKEN;
});

describe("shopifyFetch env var guard", () => {
  it("throws ShopifyError when SHOPIFY_STORE_DOMAIN is missing", async () => {
    delete process.env.SHOPIFY_STORE_DOMAIN;

    await expect(getProductsByTag("team:alpha")).rejects.toThrow(ShopifyError);
    await expect(getProductsByTag("team:alpha")).rejects.toThrow(
      "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_TOKEN environment variable"
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws ShopifyError when SHOPIFY_STOREFRONT_TOKEN is missing", async () => {
    delete process.env.SHOPIFY_STOREFRONT_TOKEN;

    await expect(getProductsByTag("team:alpha")).rejects.toThrow(
      "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_TOKEN environment variable"
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("shopifyFetch response handling", () => {
  it("throws ShopifyError when the HTTP response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({}, { ok: false, status: 500, statusText: "Internal Server Error" })
    );

    await expect(getProductsByTag("team:alpha")).rejects.toThrow(
      "Storefront API request failed: 500 Internal Server Error"
    );
  });

  it("throws ShopifyError when the response contains GraphQL errors", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({
        errors: [{ message: "field not found" }, { message: "bad query" }],
      })
    );

    await expect(getProductsByTag("team:alpha")).rejects.toThrow(
      "Storefront API errors: field not found; bad query"
    );
  });

  it("throws ShopifyError when the response has no data", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}));

    await expect(getProductsByTag("team:alpha")).rejects.toThrow(
      "Storefront API returned no data"
    );
  });
});

describe("shopifyFetch request shape", () => {
  it("posts the tag filter to the Storefront API and uses ISR revalidation for product queries", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ data: { products: { nodes: [] } } })
    );

    await getProductsByTag("team:alpha", 12);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://test-store.myshopify.com/api/2026-01/graphql.json");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Shopify-Storefront-Private-Token": "test-token",
    });
    expect(init?.cache).toBeUndefined();
    expect(init?.next).toEqual({ revalidate: 300 });

    const body = JSON.parse(init?.body as string);
    expect(body.variables).toEqual({ query: "tag:'team:alpha'", first: 12 });
  });

  it("uses cache: no-store (not ISR) for cart requests, since carts are per-visitor", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({
        data: { cartCreate: { cart: makeCart(), userErrors: [] } },
      })
    );

    await createCart([{ merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 }]);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.cache).toBe("no-store");
    expect(init?.next).toBeUndefined();
  });
});

describe("cart mutation payload handling (unwrapCartPayload)", () => {
  it("throws ShopifyError with the userErrors message when Shopify rejects the mutation", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({
        data: {
          cartCreate: {
            cart: null,
            userErrors: [{ field: ["lines"], message: "Variant is sold out" }],
          },
        },
      })
    );

    await expect(
      createCart([{ merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 }])
    ).rejects.toThrow("cartCreate failed: Variant is sold out");
  });

  it("throws ShopifyError when Shopify returns neither a cart nor userErrors", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ data: { cartCreate: { cart: null, userErrors: [] } } })
    );

    await expect(
      createCart([{ merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 }])
    ).rejects.toThrow("cartCreate returned no cart");
  });

  it("returns the cart on success", async () => {
    const fakeCart = makeCart({ id: "gid://shopify/Cart/success" });
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ data: { cartCreate: { cart: fakeCart, userErrors: [] } } })
    );

    const result = await createCart([
      { merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 },
    ]);

    expect(result).toEqual(fakeCart);
  });
});

describe("cart operations read the correct response field", () => {
  it("addToCart reads data.cartLinesAdd", async () => {
    const fakeCart = makeCart();
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ data: { cartLinesAdd: { cart: fakeCart, userErrors: [] } } })
    );

    const result = await addToCart("gid://shopify/Cart/1", [
      { merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 },
    ]);

    expect(result).toEqual(fakeCart);
  });

  it("updateCartLines reads data.cartLinesUpdate", async () => {
    const fakeCart = makeCart();
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ data: { cartLinesUpdate: { cart: fakeCart, userErrors: [] } } })
    );

    const result = await updateCartLines("gid://shopify/Cart/1", [
      { id: "line-1", quantity: 2 },
    ]);

    expect(result).toEqual(fakeCart);
  });

  it("removeFromCart reads data.cartLinesRemove", async () => {
    const fakeCart = makeCart();
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ data: { cartLinesRemove: { cart: fakeCart, userErrors: [] } } })
    );

    const result = await removeFromCart("gid://shopify/Cart/1", ["line-1"]);

    expect(result).toEqual(fakeCart);
  });

  it("getCart reads data.cart and returns null when Shopify has no cart for that id (no unwrap/throw)", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { cart: null } }));

    const result = await getCart("gid://shopify/Cart/expired");

    expect(result).toBeNull();
  });
});
