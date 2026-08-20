"use server";

import { cookies } from "next/headers";
import { getTeam } from "@/lib/teams";
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
 * 1. validates the team slug against lib/teams.ts (unknown slug -> throw),
 * 2. derives the cookie name `cart_${slug}` from that validated slug —
 *    never from anything else the client sent,
 * 3. scopes the cookie to Path=/{slug}, so the browser only presents it on
 *    that team's routes.
 * The cart ID itself never passes through the client (httpOnly).
 */
function assertTeamSlug(teamSlug: string): string {
  if (!getTeam(teamSlug)) {
    throw new Error("Unknown team");
  }
  return teamSlug;
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
  teamSlug: string
): Promise<ShopifyCart | null> {
  const slug = assertTeamSlug(teamSlug);
  const cookieStore = await cookies();
  const cartId = cookieStore.get(cartCookieName(slug))?.value;
  if (!cartId) return null;
  return getCart(cartId);
}

export async function addToCartAction(
  teamSlug: string,
  merchandiseId: string
): Promise<ShopifyCart> {
  const slug = assertTeamSlug(teamSlug);
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
  teamSlug: string,
  lineId: string,
  quantity: number
): Promise<ShopifyCart | null> {
  const slug = assertTeamSlug(teamSlug);
  const cookieStore = await cookies();
  const cartId = cookieStore.get(cartCookieName(slug))?.value;
  if (!cartId) return null;

  if (quantity <= 0) {
    return removeFromCart(cartId, [lineId]);
  }
  return updateCartLines(cartId, [{ id: lineId, quantity }]);
}

export async function removeLineAction(
  teamSlug: string,
  lineId: string
): Promise<ShopifyCart | null> {
  const slug = assertTeamSlug(teamSlug);
  const cookieStore = await cookies();
  const cartId = cookieStore.get(cartCookieName(slug))?.value;
  if (!cartId) return null;
  return removeFromCart(cartId, [lineId]);
}
