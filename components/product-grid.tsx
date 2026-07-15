import Image from "next/image";
import type { ShopifyProduct } from "@/lib/shopify";

function formatPrice(amount: string, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(Number(amount));
}

export default function ProductGrid({
  products,
}: {
  products: ShopifyProduct[];
}) {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <li
          key={product.id}
          className="overflow-hidden rounded-xl border border-black/10 bg-(--team-surface) shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="relative aspect-square bg-black/5">
            {product.featuredImage ? (
              <Image
                src={product.featuredImage.url}
                alt={product.featuredImage.altText ?? product.title}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm opacity-50">
                No image
              </div>
            )}
          </div>
          <div className="flex items-start justify-between gap-3 p-4">
            <h2 className="text-sm font-medium leading-snug">
              {product.title}
            </h2>
            <p className="shrink-0 rounded-full bg-(--team-primary) px-3 py-1 text-sm font-semibold text-(--team-surface)">
              {formatPrice(
                product.priceRange.minVariantPrice.amount,
                product.priceRange.minVariantPrice.currencyCode
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
