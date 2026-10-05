/**
 * A minimal OpenID Connect provider for the end-to-end suite.
 *
 * It behaves like an authentik provider without a signing key: discovery, an
 * authorization endpoint that signs the person in at once, a token endpoint
 * that returns an HS256 ID token signed with the client secret, and an
 * end-session endpoint. Who signs in is set by the test through
 * `POST /__identity`; the suite runs with one worker, so there is one at a time.
 */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";

const port = Number(process.env.OIDC_MOCK_PORT ?? 3199);
const issuer = `http://127.0.0.1:${port}/`;
const clientId = process.env.OIDC_CLIENT_ID ?? "brewcore-e2e";
const secret = new TextEncoder().encode(process.env.OIDC_CLIENT_SECRET ?? "e2e-client-secret");

let identity = { sub: "nobody", email: "nobody@example.test", email_verified: true };
/** code -> { nonce, identity } */
const codes = new Map();

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", issuer);

  if (url.pathname === "/health") return json(res, 200, { ok: true });

  if (url.pathname === "/.well-known/openid-configuration")
    return json(res, 200, {
      issuer,
      authorization_endpoint: `${issuer}authorize`,
      token_endpoint: `${issuer}token`,
      jwks_uri: `${issuer}jwks`,
      end_session_endpoint: `${issuer}end-session`,
    });

  if (url.pathname === "/jwks") return json(res, 200, { keys: [] });

  if (url.pathname === "/__identity" && req.method === "POST") {
    identity = { email_verified: true, ...JSON.parse(await readBody(req)) };
    return json(res, 200, identity);
  }

  if (url.pathname === "/authorize") {
    const redirect = new URL(url.searchParams.get("redirect_uri") ?? "");
    const code = randomBytes(16).toString("hex");
    codes.set(code, { nonce: url.searchParams.get("nonce"), identity });
    redirect.searchParams.set("code", code);
    redirect.searchParams.set("state", url.searchParams.get("state") ?? "");
    res.writeHead(302, { location: redirect.toString() });
    return res.end();
  }

  if (url.pathname === "/token" && req.method === "POST") {
    const params = new URLSearchParams(await readBody(req));
    const grant = codes.get(params.get("code") ?? "");
    codes.delete(params.get("code") ?? "");
    if (!grant || !params.get("code_verifier")) return json(res, 400, { error: "invalid_grant" });
    const idToken = await new SignJWT({ nonce: grant.nonce, ...grant.identity })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setSubject(grant.identity.sub)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(secret);
    return json(res, 200, { id_token: idToken, access_token: "unused", token_type: "Bearer" });
  }

  if (url.pathname === "/end-session") {
    res.writeHead(302, { location: url.searchParams.get("post_logout_redirect_uri") ?? "/" });
    return res.end();
  }

  json(res, 404, { error: "not_found" });
}).listen(port, "127.0.0.1");
