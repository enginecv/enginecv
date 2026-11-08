import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Serve prerendered pages from Worker static assets instead of re-rendering
// them on request. Build-time-only routes (e.g. /changelog, which reads
// CHANGELOG.md from the filesystem during `next build`) cannot render inside
// the Workers runtime. Read-only cache: only valid while nothing uses ISR or
// revalidation.
const baseConfig = defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});

const cloudflareConfig = {
  ...baseConfig,
  buildCommand: "npm run build:cf-next",
};

export default cloudflareConfig;
