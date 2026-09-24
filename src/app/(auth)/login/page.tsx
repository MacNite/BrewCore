import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/server/session";
import { registrationAvailable } from "@/server/registration";
import { Brand } from "@/components/brand";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signIn") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSessionUser()) redirect("/");
  const t = await getTranslations("auth");
  const { next } = await searchParams;
  const canRegister = await registrationAvailable();

  return (
    <div className="auth-shell">
      <main className="auth-card" id="main">
        <Brand />
        <div className="card">
          <h1 style={{ fontSize: 21, margin: "0 0 4px" }}>{t("signInTitle")}</h1>
          <p className="muted" style={{ margin: "0 0 18px", fontSize: 14 }}>
            {t("signInSubtitle")}
          </p>
          <LoginForm next={next} />
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
