"use client";

import { useState } from "react";
import Image from "next/image";
import { useCart } from "@/components/cart-provider";
import type { Money } from "@/lib/shopify";

function formatMoney({ amount, currencyCode }: Money): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(Number(amount));
}

export default function CartDrawer() {
  const { cart, pending, updateLine, removeLine } = useCart();
  const [open, setOpen] = useState(false);

  const count = cart?.totalQuantity ?? 0;
  const lines = cart?.lines.nodes ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative rounded-full bg-(--tenant-surface) px-4 py-2 text-sm font-semibold text-(--tenant-primary)"
        aria-label={`Open cart, ${count} items`}
      >
        Cart
        {count > 0 && (
          <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-(--tenant-accent) px-1 text-xs font-bold text-(--tenant-foreground)">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Cart">
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-(--tenant-surface) text-(--tenant-foreground) shadow-xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
              <h2 className="text-lg font-bold">Your cart</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-sm opacity-70 hover:opacity-100"
              >
                Close
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="flex-1 px-6 py-10 text-sm opacity-70">
                Your cart is empty.
              </p>
            ) : (
              <ul className="flex-1 divide-y divide-black/10 overflow-y-auto px-6">
                {lines.map((line) => (
                  <li key={line.id} className="flex gap-4 py-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-black/5">
                      {line.merchandise.product.featuredImage && (
                        <Image
                          src={line.merchandise.product.featuredImage.url}
                          alt={
                            line.merchandise.product.featuredImage.altText ??
                            line.merchandise.product.title
                          }
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <p className="text-sm font-medium leading-snug">
                        {line.merchandise.product.title}
                      </p>
                      {line.merchandise.title !== "Default Title" && (
                        <p className="text-xs opacity-60">
                          {line.merchandise.title}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            updateLine(line.id, line.quantity - 1)
                          }
                          className="h-7 w-7 rounded border border-black/15 text-sm disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="min-w-6 text-center text-sm">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            updateLine(line.id, line.quantity + 1)
                          }
                          className="h-7 w-7 rounded border border-black/15 text-sm disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => removeLine(line.id)}
                          className="ml-2 text-xs underline opacity-60 hover:opacity-100 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatMoney(line.cost.totalAmount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-black/10 px-6 py-4">
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="opacity-70">Subtotal</span>
                <span className="font-semibold">
                  {cart ? formatMoney(cart.cost.subtotalAmount) : "—"}
                </span>
              </div>
              {cart && lines.length > 0 ? (
                <a
                  href={cart.checkoutUrl}
                  className="block w-full rounded-lg bg-(--tenant-primary) px-4 py-3 text-center font-semibold text-(--tenant-surface)"
                >
                  Checkout
                </a>
              ) : (
                <span className="block w-full cursor-not-allowed rounded-lg bg-(--tenant-primary) px-4 py-3 text-center font-semibold text-(--tenant-surface) opacity-40">
                  Checkout
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
