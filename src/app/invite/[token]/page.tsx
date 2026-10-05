import { getTranslations } from "next-intl/server";
import { redeemableInvitation } from "@/server/admin";
import { acceptInvitationAction } from "@/server/admin-actions";
import { oidcConfig, passwordLoginEnabled } from "@/lib/oidc";
import { Brand } from "@/components/brand";

export async function generateMetadata() {
  const t = await getTranslations("account");
  return { title: t("inviteTitle") };
}

const ERRORS = ["rateLimited", "invalid", "weakPassword", "expired", "taken"] as const;

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const t = await getTranslations("account");
  const auth = await getTranslations("auth");
  const sso = oidcConfig();
  const passwords = passwordLoginEnabled();
  const invitation = await redeemableInvitation(token);
  const errorKey = ERRORS.find((key) => key === error);

  return (
    <div className="auth-shell">
      <main className="auth-card" id="main">
        <Brand />
        <div className="card">
          <h1>{t("inviteTitle")}</h1>
          {!invitation ? (
            <div className="notice notice-warn">{t("inviteInvalid")}</div>
          ) : (
            <>
              <p>{t(passwords ? "inviteIntro" : "inviteIntroSso", { email: invitation.email })}</p>
              {errorKey ? (
                <div className="notice notice-error" role="alert">
                  {t(`inviteErrors.${errorKey}`)}
                </div>
              ) : null}
              {sso ? (
                <>
                  {/* The invitation is honoured on the first single sign-on with its email. */}
                  <p>{t("inviteSso", { provider: sso.providerName, email: invitation.email })}</p>
                  <a href="/api/auth/oidc/login" className="btn btn-primary btn-block" style={{ marginBottom: 16 }}>
                    {auth("signInWith", { provider: sso.providerName })}
                  </a>
                  {passwords ? <p className="muted">{t("inviteOrPassword")}</p> : null}
                </>
              ) : null}
              {passwords ? (
                <form action={acceptInvitationAction}>
                  <input type="hidden" name="token" value={token} />
                  <div className="field">
                    <label htmlFor="displayName">{t("displayName")}</label>
                    <input id="displayName" name="displayName" defaultValue={invitation.name ?? ""} required maxLength={80} />
                  </div>
                  <div className="field">
                    <label htmlFor="username">{t("username")}</label>
                    <input id="username" name="username" minLength={3} maxLength={40} pattern="[a-zA-Z0-9._\-]+" required autoComplete="username" />
                  </div>
                  <div className="field">
                    <label htmlFor="password">{t("password")}</label>
                    <input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" />
                  </div>
                  <button className={sso ? "btn btn-block" : "btn btn-primary btn-block"}>{t("createAccount")}</button>
                </form>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
