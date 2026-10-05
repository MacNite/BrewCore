import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { OIDC_FLOW_COOKIE, OIDC_FLOW_TTL_MS, authorizationUrl, createOidcFlow, encodeFlow, oidcConfig, oidcRedirectUri } from "@/lib/oidc";
import { securityCookieOptions } from "@/lib/auth";
import { discover } from "@/server/oidc";

/**
 * Starts a single sign-on: state, nonce and a PKCE verifier go into a
 * short-lived HTTP-only cookie, and the browser goes to the provider. A `next`
 * path rides along in the same cookie, as it does for password sign-in.
 */
export async function GET(request: NextRequest) {
  const { APP_URL } = env();
  const config = oidcConfig();
  if (!config) return NextResponse.redirect(new URL("/login", APP_URL));
  // A redirect, but never one a shared cache may answer for somebody else.
  const noStore = { "Cache-Control": "no-store" };

  let endpoint: string;
  try {
    endpoint = (await discover(config)).authorization_endpoint;
  } catch (error) {
    logger.warn("Single sign-on provider unreachable", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.redirect(new URL("/login?error=ssoUnavailable", APP_URL), { headers: noStore });
  }

  const flow = createOidcFlow(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(authorizationUrl(endpoint, config, flow, oidcRedirectUri(APP_URL)));
  for (const [name, value] of Object.entries(noStore)) response.headers.set(name, value);
  response.cookies.set(OIDC_FLOW_COOKIE, encodeFlow(flow), {
    ...securityCookieOptions(new Date(Date.now() + OIDC_FLOW_TTL_MS), APP_URL),
    path: "/api/auth/oidc",
  });
  return response;
}
