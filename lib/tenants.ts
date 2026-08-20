export type TenantTheme = {
  /** Main brand color: header, buttons, price highlights. */
  primary: string;
  /** Secondary highlight color: badges, hover states. */
  accent: string;
  /** Page background. */
  background: string;
  /** Body text color. */
  foreground: string;
  /** Card surface color. */
  surface: string;
};

export type TenantConfig = {
  /** Display name shown in the header and page title. */
  name: string;
  /** Shopify product tag for this tenant. The only place a tag may come from. */
  tag: string;
  theme: TenantTheme;
};

/**
 * Single source of truth for which storefronts exist.
 * Adding a tenant = adding an entry here (and tagging products in Shopify).
 *
 * Isolation: the Shopify tag used in product queries is always read from
 * this object, never derived from the URL, so an arbitrary slug can never
 * query an arbitrary tag.
 */
const tenants = {
  alpha: {
    name: "alpha",
    tag: "team:alpha",
    theme: {
      primary: "#1d4ed8",
      accent: "#f59e0b",
      background: "#f8fafc",
      foreground: "#0f172a",
      surface: "#ffffff",
    },
  },
  beta: {
    name: "beta",
    tag: "team:beta",
    theme: {
      primary: "#b91c1c",
      accent: "#fbbf24",
      background: "#fffbf5",
      foreground: "#1c1917",
      surface: "#ffffff",
    },
  },
  omega: {
    name: "omega",
    tag: "team:omega",
    theme: {
      primary: "#0f766e",
      accent: "#34d399",
      background: "#f0fdfa",
      foreground: "#134e4a",
      surface: "#ffffff",
    },
  },
} as const satisfies Record<string, TenantConfig>;

export type TenantSlug = keyof typeof tenants;

export function getTenant(slug: string): TenantConfig | null {
  if (Object.prototype.hasOwnProperty.call(tenants, slug)) {
    return tenants[slug as TenantSlug];
  }
  return null;
}

export function getTenantSlugs(): TenantSlug[] {
  return Object.keys(tenants) as TenantSlug[];
}
