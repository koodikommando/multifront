import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import {
  addToCart,
  createCart,
  getCart,
  removeFromCart,
  updateCartLines,
  type ShopifyCart,
} from "@/lib/shopify";
import {
  addToCartAction,
  getCartAction,
  removeLineAction,
  updateLineAction,
} from "@/lib/cart-actions";

// lib/cart-actions.ts is "use server" code: it calls next/headers' cookies()
// (only valid inside a real Next.js request) and lib/shopify.ts (which would
// hit the real Storefront API). Both are mocked so these tests exercise only
// the isolation logic — tenant validation, cookie scoping, and which
// Shopify client function gets called — without a live Next server or store.
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/shopify", () => ({
  addToCart: vi.fn(),
  createCart: vi.fn(),
  getCart: vi.fn(),
  removeFromCart: vi.fn(),
  updateCartLines: vi.fn(),
}));

type CookieRecord = { value: string; options?: Record<string, unknown> };

/** Minimal in-memory stand-in for Next's cookie store, scoped per test. */
class FakeCookieStore {
  private store = new Map<string, CookieRecord>();

  get(name: string) {
    const record = this.store.get(name);
    return record ? { name, value: record.value } : undefined;
  }

  set(name: string, value: string, options?: Record<string, unknown>) {
    this.store.set(name, { value, options });
  }

  seed(name: string, value: string) {
    this.store.set(name, { value });
  }

  raw(name: string) {
    return this.store.get(name);
  }
}

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

let store: FakeCookieStore;

beforeEach(() => {
  store = new FakeCookieStore();
  vi.mocked(cookies).mockReset();
  vi.mocked(cookies).mockResolvedValue(
    store as unknown as Awaited<ReturnType<typeof cookies>>
  );
  vi.mocked(addToCart).mockReset();
  vi.mocked(createCart).mockReset();
  vi.mocked(getCart).mockReset();
  vi.mocked(removeFromCart).mockReset();
  vi.mocked(updateCartLines).mockReset();
});

describe("tenant slug validation", () => {
  it.each([
    ["getCartAction", () => getCartAction("not-a-real-tenant")],
    ["addToCartAction", () => addToCartAction("not-a-real-tenant", "merch-1")],
    ["updateLineAction", () => updateLineAction("not-a-real-tenant", "line-1", 2)],
    ["removeLineAction", () => removeLineAction("not-a-real-tenant", "line-1")],
  ])("%s rejects an unknown tenant slug before touching cookies or Shopify", async (_name, run) => {
    await expect(run()).rejects.toThrow("Unknown tenant");

    // Rejection happens in assertTenantSlug, before cookies() is even
    // awaited, so neither the cookie store nor Shopify should be touched.
    expect(cookies).not.toHaveBeenCalled();
    expect(getCart).not.toHaveBeenCalled();
    expect(addToCart).not.toHaveBeenCalled();
    expect(createCart).not.toHaveBeenCalled();
    expect(updateCartLines).not.toHaveBeenCalled();
    expect(removeFromCart).not.toHaveBeenCalled();
  });
});

describe("cookie scoping for a known tenant", () => {
  it("addToCartAction sets a cookie named cart_{slug} scoped to path /{slug}", async () => {
    const fakeCart = makeCart({ id: "gid://shopify/Cart/new-1" });
    vi.mocked(createCart).mockResolvedValue(fakeCart);

    const result = await addToCartAction("alpha", "gid://shopify/ProductVariant/1");

    expect(result).toEqual(fakeCart);
    const cookie = store.raw("cart_alpha");
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe("gid://shopify/Cart/new-1");
    expect(cookie?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/alpha",
    });
  });

  it("getCartAction reads back the cart_{slug} cookie it wrote", async () => {
    store.seed("cart_beta", "cart-beta-id");
    const fakeCart = makeCart({ id: "cart-beta-id" });
    vi.mocked(getCart).mockResolvedValue(fakeCart);

    const result = await getCartAction("beta");

    expect(getCart).toHaveBeenCalledWith("cart-beta-id");
    expect(result).toEqual(fakeCart);
  });
});

describe("cross-tenant cart isolation", () => {
  it("does not read another tenant's cart cookie", async () => {
    store.seed("cart_alpha", "cart-alpha-id");

    const result = await getCartAction("beta");

    expect(result).toBeNull();
    expect(getCart).not.toHaveBeenCalled();
  });

  it("does not overwrite another tenant's cart cookie when writing", async () => {
    store.seed("cart_alpha", "cart-alpha-id");
    const fakeCart = makeCart({ id: "cart-beta-id" });
    vi.mocked(createCart).mockResolvedValue(fakeCart);

    await addToCartAction("beta", "merch-1");

    expect(store.raw("cart_alpha")?.value).toBe("cart-alpha-id");
    expect(store.raw("cart_beta")?.value).toBe("cart-beta-id");
    expect(store.raw("cart_beta")?.options).toMatchObject({ path: "/beta" });
  });

  it("never mixes up two tenants' cart ids on the same Shopify call", async () => {
    store.seed("cart_alpha", "cart-alpha-id");
    store.seed("cart_beta", "cart-beta-id");
    vi.mocked(removeFromCart).mockResolvedValue(makeCart());

    await removeLineAction("beta", "line-1");

    expect(removeFromCart).toHaveBeenCalledWith("cart-beta-id", ["line-1"]);
    expect(removeFromCart).not.toHaveBeenCalledWith("cart-alpha-id", expect.anything());
  });
});

describe("Shopify client dispatch", () => {
  it("getCartAction returns null without calling Shopify when there is no cart cookie", async () => {
    const result = await getCartAction("alpha");

    expect(result).toBeNull();
    expect(getCart).not.toHaveBeenCalled();
  });

  it("addToCartAction calls createCart when there is no existing cart cookie", async () => {
    const fakeCart = makeCart();
    vi.mocked(createCart).mockResolvedValue(fakeCart);

    await addToCartAction("alpha", "merch-1");

    expect(createCart).toHaveBeenCalledWith([{ merchandiseId: "merch-1", quantity: 1 }]);
    expect(addToCart).not.toHaveBeenCalled();
  });

  it("addToCartAction calls addToCart (not createCart) when a cart cookie already exists", async () => {
    store.seed("cart_alpha", "cart-alpha-id");
    vi.mocked(addToCart).mockResolvedValue(makeCart({ id: "cart-alpha-id" }));

    await addToCartAction("alpha", "merch-1");

    expect(addToCart).toHaveBeenCalledWith("cart-alpha-id", [
      { merchandiseId: "merch-1", quantity: 1 },
    ]);
    expect(createCart).not.toHaveBeenCalled();
  });

  it("addToCartAction falls back to createCart when the existing cart id is no longer valid", async () => {
    store.seed("cart_alpha", "expired-cart-id");
    vi.mocked(addToCart).mockRejectedValue(new Error("cart not found"));
    const fakeCart = makeCart({ id: "fresh-cart-id" });
    vi.mocked(createCart).mockResolvedValue(fakeCart);

    const result = await addToCartAction("alpha", "merch-1");

    expect(addToCart).toHaveBeenCalledWith("expired-cart-id", [
      { merchandiseId: "merch-1", quantity: 1 },
    ]);
    expect(createCart).toHaveBeenCalledWith([{ merchandiseId: "merch-1", quantity: 1 }]);
    expect(result).toEqual(fakeCart);
    expect(store.raw("cart_alpha")?.value).toBe("fresh-cart-id");
  });

  it("updateLineAction calls updateCartLines for a positive quantity", async () => {
    store.seed("cart_alpha", "cart-alpha-id");
    vi.mocked(updateCartLines).mockResolvedValue(makeCart());

    await updateLineAction("alpha", "line-1", 3);

    expect(updateCartLines).toHaveBeenCalledWith("cart-alpha-id", [
      { id: "line-1", quantity: 3 },
    ]);
    expect(removeFromCart).not.toHaveBeenCalled();
  });

  it("updateLineAction calls removeFromCart when quantity drops to zero or below", async () => {
    store.seed("cart_alpha", "cart-alpha-id");
    vi.mocked(removeFromCart).mockResolvedValue(makeCart());

    await updateLineAction("alpha", "line-1", 0);

    expect(removeFromCart).toHaveBeenCalledWith("cart-alpha-id", ["line-1"]);
    expect(updateCartLines).not.toHaveBeenCalled();
  });

  it("updateLineAction returns null without calling Shopify when there is no cart cookie", async () => {
    const result = await updateLineAction("alpha", "line-1", 2);

    expect(result).toBeNull();
    expect(updateCartLines).not.toHaveBeenCalled();
    expect(removeFromCart).not.toHaveBeenCalled();
  });

  it("removeLineAction calls removeFromCart with the tenant's cart id", async () => {
    store.seed("cart_alpha", "cart-alpha-id");
    vi.mocked(removeFromCart).mockResolvedValue(makeCart());

    await removeLineAction("alpha", "line-1");

    expect(removeFromCart).toHaveBeenCalledWith("cart-alpha-id", ["line-1"]);
  });

  it("removeLineAction returns null without calling Shopify when there is no cart cookie", async () => {
    const result = await removeLineAction("alpha", "line-1");

    expect(result).toBeNull();
    expect(removeFromCart).not.toHaveBeenCalled();
  });
});
