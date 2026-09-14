import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // em desenvolvimento o service worker atrapalha mais do que ajuda
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // o sprite do mapa muscular é lido do disco em runtime
  outputFileTracingIncludes: {
    "/**": ["./assets/mapa-muscular/**"],
  },
};

export default withSerwist(nextConfig);
