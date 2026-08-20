// The real `server-only` package throws unconditionally on import; it
// relies on Next's webpack/turbopack bundler to alias it to a no-op in
// server bundles and only leave the throw in place for client bundles.
// Vitest runs lib/shopify.ts directly in Node with neither bundler split,
// so vitest.config.mts aliases "server-only" to this empty module instead.
export {};
