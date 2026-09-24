"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { hashPassword, passwordProblem, PASSWORD_CHANGE_COOKIE } from "@/lib/auth";
import { clientAddress } from "@/lib/client-address";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { requireAdmin, requireUser, startSession } from "./session";
import { durableRateLimitOrFallback } from "./durable-rate-limit";
import { issueInvitation, redeemableInvitation } from "./admin";

export async function inviteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().pipe(z.email()),
      name: z.string().trim().max(80).optional(),
      role: z.enum(["USER", "ADMIN"]).default("USER"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin?error=invalid");

  const { invitation, token } = await issueInvitation({ ...parsed.data, invitedById: admin.id });
  logger.info("Invitation issued", { invitationId: invitation.id, role: invitation.role, by: admin.id });
  // The token travels back once so the administrator can copy the link; it is
  // never stored in plain text.
  redirect(`/admin?token=${encodeURIComponent(token)}`);
}

export async function revokeInvitationAction(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).parse(formData.get("invitationId"));
  await prisma.userInvitation.updateMany({ where: { id, acceptedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/admin");
}

const userTarget = z.object({ userId: z.string().min(1) });

export async function setUserActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const { userId } = userTarget.parse(Object.fromEntries(formData));
  // An administrator deactivating themselves would lock the instance.
  if (userId === admin.id) redirect("/admin?error=self");
  const active = formData.get("active") === "true";
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { active } }),
    ...(active ? [] : [prisma.session.deleteMany({ where: { userId } })]),
  ]);
  logger.info("User active state changed", { userId, active, by: admin.id });
  revalidatePath("/admin");
}

export async function setUserRoleAction(formData: FormData) {
  const admin = await requireAdmin();
  const { userId } = userTarget.parse(Object.fromEntries(formData));
  if (userId === admin.id) redirect("/admin?error=self");
  const role = z.enum(["USER", "ADMIN"]).parse(formData.get("role"));
  await prisma.user.update({ where: { id: userId }, data: { role } });
  logger.info("User role changed", { userId, role, by: admin.id });
  revalidatePath("/admin");
}

/**
 * Sets a temporary password the user must replace on their next sign-in. The
 * password is shown once to the administrator and never stored in plain text.
 */
export async function resetUserPasswordAction(formData: FormData) {
  const admin = await requireAdmin();
  const { userId } = userTarget.parse(Object.fromEntries(formData));
  const temporary = randomBytes(12).toString("base64url");
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(temporary), mustChangePassword: true } }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  logger.info("Temporary password issued", { userId, by: admin.id });
  redirect(`/admin?temporary=${encodeURIComponent(temporary)}&for=${encodeURIComponent(userId)}`);
}

export async function acceptInvitationAction(formData: FormData) {
  const address = clientAddress(await headers(), env().TRUSTED_PROXY_HOPS);
  const key = `invite-accept:${address}`;
  const limit = await durableRateLimitOrFallback(
    key,
    RATE_LIMITS.inviteAccept.limit,
    RATE_LIMITS.inviteAccept.windowMs,
    rateLimit(key, RATE_LIMITS.inviteAccept.limit, RATE_LIMITS.inviteAccept.windowMs),
  );
  const token = String(formData.get("token") ?? "");
  const back = (error: string) => redirect(`/invite/${encodeURIComponent(token)}?error=${error}`);
  if (!limit.allowed) back("rateLimited");

  const parsed = z
    .object({
      username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
      displayName: z.string().trim().min(1).max(80),
      password: z.string().min(1).max(200),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("invalid");
  const data = parsed.data!;
  if (passwordProblem(data.password)) back("weakPassword");

  const invitation = await redeemableInvitation(token);
  if (!invitation) back("expired");
  const passwordHash = await hashPassword(data.password);

  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      // Accepting marks the invitation first, so two concurrent submissions of
      // one link cannot both create an account.
      const claimed = await tx.userInvitation.updateMany({
        where: { id: invitation!.id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("invitation-claimed");
      const user = await tx.user.create({
        data: {
          email: invitation!.email,
          username: data.username,
          passwordHash,
          role: invitation!.role,
          profile: { create: { displayName: data.displayName } },
        },
        select: { id: true },
      });
      return user.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") back("taken");
    if (error instanceof Error && error.message === "invitation-claimed") back("expired");
    throw error;
  }

  await startSession(userId);
  redirect("/onboarding");
}

export async function changeRequiredPasswordAction(formData: FormData) {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  if (password.length > 200 || passwordProblem(password)) redirect("/change-password?error=weak");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: false } });
  (await cookies()).delete(PASSWORD_CHANGE_COOKIE);
  redirect(user.onboarded ? "/" : "/onboarding");
}
