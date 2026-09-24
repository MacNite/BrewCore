import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import { requestBodyLimitMb } from "./src/lib/image-upload-limit";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // argon2 is a native module and must not be bundled into the server chunk.
  serverExternalPackages: ["argon2"],
  experimental: {
    /* Both request-body ceilings come from IMAGE_UPLOAD_MAX_MB (one bag photo
       plus framing), as in NutriCore, so they cannot disagree. Read at build
       time; a runtime change can only tighten per-file validation. */
    serverActions: { bodySizeLimit: `${requestBodyLimitMb()}mb` },
    middlewareClientMaxBodySize: `${requestBodyLimitMb()}mb`,
  },
  async headers() {
    return [
      {
        // The service worker must never be served stale, or an update to the
        // offline strategy would take a day to reach anyone.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default withNextIntl(config);
