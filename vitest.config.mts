import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json sets "jsx": "preserve" (Next's own compiler handles the
  // actual transform). Vite's default transformer (oxc) needs its own JSX
  // setting to import .tsx route/component files directly, since nothing
  // else transforms them here.
  oxc: {
    jsx: "automatic",
  },
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
