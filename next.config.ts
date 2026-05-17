import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  // Vercel bundlet @sparticuz/chromium-Binaries (Brotli-Pack mit dem
  // headless_shell-Build) standardmaessig nicht in die Serverless-
  // Funktion, weil sie nicht via `require()` referenziert werden — die
  // Chromium-Library liest sie zur Runtime aus dem File-System. Explizit
  // includen, sonst wirft die `/api/share-card`-Route auf Vercel:
  //   "The input directory '/var/task/node_modules/@sparticuz/chromium/bin'
  //    does not exist."
  outputFileTracingIncludes: {
    "/api/share-card": ["./node_modules/@sparticuz/chromium/**"],
  },
};

export default withMDX(nextConfig);
