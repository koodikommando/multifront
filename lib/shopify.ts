import "server-only";

const API_VERSION = "2026-01";

export class ShopifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopifyError";
  }
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type ShopifyFetchOptions = {
  query: string;
  variables?: Record<string, unknown>;
  /** Seconds to cache the response (ISR). */
  revalidate?: number;
  /**
   * "no-store" for per-user data (carts): caching these would leak one
   * visitor's data to another.
   */
  cache?: "no-store";
};

export async function shopifyFetch<T>({
  query,
  variables,
  revalidate = 300,
  cache,
}: ShopifyFetchOptions): Promise<T> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
  if (!domain || !token) {
    throw new ShopifyError(
      "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_TOKEN environment variable"
    );
  }

  const res = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Private token header; the public token would use
      // X-Shopify-Storefront-Access-Token instead.
      "Shopify-Storefront-Private-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    ...(cache === "no-store" ? { cache } : { next: { revalidate } }),
  });

  if (!res.ok) {
    throw new ShopifyError(
      `Storefront API request failed: ${res.status} ${res.statusText}`
    );
  }

  const json = (await res.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    throw new ShopifyError(
      `Storefront API errors: ${json.errors.map((e) => e.message).join("; ")}`
    );
  }
  if (!json.data) {
    throw new ShopifyError("Storefront API returned no data");
  }
  return json.data;
}

export type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  featuredImage: {
    url: string;
    altText: string | null;
    width: number;
    height: number;
  } | null;
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  variants: {
    nodes: Array<{
      id: string;
      availableForSale: boolean;
    }>;
  };
};

const TEAM_PRODUCTS_QUERY = /* GraphQL */ `
  query TeamProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query, sortKey: TITLE) {
      nodes {
        id
        title
        handle
        featuredImage {
          url
          altText
          width
          height
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        variants(first: 1) {
          nodes {
            id
            availableForSale
          }
        }
      }
    }
  }
`;

export async function getProductsByTag(
  tag: string,
  first = 24
): Promise<ShopifyProduct[]> {
  const data = await shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>({
    query: TEAM_PRODUCTS_QUERY,
    variables: { query: `tag:'${tag}'`, first },
  });
  return data.products.nodes;
}

// --- Cart -------------------------------------------------------------
// All cart operations use cache: "no-store" — carts are per-user.

export type Money = {
  amount: string;
  currencyCode: string;
};

export type ShopifyCartLine = {
  id: string;
  quantity: number;
  cost: {
    totalAmount: Money;
  };
  merchandise: {
    id: string;
    title: string;
    price: Money;
    product: {
      title: string;
      featuredImage: {
        url: string;
        altText: string | null;
        width: number;
        height: number;
      } | null;
    };
  };
};

export type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: Money;
  };
  lines: {
    nodes: ShopifyCartLine[];
  };
};

export type CartLineInput = {
  merchandiseId: string;
  quantity: number;
};

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
    }
    lines(first: 50) {
      nodes {
        id
        quantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              amount
              currencyCode
            }
            product {
              title
              featuredImage {
                url
                altText
                width
                height
              }
            }
          }
        }
      }
    }
  }
`;

type CartUserError = { field: string[] | null; message: string };

type CartMutationPayload = {
  cart: ShopifyCart | null;
  userErrors: CartUserError[];
};

function unwrapCartPayload(
  payload: CartMutationPayload,
  operation: string
): ShopifyCart {
  if (payload.userErrors.length > 0) {
    throw new ShopifyError(
      `${operation} failed: ${payload.userErrors.map((e) => e.message).join("; ")}`
    );
  }
  if (!payload.cart) {
    throw new ShopifyError(`${operation} returned no cart`);
  }
  return payload.cart;
}

export async function createCart(lines: CartLineInput[]): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartCreate: CartMutationPayload }>({
    query: /* GraphQL */ `
      mutation CartCreate($lines: [CartLineInput!]!) {
        cartCreate(input: { lines: $lines }) {
          cart {
            ...CartFields
          }
          userErrors {
            field
            message
          }
        }
      }
      ${CART_FRAGMENT}
    `,
    variables: { lines },
    cache: "no-store",
  });
  return unwrapCartPayload(data.cartCreate, "cartCreate");
}

export async function addToCart(
  cartId: string,
  lines: CartLineInput[]
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartLinesAdd: CartMutationPayload }>({
    query: /* GraphQL */ `
      mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            ...CartFields
          }
          userErrors {
            field
            message
          }
        }
      }
      ${CART_FRAGMENT}
    `,
    variables: { cartId, lines },
    cache: "no-store",
  });
  return unwrapCartPayload(data.cartLinesAdd, "cartLinesAdd");
}

export async function updateCartLines(
  cartId: string,
  lines: Array<{ id: string; quantity: number }>
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartLinesUpdate: CartMutationPayload }>({
    query: /* GraphQL */ `
      mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart {
            ...CartFields
          }
          userErrors {
            field
            message
          }
        }
      }
      ${CART_FRAGMENT}
    `,
    variables: { cartId, lines },
    cache: "no-store",
  });
  return unwrapCartPayload(data.cartLinesUpdate, "cartLinesUpdate");
}

export async function removeFromCart(
  cartId: string,
  lineIds: string[]
): Promise<ShopifyCart> {
  const data = await shopifyFetch<{ cartLinesRemove: CartMutationPayload }>({
    query: /* GraphQL */ `
      mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart {
            ...CartFields
          }
          userErrors {
            field
            message
          }
        }
      }
      ${CART_FRAGMENT}
    `,
    variables: { cartId, lineIds },
    cache: "no-store",
  });
  return unwrapCartPayload(data.cartLinesRemove, "cartLinesRemove");
}

export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  const data = await shopifyFetch<{ cart: ShopifyCart | null }>({
    query: /* GraphQL */ `
      query GetCart($cartId: ID!) {
        cart(id: $cartId) {
          ...CartFields
        }
      }
      ${CART_FRAGMENT}
    `,
    variables: { cartId },
    cache: "no-store",
  });
  return data.cart;
}
