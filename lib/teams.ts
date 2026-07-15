export type TeamTheme = {
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

export type TeamConfig = {
  /** Display name shown in the header and page title. */
  name: string;
  /** Shopify product tag for this team. The only place a tag may come from. */
  tag: string;
  theme: TeamTheme;
};

/**
 * Single source of truth for which storefronts exist.
 * Adding a team = adding an entry here (and tagging products in Shopify).
 *
 * Isolation: the Shopify tag used in product queries is always read from
 * this object, never derived from the URL, so an arbitrary slug can never
 * query an arbitrary tag.
 */
const teams = {
  alpha: {
    name: "Team Alpha",
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
    name: "Team Beta",
    tag: "team:beta",
    theme: {
      primary: "#b91c1c",
      accent: "#fbbf24",
      background: "#fffbf5",
      foreground: "#1c1917",
      surface: "#ffffff",
    },
  },
} as const satisfies Record<string, TeamConfig>;

export type TeamSlug = keyof typeof teams;

export function getTeam(slug: string): TeamConfig | null {
  if (Object.prototype.hasOwnProperty.call(teams, slug)) {
    return teams[slug as TeamSlug];
  }
  return null;
}

export function getTeamSlugs(): TeamSlug[] {
  return Object.keys(teams) as TeamSlug[];
}
