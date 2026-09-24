/**
 * Safe URL handling (§77).
 *
 * `safeNextPath` accepts only a same-origin path, so a crafted `?next=` can
 * never turn sign-in into an open redirect. `safeHttpUrl` accepts only http(s)
 * URLs for user-entered links (roaster website, recipe source), so a stored
 * `javascript:` URL can never be rendered as a link.
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(path)) return fallback;
  return path;
}

export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
