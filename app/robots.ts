import type { MetadataRoute } from "next";

// No sitemap is generated anywhere in this app, and team pages additionally
// set robots noindex in their metadata: nothing should enumerate or surface
// the team storefronts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
