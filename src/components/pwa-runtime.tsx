"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { flushOutbox } from "@/lib/offline/sync";
import { listOutbox } from "@/lib/offline/db";

const RETRY_MS = 30_000;

/**
 * Registers the service worker and delivers the offline outbox: on load, when
 * the browser comes back online, when the tab becomes visible again, and every
 * 30 seconds while something is pending (§57). Shows a small offline/pending
 * badge; nothing here blocks the UI.
 */
export function PwaRuntime() {
  const t = useTranslations("pwa");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }

    let cancelled = false;
    const sync = async () => {
      if (!navigator.onLine) {
        setPending((await listOutbox()).length);
        return;
      }
      const result = await flushOutbox();
      if (!cancelled) setPending(result.remaining);
      if (result.delivered.length > 0) window.dispatchEvent(new CustomEvent("brewcore:synced", { detail: result }));
    };
    const update = () => {
      setOnline(navigator.onLine);
      void sync();
    };
    const visible = () => {
      if (document.visibilityState === "visible") void sync();
    };

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("brewcore:outbox", update);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(() => void sync(), RETRY_MS);
    return () => {
      cancelled = true;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("brewcore:outbox", update);
      document.removeEventListener("visibilitychange", visible);
      window.clearInterval(timer);
    };
  }, []);

  if (online && pending === 0) return null;
  return (
    <span className="offline-badge" role="status">
      {online ? t("pending", { count: pending }) : t("offline")}
    </span>
  );
}

/** Asks the runtime to deliver the outbox now (after something was queued). */
export const requestSync = () => window.dispatchEvent(new Event("brewcore:outbox"));
