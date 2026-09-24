import { z } from "zod";

/**
 * Who may create an account without an invitation (§47).
 *
 * `bootstrap` is the default: the very first account can be created from the
 * sign-up page and becomes the administrator; after that, new accounts need an
 * invitation link from an administrator. `open` allows public sign-up, and
 * `disabled` refuses self-registration outright, including the first account.
 *
 * `invite` is accepted as an alias for `bootstrap`. The spec lists it as a
 * fourth mode, but `bootstrap` already becomes invitation-only once the first
 * account exists, and a mode that closed registration before any administrator
 * existed would lock the operator out of a new instance (SPEC §47 decision).
 */
export const REGISTRATION_MODES = ["bootstrap", "open", "disabled"] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

/**
 * Read on its own rather than through `env()`, so the registration policy is
 * answerable without every other setting being valid. An unrecognised value
 * falls back to the safest mode rather than to the most permissive one.
 */
export function registrationMode(value = process.env.REGISTRATION_MODE): RegistrationMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "invite") return "bootstrap";
  return REGISTRATION_MODES.find((mode) => mode === normalized) ?? "bootstrap";
}

const schema = z.object({
  APP_URL: z.string().default("http://localhost:3000"),
  DEFAULT_LOCALE: z.enum(["de", "en"]).default("de"),
  REGISTRATION_MODE: z.string().optional().transform((value) => registrationMode(value)),
  INVITATION_EXPIRY_HOURS: z.coerce.number().positive().default(48),
  /**
   * How many reverse proxies sit in front of this deployment. 0 means
   * `X-Forwarded-For` is not trusted at all, which is correct for the default
   * Compose stack that publishes its own port.
   */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Parsed once per process. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests: forget the parsed configuration. */
export function resetEnvCache() {
  cached = undefined;
}

/**
 * Refuses to start a production deployment whose `APP_URL` is neither HTTPS nor
 * local.
 *
 * `Secure` on the session cookie is derived from `APP_URL`, which is the right
 * trade for a self-hosted instance on a plain-HTTP LAN - it has to be able to
 * sign in at all. The failure mode is a public HTTPS deployment whose `APP_URL`
 * was left at its `http://localhost:3000` default: everything works, and the
 * session cookie quietly loses `Secure` and travels wherever the browser is
 * willing to send it. Nothing anywhere said so.
 *
 * A loopback or private-range host is still allowed over plain HTTP, because
 * that is the deployment the trade-off exists for. `ALLOW_INSECURE_APP_URL=true`
 * is the escape hatch for anything else, e.g. TLS terminated by a sidecar that
 * the app cannot see.
 */
export function assertSecureDeployment(source: Record<string, string | undefined> = process.env) {
  if (source.NODE_ENV !== "production") return;
  if (source.ALLOW_INSECURE_APP_URL === "true") return;

  const raw = source.APP_URL ?? "http://localhost:3000";
  if (raw.startsWith("https://")) return;

  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    throw new Error(`APP_URL is not a valid URL: ${raw}`);
  }

  const local =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (local) return;

  throw new Error(
    `APP_URL is ${raw}, which is neither HTTPS nor a local address. The session cookie's Secure flag is derived ` +
      "from it, so this deployment would issue session cookies over plain HTTP to a public host. Set an https:// " +
      "APP_URL, or set ALLOW_INSECURE_APP_URL=true if TLS is terminated somewhere this application cannot see.",
  );
}

