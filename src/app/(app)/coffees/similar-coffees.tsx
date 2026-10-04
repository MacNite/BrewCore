"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { similarCoffeesAction } from "@/server/coffee-actions";
import type { SimilarCoffee } from "@/server/shared-coffees";

/**
 * While a new coffee is typed, the shared coffees it may already be (§7), so
 * the member adds a bag of that one instead of a second entry. Advisory only:
 * saving is never blocked.
 */
export function SimilarCoffees({ name, roasterName }: { name: string; roasterName: string }) {
  const t = useTranslations("coffees");
  const [matches, setMatches] = useState<SimilarCoffee[]>([]);

  useEffect(() => {
    if (name.trim().length < 3) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      similarCoffeesAction({ name, roasterName })
        .then((result) => {
          if (!cancelled) setMatches(result);
        })
        // Offline or a failed lookup: no suggestions, the form still works.
        .catch(() => {
          if (!cancelled) setMatches([]);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, roasterName]);

  return (
    <div aria-live="polite">
      {matches.length > 0 ? (
        <div className="notice notice-warn">
          <div className="grow">
            <strong>{t("similar.title")}</strong>
            <p className="small" style={{ margin: "4px 0 8px" }}>
              {t("similar.hint")}
            </p>
            <ul className="list">
              {matches.map((match) => (
                <li key={match.id} className="list-item">
                  <div className="grow">
                    <div className="title">{match.name}</div>
                    <div className="meta">{[match.roaster, match.country].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Link className="btn" href={`/coffees/new?shared=${match.id}`}>
                    {t("similar.use")}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
