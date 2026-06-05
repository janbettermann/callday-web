import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  // Turbopack's filesystem cache for `next dev` on Windows misses
  // file-watcher events too often — CSS edits in particular get
  // served stale because the cached module replays even when
  // globals.css has changed. Disabling the dev FS cache trades a
  // little cold-start speed for reliable HMR on every edit.
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  // Allow HMR over the Cloudflare quick-tunnel domains so the dev
  // server pushes updates to the phone instead of the browser having
  // to hard-reload. trycloudflare.com is the public tunnel host
  // family; lhr.life is the localtunnel.me family. Add the wildcard
  // patterns so a regenerated tunnel URL keeps working without a
  // config change.
  //
  // Local-network IPs are also listed so a phone on the same Wi-Fi
  // can hit the dev server directly (e.g. http://192.168.2.124:3000)
  // without Next 16's stricter cross-origin guard blocking the HMR
  // websocket — which on the phone manifests as the page rendering
  // statically but never hydrating (no auto-rotate, dead buttons).
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.lhr.life",
    "192.168.*.*",
    "10.*.*.*",
  ],
};

export default withMDX(nextConfig);
