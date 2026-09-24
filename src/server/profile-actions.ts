"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth";
import { LOCALES } from "@/i18n/locales";
import { requireUser } from "./session";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
}

const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  language: z.enum(LOCALES),
  cueSound: checkbox,
  cueVibration: checkbox,
});

async function saveProfile(userId: string, formData: FormData, extra: { onboardedAt?: Date } = {}) {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    language: formData.get("language"),
    cueSound: formData.get("cueSound"),
    cueVibration: formData.get("cueVibration"),
  });
  if (!parsed.success) return null;
  await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, ...parsed.data, ...extra },
    update: { ...parsed.data, ...extra },
  });
  // Signed-out pages (and the next sign-in form) follow the chosen language.
  (await cookies()).set("NEXT_LOCALE", parsed.data.language, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return parsed.data;
}

export async function completeOnboardingAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const saved = await saveProfile(user.id, formData, { onboardedAt: new Date() });
  if (!saved) return { error: "validation" };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfileAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const saved = await saveProfile(user.id, formData);
  if (!saved) return { error: "validation" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePasswordAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  if (next.length > 200) return { error: "validation" };
  const problem = passwordProblem(next);
  if (problem === "too-short") return { error: "tooShort" };
  if (problem === "too-common") return { error: "tooCommon" };

  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(account.passwordHash, current))) return { error: "wrongPassword" };

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: true };
}
