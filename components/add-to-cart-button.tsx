"use client";

import { useCart } from "@/components/cart-provider";

export default function AddToCartButton({
  merchandiseId,
  available,
}: {
  merchandiseId: string | undefined;
  available: boolean;
}) {
  const { addLine, pending } = useCart();
  const disabled = !merchandiseId || !available || pending;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => merchandiseId && addLine(merchandiseId)}
      className="w-full rounded-lg bg-(--team-primary) px-4 py-2 text-sm font-semibold text-(--team-surface) transition-opacity disabled:opacity-40"
    >
      {available ? "Add to cart" : "Sold out"}
    </button>
  );
}
