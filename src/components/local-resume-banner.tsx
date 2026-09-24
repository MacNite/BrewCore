"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { listLocalBrews, type LocalLiveBrew } from "@/lib/offline/db";
import { isTerminal } from "@/lib/brewing/state-machine";

/**
 * "Resume Brew?" (§23): an unfinished brew kept in this browser, offered even
 * when the server list does not show it yet (e.g. it was finished offline and
 * is waiting in the outbox, or the page was opened offline).
 */
export function LocalResumeBanner({ serverActiveIds }: { serverActiveIds: string[] }) {
  const t = useTranslations("home");
  const [local, setLocal] = useState<LocalLiveBrew[]>([]);

  useEffect(() => {
    listLocalBrews().then((rows) => setLocal(rows.filter((row) => !isTerminal(row.state))));
  }, []);

  const running = local.filter((row) => row.state.status !== "READY" || serverActiveIds.includes(row.brewId));
  if (running.length === 0) return null;

  return (
    <div className="notice notice-success" role="status">
      <span className="notice-icon" aria-hidden="true">
        ▶
      </span>
      <div style={{ flex: 1 }}>
        <strong>{t("resumeLocalTitle")}</strong>
        <ul className="list" style={{ marginTop: 8 }}>
          {running.map((row) => (
            <li key={row.brewId}>
              <Link className="btn btn-primary" href={`/brew/live/${row.brewId}`}>
                {t("resumeLocal", { recipe: String(row.context.recipeName ?? "") })}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
