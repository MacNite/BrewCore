import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { PageHead } from "@/components/ui";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PaletteToggle } from "@/components/palette-toggle";
import { PasswordForm, ProfileForm } from "./settings-forms";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const user = await requirePageUser();
  const t = await getTranslations("settings");

  return (
    <>
      <PageHead title={t("title")} subtitle={user.email} actions={<LogoutButton className="btn" />} />
      <div className="grid grid-2">
        <section className="card" aria-labelledby="profile-heading">
          <h2 id="profile-heading">{t("profile")}</h2>
          <ProfileForm values={{ displayName: user.displayName, language: user.language, cueSound: user.cueSound, cueVibration: user.cueVibration }} />
        </section>
        <div className="stack">
          <section className="card" aria-labelledby="theme-heading">
            <h2 id="theme-heading">{t("theme")}</h2>
            <ThemeToggle />
            <h3 id="palette-heading" style={{ marginTop: 16 }}>
              {t("palette")}
            </h3>
            <p className="muted small">{t("paletteHint")}</p>
            <PaletteToggle />
          </section>
          <section className="card" aria-labelledby="data-heading">
            <h2 id="data-heading">{t("data")}</h2>
            <p className="muted">{t("exportHint")}</p>
            <a className="btn" href="/api/export/json" download>
              {t("export")}
            </a>
          </section>
          <section className="card" aria-labelledby="password-heading">
            <h2 id="password-heading">{t("password")}</h2>
            <PasswordForm />
          </section>
          {user.role === "ADMIN" ? (
            <section className="card">
              <Link className="btn" href="/admin">
                {t("admin")}
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
