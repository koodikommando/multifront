import { describe, expect, it } from "vitest";
import { getTenant, getTenantSlugs } from "@/lib/tenants";

describe("getTenant", () => {
  it("returns the correct config for a known slug", () => {
    const config = getTenant("alpha");
    expect(config).not.toBeNull();
    expect(config?.name).toBe("alpha");
    expect(config?.tag).toBe("team:alpha");
  });

  it("returns a distinct config per known slug", () => {
    expect(getTenant("beta")?.tag).toBe("team:beta");
    expect(getTenant("omega")?.tag).toBe("team:omega");
  });

  it("returns null for an unknown slug", () => {
    expect(getTenant("does-not-exist")).toBeNull();
  });

  it("does not resolve inherited Object properties as slugs", () => {
    // Guards the hasOwnProperty check in getTenant: without it, slugs like
    // "toString" or "constructor" would incorrectly resolve via the
    // prototype chain instead of being rejected as unknown tenants.
    expect(getTenant("toString")).toBeNull();
    expect(getTenant("constructor")).toBeNull();
  });
});

describe("getTenantSlugs", () => {
  it("returns all registered slugs", () => {
    expect(getTenantSlugs().sort()).toEqual(["alpha", "beta", "omega"]);
  });
});

describe("tenant config shape", () => {
  it("gives every tenant the required fields", () => {
    for (const slug of getTenantSlugs()) {
      const config = getTenant(slug);
      expect(config).not.toBeNull();
      expect(typeof config?.name).toBe("string");
      expect(config?.name.length).toBeGreaterThan(0);
      expect(typeof config?.tag).toBe("string");
      expect(config?.tag.length).toBeGreaterThan(0);

      expect(config?.theme).toBeDefined();
      expect(typeof config?.theme.primary).toBe("string");
      expect(typeof config?.theme.accent).toBe("string");
      expect(typeof config?.theme.background).toBe("string");
      expect(typeof config?.theme.foreground).toBe("string");
      expect(typeof config?.theme.surface).toBe("string");
    }
  });
});
