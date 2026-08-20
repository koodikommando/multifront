import { notFound } from "next/navigation";
import { getTenant, getTenantSlugs } from "@/lib/tenants";
import { getProductsByTag } from "@/lib/shopify";
import ProductGrid from "@/components/product-grid";

// Only slugs from generateStaticParams are valid routes; anything else 404s
// at the router before this code runs.
export const dynamicParams = false;
export const revalidate = 300;

export function generateStaticParams() {
  return getTenantSlugs().map((tenant) => ({ tenant }));
}

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const config = getTenant(tenant);
  if (!config) notFound();

  const products = await getProductsByTag(config.tag);

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold tracking-tight">
        Shop <span className="text-(--tenant-primary)">{config.name}</span>
      </h1>
      {products.length === 0 ? (
        <p className="opacity-70">No products available yet. Check back soon.</p>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
