import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/server/session";
import { changeRequiredPasswordAction } from "@/server/admin-actions";
import { Brand } from "@/components/brand";

export async function generateMetadata() {
  const t = await getTranslations("account");
  return { title: t("changePasswordTitle") };
}

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/");
  const t = await getTranslations("account");
  const { error } = await searchParams;

  return (
    <div className="auth-shell">
      <main className="auth-card" id="main">
        <Brand />
        <div className="card">
          <h1>{t("changePasswordTitle")}</h1>
          <p className="muted">{t("changePasswordIntro")}</p>
          {error ? (
            <div className="notice notice-warn" role="alert">
              {t("weakPassword")}
            </div>
          ) : null}
          <form action={changeRequiredPasswordAction}>
            <div className="field">
              <label htmlFor="password">{t("newPassword")}</label>
              <input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" />
            </div>
            <button className="btn btn-primary btn-block">{t("changePassword")}</button>
          </form>
        </div>
      </main>
    </div>
  );
}
