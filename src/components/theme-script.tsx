import { headers } from "next/headers";

/**
 * Applies the stored theme (light/dark/system) and colour palette before first
 * paint so a dark-mode user never sees a white flash and a Roast user never
 * sees the Classic colours blink. Kept tiny and inline; it runs before hydration.
 *
 * The nonce comes from the middleware, which mints one per response and names
 * it in the Content-Security-Policy. Without it this script is exactly what the
 * policy is there to stop - an inline one - and the browser would refuse to run
 * it, bringing the white flash back.
 */
export async function ThemeScript() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const script = `(function(){try{var d=document.documentElement;d.setAttribute("data-theme",localStorage.getItem("brewcore-theme")||"system");d.setAttribute("data-palette",localStorage.getItem("brewcore-palette")||"classic");}catch(e){}})();`;
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />;
}
