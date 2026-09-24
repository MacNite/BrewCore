import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate, formatGrams, formatRatioLocale, type AppLocale } from "@/lib/format";
import { formatSeconds } from "@/lib/brewing/timer";
import { num } from "@/lib/decimal";
import { toggleFavoriteAction } from "@/server/brew-actions";
import type { brewListSelect } from "@/server/coffees";
import type { Prisma } from "@prisma/client";

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Stars plus a text equivalent, so the rating is never colour- or glyph-only. */
export async function Rating({ value }: { value: number | null | undefined }) {
  const t = await getTranslations("tasting");
  if (!value) return <span className="muted">{t("unrated")}</span>;
  return (
    <span className="rating-display" title={t("ratingOf", { rating: value })}>
      <span aria-hidden="true">{"★".repeat(value)}{"☆".repeat(5 - value)}</span>
      <span className="sr-only">{t("ratingOf", { rating: value })}</span>
    </span>
  );
}

export async function FavoriteButton({ kind, id, active }: { kind: "coffee" | "recipe" | "brew"; id: string; active: boolean }) {
  const t = await getTranslations("common");
  return (
    <form action={toggleFavoriteAction} className="inline-form">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn" aria-pressed={active}>
        <span aria-hidden="true">{active ? "♥" : "♡"}</span> {active ? t("favorited") : t("favorite")}
      </button>
    </form>
  );
}

export type BrewRowData = Prisma.BrewGetPayload<{ select: typeof brewListSelect }>;

export async function BrewRow({ brew, locale }: { brew: BrewRowData; locale?: AppLocale }) {
  const t = await getTranslations("brews");
  const loc = locale ?? ((await getLocale()) as AppLocale);
  const dose = num(brew.coffeeDoseG);
  const water = num(brew.waterTargetG);
  return (
    <li>
      <Link className="list-item" href={brew.status === "IN_PROGRESS" ? `/brew/live/${brew.id}` : `/brews/${brew.id}`}>
        <div className="grow">
          <div className="title">
            {brew.coffeeNameSnapshot ?? t("noCoffee")} · {brew.recipeNameSnapshot}
          </div>
          <div className="meta">
            {formatDate(brew.completedAt ?? brew.createdAt, loc)} · {formatGrams(dose, loc)} → {formatGrams(water, loc, 0)} ·{" "}
            {formatRatioLocale(num(brew.ratio), loc)}
            {brew.grindSettingText ? ` · ${brew.grindSettingText}` : ""}
            {brew.actualDurationSeconds != null ? ` · ${formatSeconds(brew.actualDurationSeconds)}` : ""}
          </div>
        </div>
        {brew.status === "COMPLETED" ? (
          <Rating value={brew.tasting?.rating} />
        ) : (
          <span className={brew.status === "ABORTED" ? "badge badge-danger" : "badge badge-accent"}>{t(`status.${brew.status}`)}</span>
        )}
      </Link>
    </li>
  );
}

export function SearchForm({ q, label, placeholder, children }: { q: string; label: string; placeholder: string; children?: React.ReactNode }) {
  return (
    <form className="search-form" role="search" method="get">
      <label className="sr-only" htmlFor="q">
        {label}
      </label>
      <input id="q" name="q" type="search" defaultValue={q} placeholder={placeholder} />
      {children}
      <button className="btn" type="submit">
        {label}
      </button>
    </form>
  );
}
