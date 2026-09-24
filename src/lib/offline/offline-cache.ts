/**
 * Makes the current page reloadable offline (§24). Called by the live brew
 * screen as soon as it opens: it stores this page's HTML and every static
 * chunk the page has loaded, in the caches the service worker serves from.
 *
 * Needed because the live screen is usually reached by a client-side
 * navigation (Start Brew redirects), which the service worker's navigation
 * handler never sees. Must match the cache names in public/sw.js.
 */
const VERSION = "v1";
export const STATIC_CACHE = `brewcore-static-${VERSION}`;
export const PAGE_CACHE = `brewcore-pages-${VERSION}`;

export async function warmOfflineCache(pageUrl = location.href) {
  if (typeof caches === "undefined") return;
  try {
    const pages = await caches.open(PAGE_CACHE);
    await pages.add(new Request(pageUrl, { credentials: "same-origin", cache: "no-store" }));

    const assets = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => {
        try {
          const url = new URL(name);
          return url.origin === location.origin && url.pathname.startsWith("/_next/static/");
        } catch {
          return false;
        }
      });
    const statics = await caches.open(STATIC_CACHE);
    await Promise.all(
      [...new Set(assets)].map(async (url) => {
        if (!(await statics.match(url))) await statics.add(url).catch(() => undefined);
      }),
    );
  } catch {
    /* Caching is an enhancement; the brew itself does not depend on it. */
  }
}

/** On sign-out: cached pages belong to the account that was signed in. */
export async function clearPageCache() {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(PAGE_CACHE);
  } catch {
    /* ignore */
  }
}
