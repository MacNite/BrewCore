/*
 * BrewCore service worker (§24, Phase 6). Hand-written and deliberately small.
 *
 * Goal: an active brew keeps working when the network drops, including after a
 * reload. Not a goal: full offline use of every screen.
 *
 *  - /_next/static/*   cache-first (content-hashed, immutable)
 *  - icons, manifest   stale-while-revalidate
 *  - page navigations  network-first; a successful response for the home
 *                      screen or a live brew is kept, and served when offline;
 *                      anything else falls back to /offline
 *  - /api/*            never cached (sync endpoints, export, images)
 *
 * The live brew page also warms these caches itself (see offline-cache.ts),
 * because a page reached by client-side navigation never passes through the
 * navigation handler below.
 */
const VERSION = "v1";
const STATIC_CACHE = `brewcore-static-${VERSION}`;
const PAGE_CACHE = `brewcore-pages-${VERSION}`;
const PRECACHE = ["/offline", "/manifest.webmanifest", "/icon.svg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("brewcore-") && key !== STATIC_CACHE && key !== PAGE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // Sent on sign-out: cached pages belong to the account that was signed in.
  if (event.data && event.data.type === "clear-pages") event.waitUntil(caches.delete(PAGE_CACHE));
});

const isLivePage = (url) => url.pathname === "/" || url.pathname.startsWith("/brew/live/");

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok && !response.redirected && isLivePage(url)) {
            const cache = await caches.open(PAGE_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cached = await caches.match(request, { ignoreSearch: false });
          if (cached) return cached;
          const offline = await caches.match("/offline");
          return offline || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })(),
    );
    return;
  }

  if (/\.(png|svg|ico|webmanifest)$/.test(url.pathname) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
  }
});
