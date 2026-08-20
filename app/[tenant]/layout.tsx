import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { getTenant } from "@/lib/tenants";
import CartProvider from "@/components/cart-provider";
import CartDrawer from "@/components/cart-drawer";

type TenantParams = Promise<{ tenant: string }>;

export async function generateMetadata({
  params,
}: {
  params: TenantParams;
}): Promise<Metadata> {
  const { tenant } = await params;
  const config = getTenant(tenant);
  if (!config) return {};
  return {
    title: config.name,
    robots: { index: false, follow: false },
  };
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: TenantParams;
}) {
  const { tenant } = await params;
  const config = getTenant(tenant);
  if (!config) notFound();

  const themeVars = {
    "--tenant-primary": config.theme.primary,
    "--tenant-accent": config.theme.accent,
    "--tenant-background": config.theme.background,
    "--tenant-foreground": config.theme.foreground,
    "--tenant-surface": config.theme.surface,
  } as CSSProperties;

  return (
    <div
      style={themeVars}
      className="min-h-screen bg-(--tenant-background) text-(--tenant-foreground)"
    >
      <CartProvider tenantSlug={tenant}>
        <header className="bg-(--tenant-primary) px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <p className="text-xl font-bold tracking-tight text-(--tenant-surface)">
              <span className="mr-2 inline-block h-3 w-3 rounded-full bg-(--tenant-accent)" />
              {config.name}
            </p>
            <CartDrawer />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </CartProvider>
    </div>
  );
}
