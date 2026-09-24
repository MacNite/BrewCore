import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";

/** Static fallback the service worker serves for pages it has not cached. */
export const dynamic = "force-static";

export default async function OfflinePage() {
  const t = await getTranslations("pwa");
  return (
    <div className="auth-shell">
      <main className="auth-card card" id="main" style={{ textAlign: "center" }}>
        <Brand />
        <h1 style={{ fontSize: 21 }}>{t("offlineTitle")}</h1>
        <p className="muted">{t("offlineBody")}</p>
        <Link className="btn btn-primary" href="/">
          {t("retry")}
        </Link>
      </main>
    </div>
  );
}
