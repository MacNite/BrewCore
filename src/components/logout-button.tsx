"use client";

import { useTranslations } from "next-intl";
import { logoutAction } from "@/server/auth-actions";
import { clearPageCache } from "@/lib/offline/offline-cache";

/** Signs out and drops cached pages, which belong to this account. */
export function LogoutButton({ className = "btn btn-quiet" }: { className?: string }) {
  const t = useTranslations("nav");
  return (
    <form
      action={logoutAction}
      className="inline-form"
      onSubmit={() => {
        void clearPageCache();
        navigator.serviceWorker?.controller?.postMessage({ type: "clear-pages" });
      }}
    >
      <button className={className} type="submit">
        {t("signOut")}
      </button>
    </form>
  );
}
