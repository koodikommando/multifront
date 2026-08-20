"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import type { ShopifyCart } from "@/lib/shopify";
import {
  addToCartAction,
  getCartAction,
  removeLineAction,
  updateLineAction,
} from "@/lib/cart-actions";

type CartContextValue = {
  cart: ShopifyCart | null;
  pending: boolean;
  addLine: (merchandiseId: string) => void;
  updateLine: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}

export default function CartProvider({
  tenantSlug,
  children,
}: {
  tenantSlug: string;
  children: ReactNode;
}) {
  const [cart, setCart] = useState<ShopifyCart | null>(null);
  const [pending, startTransition] = useTransition();

  // Tenant pages are static (ISR), so the per-user cart hydrates client-side
  // via a Server Action instead of forcing the route dynamic with cookies().
  useEffect(() => {
    let cancelled = false;
    getCartAction(tenantSlug)
      .then((result) => {
        if (!cancelled) setCart(result);
      })
      .catch((error) => {
        console.error("Failed to load cart", error);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const addLine = (merchandiseId: string) => {
    startTransition(async () => {
      try {
        setCart(await addToCartAction(tenantSlug, merchandiseId));
      } catch (error) {
        console.error("Failed to add to cart", error);
      }
    });
  };

  const updateLine = (lineId: string, quantity: number) => {
    startTransition(async () => {
      try {
        setCart(await updateLineAction(tenantSlug, lineId, quantity));
      } catch (error) {
        console.error("Failed to update cart", error);
      }
    });
  };

  const removeLine = (lineId: string) => {
    startTransition(async () => {
      try {
        setCart(await removeLineAction(tenantSlug, lineId));
      } catch (error) {
        console.error("Failed to remove from cart", error);
      }
    });
  };

  return (
    <CartContext.Provider
      value={{ cart, pending, addLine, updateLine, removeLine }}
    >
      {children}
    </CartContext.Provider>
  );
}
