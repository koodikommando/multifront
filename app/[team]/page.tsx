import { notFound } from "next/navigation";
import { getTeam, getTeamSlugs } from "@/lib/teams";
import { getProductsByTag } from "@/lib/shopify";
import ProductGrid from "@/components/product-grid";

// Only slugs from generateStaticParams are valid routes; anything else 404s
// at the router before this code runs.
export const dynamicParams = false;
export const revalidate = 300;

export function generateStaticParams() {
  return getTeamSlugs().map((team) => ({ team }));
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  const config = getTeam(team);
  if (!config) notFound();

  const products = await getProductsByTag(config.tag);

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold tracking-tight">
        Shop <span className="text-(--team-primary)">{config.name}</span>
      </h1>
      {products.length === 0 ? (
        <p className="opacity-70">No products available yet. Check back soon.</p>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
