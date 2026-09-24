import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { Brand } from "@/components/brand";
import { OnboardingForm } from "./onboarding-form";

export async function generateMetadata() {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

export default async function OnboardingPage() {
  const user = await requirePageUser({ allowNotOnboarded: true });
  if (user.onboarded) redirect("/");
  const t = await getTranslations("onboarding");

  return (
    <div className="auth-shell">
      <main className="auth-card" id="main" style={{ maxWidth: 520 }}>
        <Brand />
        <div className="card">
          <h1>{t("title")}</h1>
          <p className="muted">{t("subtitle")}</p>
          <OnboardingForm values={{ displayName: user.displayName, language: user.language, cueSound: user.cueSound, cueVibration: user.cueVibration }} />
        </div>
        <ol className="muted small" style={{ marginTop: 16 }}>
          <li>{t("nextCoffee")}</li>
          <li>{t("nextGrinder")}</li>
          <li>{t("nextBrew")}</li>
        </ol>
      </main>
    </div>
  );
}
