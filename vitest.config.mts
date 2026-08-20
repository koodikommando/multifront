import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the "@/*" alias from tsconfig.json so tests can import the
    // same way app code does.
    tsconfigPaths: true,
    alias: {
      // See test/server-only-shim.ts for why this is needed.
      "server-only": fileURLToPath(
        new URL("./test/server-only-shim.ts", import.meta.url)
      ),
    },
  },
  test: {
    // lib/cart-actions.ts and other server code run in Node, not a browser
    // DOM — no jsdom needed for unit/integration tests at this layer.
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
