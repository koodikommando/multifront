"use server";

import { cookies } from "next/headers";
import { getTenant } from "@/lib/tenants";
import {
  addToCart,
  createCart,
  getCart,
  removeFromCart,
  updateCartLines,
  type ShopifyCart,
} from "@/lib/shopify";

// Shopify carts expire after ~10 days of inactivity; the cookie must not
// outlive the cart.
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 10;

/**
 * Cart isolation happens here. Every action:
 * 1. validates the tenant slug against lib/tenants.ts (unknown slug -> throw),
 * 2. derives the cookie name `cart_${slug}` from that validated slug —
 *    never from anything else the client sent,
 * 3. scopes the cookie to Path=/{slug}, so the browser only presents it on
 *    that tenant's routes.
 * The cart ID itself never passes through the client (httpOnly).
 */
function assertTenantSlug(tenantSlug: string): string {
  if (!getTenant(tenantSlug)) {
    throw new Error("Unknown tenant");
  }
  return tenantSlug;
}

function cartCookieName(slug: string): string {
  return `cart_${slug}`;
}

function cartCookieOptions(slug: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: `/${slug}`,
    maxAge: CART_COOKIE_MAX_AGE,
  };
}

export async function getCartAction(
  tenantSlug: string
): Promise<ShopifyCart | null> {
  const slug = assertTenantSlug(tenantSlug);
  const cookieStore = await cookies();
  const cartId = cookieStore.get(cartCookieName(slug))?.value;
  if (!cartId) return null;
  return getCart(cartId);
}

export async function addToCartAction(
  tenantSlug: string,
  merchandiseId: string
): Promise<ShopifyCart> {
  const slug = assertTenantSlug(tenantSlug);
  const cookieStore = await cookies();
  const cartId = cookieStore.get(cartCookieName(slug))?.value;
  const lines = [{ merchandiseId, quantity: 1 }];

  let cart: ShopifyCart | null = null;
  if (cartId) {
    try {
      cart = await addToCart(cartId, lines);
    } catch {
      // Cart expired or was completed at checkout — fall through and
      // create a fresh one.
      cart = null;
    }
  }
  if (!cart) {
    cart = await createCart(lines);
  }

  // (Re)set the cookie on every add: refreshes maxAge and rebinds after a
  // recreated cart.
  cookieStore.set(cartCookieName(slug), cart.id, cartCookieOptions(slug));
  return cart;
}

export async function updateLineAction(
  tenantSlug: string,
  lineId: string,
  quantity: number
): Promise<ShopifyCart | null> {
  const slug = assertTenantSlug(tenantSlug);
  const cookieStore = await cookies();
  const cartId = cookieStore.get(cartCookieName(slug))?.value;
  if (!cartId) return null;

  if (quantity <= 0) {
    return removeFromCart(cartId, [lineId]);
  }
  return updateCartLines(cartId, [{ id: lineId, quantity }]);
}

export async function removeLineAction(
  tenantSlug: string,
  lineId: string
): Promise<ShopifyCart | null> {
  const slug = assertTenantSlug(tenantSlug);
  const cookieStore = await cookies();
  const cartId = cookieStore.get(cartCookieName(slug))?.value;
  if (!cartId) return null;
  return removeFromCart(cartId, [lineId]);
}
