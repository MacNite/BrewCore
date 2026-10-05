import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/server/session";
import { registrationAvailable } from "@/server/registration";
import { isOidcError, oidcConfig, passwordLoginEnabled } from "@/lib/oidc";
import { Brand } from "@/components/brand";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signIn") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; local?: string }> }) {
  if (await getSessionUser()) redirect("/");
  const t = await getTranslations("auth");
  const { next, error, local } = await searchParams;

  const sso = oidcConfig();
  const passwords = passwordLoginEnabled();
  /* `?local=1` is the administrators' break-glass when password sign-in is
     off: it shows the form, and `loginAction` accepts only administrators. It
     is deliberately not linked from anywhere. */
  const showPasswordForm = passwords || local === "1";
  const canRegister = passwords && (await registrationAvailable());
  const ssoError = isOidcError(error) || error === "ssoRateLimited" ? error : undefined;
  const ssoHref = next ? `/api/auth/oidc/login?${new URLSearchParams({ next })}` : "/api/auth/oidc/login";

  return (
    <div className="auth-shell">
      <main className="auth-card" id="main">
        <Brand />
        <div className="card">
          <h1 style={{ fontSize: 21, margin: "0 0 4px" }}>{t("signInTitle")}</h1>
          <p className="muted" style={{ margin: "0 0 18px", fontSize: 14 }}>
            {showPasswordForm || !sso ? t("signInSubtitle") : t("ssoOnlySubtitle", { provider: sso.providerName })}
          </p>

          {ssoError ? (
            <div className="notice notice-error" role="alert" style={{ marginBottom: 14 }}>
              <span className="notice-icon" aria-hidden="true">
                !
              </span>
              <span>{t(`errors.${ssoError}`)}</span>
            </div>
          ) : null}

          {sso ? (
            // A plain link, not a form: the route answers with a redirect to the provider.
            <a href={ssoHref} className={showPasswordForm ? "btn btn-block" : "btn btn-primary btn-block"}>
              {t("signInWith", { provider: sso.providerName })}
            </a>
          ) : null}

          {sso && showPasswordForm ? (
            <p className="muted" style={{ textAlign: "center", margin: "16px 0 12px", fontSize: 13 }}>
              {t("orPassword")}
            </p>
          ) : null}

          {showPasswordForm ? <LoginForm next={next} autoFocus={!sso} /> : null}
        </div>
        {canRegister ? (
          <p className="muted" style={{ textAlign: "center", marginTop: 16, fontSize: 14 }}>
            {t("noAccount")} <Link href="/register">{t("signUp")}</Link>
          </p>
        ) : null}
      </main>
    </div>
  );
}
