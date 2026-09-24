import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getCoffeeDetail } from "@/server/coffees";
import { archiveCoffeeAction } from "@/server/coffee-actions";
import { BrewRow, Empty, FavoriteButton, PageHead, Rating } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";
import { daysSince, formatDate, formatGrams, formatNumber, type AppLocale } from "@/lib/format";
import { num } from "@/lib/decimal";

export default async function CoffeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("coffees");
  const locale = (await getLocale()) as AppLocale;
  const { coffee, stats, recent, best, favoriteRecipe, lastGrind, isFavorite } = await orNotFound(getCoffeeDetail(user.id, id));
  const age = daysSince(coffee.roastDate);
  const remaining = num(coffee.remainingWeightG);
  const altitude =
    coffee.altitudeMinMasl !== null || coffee.altitudeMaxMasl !== null
      ? [coffee.altitudeMinMasl, coffee.altitudeMaxMasl].filter((v) => v !== null).join("–") + " m"
      : null;

  const facts: [string, React.ReactNode][] = [
    [t("fields.roaster"), coffee.roaster ? <Link href={`/roasters/${coffee.roaster.id}`}>{coffee.roaster.name}</Link> : coffee.roasterNameSnapshot],
    [t("fields.origin"), [coffee.country, coffee.region, coffee.farm].filter(Boolean).join(", ") || null],
    [t("fields.producer"), coffee.producer],
    [t("fields.varieties"), coffee.varieties.join(", ") || null],
    [t("fields.process"), coffee.process],
    [t("fields.altitude"), altitude],
    [t("fields.roastLevel"), t(`roastLevels.${coffee.roastLevel}`)],
    [t("fields.roastDate"), coffee.roastDate ? `${formatDate(coffee.roastDate, locale)} (${t("daysSinceRoast", { days: age ?? 0 })})` : null],
    [t("fields.remaining"), remaining !== null ? formatGrams(remaining, locale, 0) : null],
    [t("fields.tastingNotes"), coffee.roasterTastingNotes.join(", ") || null],
  ];

  return (
    <>
      <PageHead
        title={coffee.name}
        subtitle={coffee.archivedAt ? <span className="badge">{t("archived")}</span> : coffee.roasterNameSnapshot}
        actions={
          <>
            <Link className="btn btn-primary btn-large" href={`/brew/new?coffeeId=${coffee.id}`}>
              {t("brewThis")}
            </Link>
            <FavoriteButton kind="coffee" id={coffee.id} active={isFavorite} />
            <Link className="btn" href={`/coffees/${coffee.id}/edit`}>
              {t("edit")}
            </Link>
          </>
        }
      />

      <div className="grid grid-2">
        <section className="card" aria-labelledby="facts-heading">
          <h2 id="facts-heading">{t("details")}</h2>
          {coffee.imageUpdatedAt ? (
            // eslint-disable-next-line @next/next/no-img-element -- private, owner-only image route
            <img
              src={`/api/coffees/${coffee.id}/image?v=${coffee.imageUpdatedAt.getTime()}`}
              alt={t("photoAlt", { name: coffee.name })}
              style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 12, marginBottom: 12 }}
            />
          ) : null}
          <dl className="facts">
            {facts
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} style={{ display: "contents" }}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
          {coffee.notes ? <p style={{ whiteSpace: "pre-wrap" }}>{coffee.notes}</p> : null}
        </section>

        <section className="card" aria-labelledby="stats-heading">
          <h2 id="stats-heading">{t("brewing")}</h2>
          <div className="stat-row">
            <div className="stat">
              <div className="value">{stats.brewCount}</div>
              <div className="label">{t("stats.brews")}</div>
            </div>
            <div className="stat">
              <div className="value">{stats.averageRating ? formatNumber(stats.averageRating, locale, 1) : "–"}</div>
              <div className="label">{t("stats.averageRating")}</div>
            </div>
          </div>
          <dl className="facts" style={{ marginTop: 14 }}>
            <dt>{t("stats.favoriteRecipe")}</dt>
            <dd>{favoriteRecipe ? <Link href={`/recipes/${favoriteRecipe.id}`}>{favoriteRecipe.name}</Link> : "–"}</dd>
            <dt>{t("stats.lastGrind")}</dt>
            <dd>{lastGrind ? `${lastGrind.text}${lastGrind.grinder ? ` · ${lastGrind.grinder}` : ""}` : "–"}</dd>
          </dl>
          {best.length > 0 ? (
            <>
              <h3 style={{ marginTop: 16 }}>{t("bestBrews")}</h3>
              <ul className="list">
                {best.map((brew) => (
                  <li key={brew.id}>
                    <Link className="list-item" href={`/brews/${brew.id}`}>
                      <div className="grow">
                        <div className="title">{brew.recipeNameSnapshot}</div>
                        <div className="meta">{[brew.grindSettingText, formatDate(brew.completedAt, locale)].filter(Boolean).join(" · ")}</div>
                      </div>
                      <Rating value={brew.tasting?.rating} />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>

      <section className="section" aria-labelledby="recent-heading">
        <h2 id="recent-heading">{t("recentBrews")}</h2>
        {recent.length === 0 ? (
          <Empty action={<Link className="btn btn-primary" href={`/brew/new?coffeeId=${coffee.id}`}>{t("brewThis")}</Link>}>{t("noBrews")}</Empty>
        ) : (
          <ul className="list">
            {recent.map((brew) => (
              <BrewRow key={brew.id} brew={brew} locale={locale} />
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <form action={archiveCoffeeAction}>
          <input type="hidden" name="id" value={coffee.id} />
          <input type="hidden" name="archived" value={coffee.archivedAt ? "false" : "true"} />
          {coffee.archivedAt ? (
            <button className="btn" type="submit">
              {t("unarchive")}
            </button>
          ) : (
            <ConfirmSubmit message={t("archiveConfirm")}>{t("archive")}</ConfirmSubmit>
          )}
        </form>
      </section>
    </>
  );
}
