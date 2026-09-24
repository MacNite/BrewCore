"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { LiveBrew } from "@/server/brews";
import { brewElapsedMs, type LiveBrewState } from "@/lib/brewing/state-machine";
import { formatClock } from "@/lib/brewing/timer";
import { displayGrams } from "@/lib/brewing/scaling";
import { TASTE_TAGS, type TasteTag } from "@/lib/brewing/tasting";
import { enqueue, listOutbox } from "@/lib/offline/db";
import { flushOutbox } from "@/lib/offline/sync";
import { PwaRuntime } from "@/components/pwa-runtime";

/**
 * "How was it?" (§30, §91). Quick first: stars, would-brew-again, tags. The
 * tasting is queued like the completion, so it survives being offline; the
 * form may also be skipped entirely.
 */
export function PostBrew({ brew, state, onDone }: { brew: LiveBrew; state: LiveBrewState; onDone: () => Promise<void> | void }) {
  const t = useTranslations("postBrew");
  const tags = useTranslations("tasteTags");
  const locale = useLocale();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [again, setAgain] = useState<boolean | null>(null);
  const [chosen, setChosen] = useState<TasteTag[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [queued, setQueued] = useState(false);
  const sep = locale === "de" ? "," : ".";
  const elapsed = brewElapsedMs(state, state.finishedAt ?? Date.now());

  const leave = async (target: string) => {
    // Deliver what is queued first, so the detail page shows the finished brew.
    const result = await flushOutbox();
    const pending = (await listOutbox()).some((entry) => entry.brewId === brew.id);
    await onDone();
    if (result.stoppedBy === "offline" || pending) {
      setQueued(true);
      return;
    }
    router.push(target);
  };

  const save = async () => {
    setSaving(true);
    if (rating > 0) {
      await enqueue({
        kind: "tasting",
        brewId: brew.id,
        url: `/api/brews/${brew.id}/tasting`,
        body: { rating, wouldBrewAgain: again, tags: chosen, notes: notes.trim() || null },
      });
    }
    await leave(`/brews/${brew.id}`);
    setSaving(false);
  };

  if (queued) {
    return (
      <div className="live">
        <PwaRuntime />
        <main className="live-main post-brew" id="main">
          <h1>{t("savedOffline")}</h1>
          <p className="muted">{t("savedOfflineBody")}</p>
          <div className="form-actions" style={{ justifyContent: "center" }}>
            {/* A full navigation on purpose: offline, the service worker answers it from cache. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="btn btn-primary btn-large" href="/">
              {t("home")}
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="live">
      <main className="live-main post-brew" id="main" style={{ justifyContent: "flex-start" }}>
        <h1>{t("title")}</h1>
        <div className="big-time">{formatClock(elapsed)}</div>
        <p className="live-subtle">
          {[
            `${brew.coffeeDoseG.toFixed(1).replace(".", sep)} g → ${displayGrams(state.manualOverrides.waterActualG ?? brew.waterTargetG)} g`,
            brew.waterTemperatureC !== null ? `${brew.waterTemperatureC} °C` : null,
            brew.grindSettingText,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <fieldset className="stars" style={{ justifyContent: "center" }}>
          <legend className="live-step-label" style={{ width: "100%", textAlign: "center", marginBottom: 8 }}>
            {t("howWasIt")}
          </legend>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className={value <= rating ? "on" : undefined}>
              <input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} />
              <span aria-hidden="true">{value <= rating ? "★" : "☆"}</span>
              <span className="sr-only">{t("stars", { count: value })}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="chip-group" style={{ justifyContent: "center" }}>
          <legend className="sr-only">{t("wouldBrewAgain")}</legend>
          <span className="muted" style={{ width: "100%" }}>
            {t("wouldBrewAgain")}
          </span>
          {[
            [true, t("yes")],
            [false, t("no")],
          ].map(([value, label]) => (
            <label key={String(value)} className="chip">
              <input type="radio" name="again" checked={again === value} onChange={() => setAgain(value as boolean)} />
              <span>{label as string}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="chip-group" style={{ justifyContent: "center" }}>
          <legend className="sr-only">{t("tags")}</legend>
          {TASTE_TAGS.map((tag) => (
            <label key={tag} className="chip">
              <input
                type="checkbox"
                checked={chosen.includes(tag)}
                onChange={(e) => setChosen((list) => (e.target.checked ? [...list, tag] : list.filter((x) => x !== tag)))}
              />
              <span>{tags(tag)}</span>
            </label>
          ))}
        </fieldset>

        <div className="field" style={{ textAlign: "left" }}>
          <label htmlFor="tasting-notes">{t("notes")}</label>
          <textarea id="tasting-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
        </div>

        <div className="form-actions" style={{ justifyContent: "center" }}>
          <button type="button" className="btn btn-primary btn-large" onClick={() => void save()} disabled={saving}>
            {rating > 0 ? t("save") : t("skip")}
          </button>
          <Link className="btn btn-large" href={`/brew/new?fromBrewId=${brew.id}`} onClick={() => void onDone()}>
            {t("brewAgain")}
          </Link>
        </div>
      </main>
    </div>
  );
}
