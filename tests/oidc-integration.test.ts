/**
 * Single sign-on account mapping against a real PostgreSQL: email on the first
 * sign-in, the provider's subject from then on (SPEC §46 decision).
 * Skipped automatically when TEST_DATABASE_URL is not configured.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;
if (url) process.env.DATABASE_URL = url;

describeDb("single sign-on account mapping against PostgreSQL", async () => {
  const { prisma } = await import("@/lib/db");
  const { SSO_ONLY_PASSWORD_HASH, oidcConfig } = await import("@/lib/oidc");
  const { OidcFlowError, accountFor } = await import("@/server/oidc");

  const stamp = `o${Date.now().toString(36)}`;
  const email = (name: string) => `${name}-${stamp}@example.test`;
  const config = oidcConfig({
    OIDC_ENABLED: "true",
    OIDC_ISSUER: "https://auth.example.test/application/o/brewcore/",
    OIDC_CLIENT_ID: "brewcore",
    OIDC_CLIENT_SECRET: "secret",
  })!;
  const identity = (name: string, extra: Partial<{ subject: string; email: string; emailVerified: boolean }> = {}) => ({
    subject: `sub-${name}-${stamp}`,
    email: email(name),
    emailVerified: true,
    preferredUsername: `${name}${stamp}`,
    name,
    idToken: "id.token",
    ...extra,
  });
  const failure = async (work: Promise<unknown>) => {
    const error = await work.then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(OidcFlowError);
    return (error as InstanceType<typeof OidcFlowError>).code;
  };

  const makeUser = (name: string, data: Record<string, unknown> = {}) =>
    prisma.user.create({
      data: { email: email(name), username: `${name}${stamp}`, passwordHash: "x", profile: { create: { displayName: name } }, ...data },
    });

  let admin: { id: string };

  beforeAll(async () => {
    admin = await makeUser("admin", { role: "ADMIN" });
  });

  afterAll(async () => {
    await prisma.userInvitation.deleteMany({ where: { email: { endsWith: `-${stamp}@example.test` } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `-${stamp}@example.test` } } });
    await prisma.$disconnect();
  });

  it("matches an existing account by email once and binds it to the subject", async () => {
    const alice = await makeUser("alice");
    const first = await accountFor(config, identity("alice"));
    expect(first.id).toBe(alice.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).oidcSubject).toBe(`sub-alice-${stamp}`);

    // The provider's email changes: the subject still finds the same account.
    const again = await accountFor(config, identity("alice", { email: email("alice-renamed") }));
    expect(again.id).toBe(alice.id);
  });

  it("never re-binds an account that is linked to another subject", async () => {
    await makeUser("bob", { oidcSubject: `sub-other-${stamp}` });
    expect(await failure(accountFor(config, identity("bob")))).toBe("ssoConflict");
  });

  it("refuses an email the provider has not verified, unless configured otherwise", async () => {
    const carol = await makeUser("carol");
    expect(await failure(accountFor(config, identity("carol", { emailVerified: false })))).toBe("ssoUnverified");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: carol.id } })).oidcSubject).toBeNull();

    const relaxed = { ...config, requireVerifiedEmail: false };
    expect((await accountFor(relaxed, identity("carol", { emailVerified: false }))).id).toBe(carol.id);
  });

  it("refuses a deactivated account", async () => {
    await makeUser("dave", { active: false });
    expect(await failure(accountFor(config, identity("dave")))).toBe("ssoInactive");
  });

  it("refuses an unknown email while automatic creation is off", async () => {
    expect(await failure(accountFor(config, identity("erin")))).toBe("ssoNoAccount");
    expect(await prisma.user.findUnique({ where: { email: email("erin") } })).toBeNull();
  });

  it("creates a password-less member when automatic creation is on", async () => {
    const created = await accountFor({ ...config, autoCreate: true }, identity("frank"));
    const user = await prisma.user.findUniqueOrThrow({ where: { id: created.id }, include: { profile: true } });
    expect(user).toMatchObject({ email: email("frank"), role: "USER", passwordHash: SSO_ONLY_PASSWORD_HASH, oidcSubject: `sub-frank-${stamp}` });
    expect(user.profile?.displayName).toBe("frank");
  });

  it("honours an open invitation with its role and uses it up", async () => {
    const invitation = await prisma.userInvitation.create({
      data: { email: email("grace"), name: "Grace", role: "ADMIN", tokenHash: `hash-${stamp}`, expiresAt: new Date(Date.now() + 60_000), invitedById: admin.id },
    });
    const created = await accountFor(config, identity("grace"));
    const user = await prisma.user.findUniqueOrThrow({ where: { id: created.id }, include: { profile: true } });
    expect(user.role).toBe("ADMIN");
    expect(user.profile?.displayName).toBe("Grace");
    expect((await prisma.userInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).acceptedAt).not.toBeNull();
  });
});
