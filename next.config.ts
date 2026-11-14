import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const withMDX = createMDX();
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const localIpv4Hosts = Object.values(os.networkInterfaces())
  .flatMap((network) => network ?? [])
  .filter((details): details is NonNullable<typeof details> =>
    Boolean(details) &&
    details.family === "IPv4" &&
    !details.internal
  )
  .map((details) => details.address);

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Lets a second dev server (e.g. the ads-enabled e2e project) run alongside the main one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["localhost", "127.0.0.1", ...localIpv4Hosts],
  // The in-app changelog page was dropped; send old links to the repository.
  async redirects() {
    return [{ source: "/changelog", destination: "https://github.com/enginecv/enginecv", permanent: true }];
  },
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    // Dev only. The debug channel streams React debug info over the HMR socket,
    // keyed by the document's request id. Back/forward serves the document from
    // the HTTP cache with a request id the server has already finished, so the
    // channel never closes and the page never hydrates (stuck on skeletons).
    // Without it, the debug info is inlined in the RSC payload instead.
    reactDebugChannel: false,
  },
};

export default withMDX(nextConfig);
