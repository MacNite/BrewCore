import { notFound, redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";
import { NotFoundError } from "./errors";

/**
 * For signed-in pages: sends a visitor without a session to sign-in, a user
 * who owes a password change to that form, and a new user to onboarding.
 */
export async function requirePageUser(options: { allowNotOnboarded?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (!user.onboarded && !options.allowNotOnboarded) redirect("/onboarding");
  return user;
}

export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requirePageUser();
  if (user.role !== "ADMIN") notFound();
  return user;
}

/** Turns a NotFoundError (missing *or* someone else's record) into the 404 page. */
export async function orNotFound<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}
