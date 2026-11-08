import type { MetadataRoute } from "next";
import { CRAWL_DISALLOWED_PARAMS, CRAWL_DISALLOWED_PATHS, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [...CRAWL_DISALLOWED_PATHS, ...CRAWL_DISALLOWED_PARAMS],
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
