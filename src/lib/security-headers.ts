/**
 * Browser-side hardening headers, in one place, applied by the middleware.
 * Ported from NutriCore; the exceptions are the ones BrewCore actually needs:
 * the camera for a coffee-bag photo, inline style attributes, `blob:` previews
 * of a picked photo, and the service worker that keeps an active brew alive
 * offline.
 */

export interface HeaderOptions {
  nonce: string;
  /** Whether the deployment is served over HTTPS; gates HSTS. */
  https: boolean;
  /** `next dev` needs `unsafe-eval` for hot reloading; production must not have it. */
  development: boolean;
}

export function contentSecurityPolicy({ nonce, development }: HeaderOptions): string {
  return [
    "default-src 'self'",
    /* `strict-dynamic` lets the nonced Next bootstrap load the chunks it needs.
       `unsafe-eval` is dev-only. */
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used in the UI; styles cannot execute.
    "style-src 'self' 'unsafe-inline'",
    // `blob:` for the preview of a picked bag photo before it is uploaded.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    // The browser only ever talks to this origin.
    "connect-src 'self'",
    // The service worker (public/sw.js) is served from this origin.
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function securityHeaders(options: HeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": contentSecurityPolicy(options),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    /* Camera for the optional bag photo; the screen wake lock keeps the display
       on during a guided brew (§73). Everything else is denied. */
    "Permissions-Policy": [
      "camera=(self)",
      "screen-wake-lock=(self)",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "interest-cohort=()",
    ].join(", "),
    "X-Frame-Options": "DENY",
  };

  /* Only over HTTPS. HSTS from a plain-HTTP LAN deployment would teach the
     browser to refuse the only scheme that deployment speaks. */
  if (options.https) headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

  return headers;
}
