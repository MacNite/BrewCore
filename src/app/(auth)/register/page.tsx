import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/server/session";
import { registrationAvailable } from "@/server/registration";
import { Brand } from "@/components/brand";
import { RegisterForm } from "./register-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signUp") };
}

export default async function RegisterPage() {
  if (await getSessionUser()) redirect("/");
  const t = await getTranslations("auth");
  // UX only. `registerAction` enforces the same policy for itself.
  const open = await registrationAvailable();

  return (
    <div className="auth-shell">
      <main className="auth-card" id="main">
        <Brand />
        <div className="card">
          <h1 style={{ fontSize: 21, margin: "0 0 4px" }}>{open ? t("signUpTitle") : t("signUpClosedTitle")}</h1>
          <p className="muted" style={{ margin: "0 0 18px", fontSize: 14 }}>
            {open ? t("signUpSubtitle") : t("signUpClosedSubtitle")}
          </p>
          {open ? <RegisterForm /> : null}
        </div>
        <p className="muted" style={{ textAlign: "center", marginTop: 16, fontSize: 14 }}>
          {t("haveAccount")} <Link href="/login">{t("signIn")}</Link>
        </p>
      </main>
    </div>
  );
}
