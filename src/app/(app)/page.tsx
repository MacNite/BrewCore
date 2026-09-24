import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { homeData } from "@/server/brews";
import { abortBrewAction } from "@/server/brew-actions";
import { BrewRow, Empty, PageHead } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";
import { LocalResumeBanner } from "@/components/local-resume-banner";
import { daysSince, formatDateTime, formatGrams, type AppLocale } from "@/lib/format";
import { num } from "@/lib/decimal";

export default async function HomePage() {
  const user = await requirePageUser();
  const t = await getTranslations("home");
  const locale = (await getLocale()) as AppLocale;
  const data = await homeData(user.id);

  return (
    <>
      <PageHead title={t("greeting", { name: user.displayName })} subtitle={t("question")} />

      <LocalResumeBanner serverActiveIds={data.active.map((brew) => brew.id)} />

      {data.active.length > 0 ? (
        <section className="section" aria-labelledby="active-heading">
          <h2 id="active-heading">{t("continueActive")}</h2>
          <ul className="list">
            {data.active.map((brew) => (
              <li key={brew.id} className="list-item">
                <div className="grow">
                  <div className="title">
                    {brew.coffeeNameSnapshot ?? t("noCoffee")} · {brew.recipeNameSnapshot}
                  </div>
                  <div className="meta">{t("startedAt", { time: formatDateTime(brew.createdAt, locale) })}</div>
                </div>
                <Link className="btn btn-primary" href={`/brew/live/${brew.id}`}>
                  {t("resume")}
                </Link>
                <form action={abortBrewAction} className="inline-form">
                  <input type="hidden" name="id" value={brew.id} />
                  <ConfirmSubmit message={t("abortConfirm")}>{t("abort")}</ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section card" aria-labelledby="quick-heading">
        <h2 id="quick-heading">{t("quickBrew")}</h2>
        {data.lastCompleted ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {t("lastBrew", {
                coffee: data.lastCompleted.coffeeNameSnapshot ?? t("noCoffee"),
                recipe: data.lastCompleted.recipeNameSnapshot,
              })}
            </p>
            <div className="form-actions">
              <Link className="btn btn-primary btn-large" href={`/brew/new?fromBrewId=${data.lastCompleted.id}`}>
                {t("brewAgain")}
              </Link>
              <Link className="btn btn-large" href="/brew/new">
                {t("newBrew")}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {t("firstBrewHint")}
            </p>
            <Link className="btn btn-primary btn-large" href="/brew/new">
              {t("startBrew")}
            </Link>
          </>
        )}
      </section>

      <div className="grid grid-2 section">
        <section aria-labelledby="coffees-heading">
          <div className="section-head">
            <h2 id="coffees-heading">{t("recentCoffees")}</h2>
            <Link href="/coffees">{t("all")}</Link>
          </div>
          {data.recentCoffees.length === 0 ? (
            <Empty action={<Link className="btn" href="/coffees/new">{t("addCoffee")}</Link>}>{t("noCoffees")}</Empty>
          ) : (
            <ul className="list">
              {data.recentCoffees.map((coffee) => {
                const age = daysSince(coffee.roastDate);
                const remaining = num(coffee.remainingWeightG);
                return (
                  <li key={coffee.id}>
                    <Link className="list-item" href={`/coffees/${coffee.id}`}>
                      <div className="grow">
                        <div className="title">{coffee.name}</div>
                        <div className="meta">
                          {[coffee.roasterNameSnapshot, age !== null ? t("daysSinceRoast", { days: age }) : null, remaining !== null ? t("remaining", { amount: formatGrams(remaining, locale, 0) }) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <span className="badge badge-accent">{t("brewThis")}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="favorites-heading">
          <div className="section-head">
            <h2 id="favorites-heading">{t("favoriteRecipes")}</h2>
            <Link href="/recipes">{t("all")}</Link>
          </div>
          {data.favoriteRecipes.length === 0 ? (
            <Empty action={<Link className="btn" href="/recipes">{t("browseRecipes")}</Link>}>{t("noFavorites")}</Empty>
          ) : (
            <ul className="list">
              {data.favoriteRecipes.map((recipe) => (
                <li key={recipe.id}>
                  <Link className="list-item" href={`/recipes/${recipe.id}`}>
                    <div className="grow">
                      <div className="title">{recipe.name}</div>
                    </div>
                    <span aria-hidden="true">♥</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="section" aria-labelledby="recent-heading">
        <div className="section-head">
          <h2 id="recent-heading">{t("recentBrews")}</h2>
          <Link href="/brews">{t("all")}</Link>
        </div>
        {data.recentBrews.length === 0 ? (
          <Empty>{t("noBrews")}</Empty>
        ) : (
          <ul className="list">
            {data.recentBrews.map((brew) => (
              <BrewRow key={brew.id} brew={brew} locale={locale} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
