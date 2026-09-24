import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { assertSameOrigin, getSessionUser, type SessionUser } from "./session";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors";

/**
 * Shared plumbing for the few JSON route handlers.
 *
 * The brew sync endpoints are route handlers rather than Server Actions on
 * purpose (§55): the offline outbox retries them after a reconnect, possibly
 * after the app was redeployed, and a Server Action id from an older build
 * would no longer resolve. A plain URL stays valid across deployments.
 */
export async function withUser(
  handler: (user: SessionUser) => Promise<NextResponse>,
  options: { mutation?: boolean; limit?: keyof typeof RATE_LIMITS } = {},
): Promise<NextResponse> {
  try {
    if (options.mutation) await assertSameOrigin();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
    if (user.mustChangePassword) return NextResponse.json({ error: "passwordChangeRequired" }, { status: 403, headers: noStore });
    if (options.limit) {
      const { limit, windowMs } = RATE_LIMITS[options.limit];
      const result = rateLimit(`${options.limit}:${user.id}`, limit, windowMs);
      if (!result.allowed) {
        return NextResponse.json({ error: "rateLimited" }, { status: 429, headers: { ...noStore, "Retry-After": String(result.retryAfterSeconds) } });
      }
    }
    return await handler(user);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
    if (error instanceof NotFoundError) return NextResponse.json({ error: "notFound" }, { status: 404, headers: noStore });
    if (error instanceof ConflictError) return NextResponse.json({ error: error.reason }, { status: 409, headers: noStore });
    if (error instanceof ZodError) return NextResponse.json({ error: "validation" }, { status: 400, headers: noStore });
    logger.error("Route handler failed", { reason: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "server" }, { status: 500, headers: noStore });
  }
}

export const noStore = { "Cache-Control": "no-store" };

export async function readJson(request: Request, maxBytes = 256 * 1024): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new ZodError([]);
  try {
    return JSON.parse(text);
  } catch {
    throw new ZodError([]);
  }
}
