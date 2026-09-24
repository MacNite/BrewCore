import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getRecipeDetail } from "@/server/recipes";
import { archiveRecipeAction, duplicateRecipeAction } from "@/server/recipe-actions";
import { BrewRow, Empty, FavoriteButton, PageHead } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";
import { estimateDurationSeconds, type StepType } from "@/lib/brewing/recipe";
import { formatRatio, ratioOf } from "@/lib/brewing/ratio";
import { stepAdditions } from "@/lib/brewing/scaling";
import { formatSeconds } from "@/lib/brewing/timer";
import { formatGrams, formatNumber, formatTemperature, type AppLocale } from "@/lib/format";
import { safeHttpUrl } from "@/lib/url";
import { num } from "@/lib/decimal";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("recipes");
  const stepTypes = await getTranslations("stepTypes");
  const methods = await getTranslations("methods");
  const grinds = await getTranslations("grind");
  const locale = (await getLocale()) as AppLocale;
  const { recipe, recent, averageRating, ratedCount, isFavorite } = await orNotFound(getRecipeDetail(user.id, id, user.language));
  const own = recipe.ownerId === user.id;
  const dose = num(recipe.defaultCoffeeDoseG)!;
  const water = num(recipe.defaultWaterG)!;
  const steps = recipe.steps.map((step) => ({ ...step, waterTargetG: num(step.waterTargetG) }));
  const additions = stepAdditions(steps);
  const estimate = estimateDurationSeconds(steps, recipe.targetBrewTimeSeconds);
  const sourceUrl = safeHttpUrl(recipe.sourceUrl);
  const espresso = recipe.methodType === "ESPRESSO";
  const yieldG = num(recipe.targetYieldG);

  return (
    <>
      <PageHead
        title={recipe.name}
        subtitle={
          <>
            {methods(recipe.methodType)}
            {recipe.brewer ? ` · ${[recipe.brewer.manufacturer, recipe.brewer.model].filter(Boolean).join(" ")}` : ""} ·{" "}
            <span className={own ? "badge badge-accent" : "badge"}>{own ? t("mine") : t("bundled")}</span>
            {recipe.archivedAt ? <span className="badge"> {t("archived")}</span> : null}
          </>
        }
        actions={
          <>
            <Link className="btn btn-primary btn-large" href={`/brew/new?recipeId=${recipe.id}`}>
              {t("startBrew")}
            </Link>
            <FavoriteButton kind="recipe" id={recipe.id} active={isFavorite} />
            {own ? (
              <Link className="btn" href={`/recipes/${recipe.id}/edit`}>
                {t("edit")}
              </Link>
            ) : (
              <form action={duplicateRecipeAction} className="inline-form">
                <input type="hidden" name="id" value={recipe.id} />
                <input type="hidden" name="edit" value="true" />
                <button className="btn" type="submit">
                  {t("editCopy")}
                </button>
              </form>
            )}
            <form action={duplicateRecipeAction} className="inline-form">
              <input type="hidden" name="id" value={recipe.id} />
              <button className="btn" type="submit">
                {t("duplicate")}
              </button>
            </form>
          </>
        }
      />

      <div className="grid grid-2">
        <section className="card" aria-labelledby="params-heading">
          <h2 id="params-heading">{t("parameters")}</h2>
          <dl className="facts">
            <dt>{t("fields.dose")}</dt>
            <dd>{formatGrams(dose, locale)}</dd>
            <dt>{espresso ? t("fields.yield") : t("fields.water")}</dt>
            <dd>{formatGrams(espresso && yieldG ? yieldG : water, locale, 0)}</dd>
            <dt>{t("fields.ratio")}</dt>
            <dd>{formatRatio(ratioOf(espresso && yieldG ? yieldG : water, dose), locale === "de" ? "," : ".")}</dd>
            <dt>{t("fields.temperature")}</dt>
            <dd>{formatTemperature(num(recipe.waterTemperatureC), locale)}</dd>
            <dt>{t("fields.grind")}</dt>
            <dd>{recipe.grindDescription ? grinds(recipe.grindDescription) : "–"}</dd>
            <dt>{t("estimatedDuration")}</dt>
            <dd>{estimate !== null ? formatSeconds(estimate) : "–"}</dd>
            <dt>{t("averageRating")}</dt>
            <dd>{averageRating ? `${formatNumber(averageRating, locale, 1)} (${ratedCount})` : "–"}</dd>
          </dl>
          {recipe.description ? <p>{recipe.description}</p> : null}
          <p className="muted small">
            {t("source")}: {recipe.sourceName ?? t("sourceUnknown")}
            {recipe.authorName ? ` · ${recipe.authorName}` : ""}
            {sourceUrl ? (
              <>
                {" · "}
                <a href={sourceUrl} rel="noopener noreferrer nofollow" target="_blank">
                  {t("sourceLink")}
                </a>
              </>
            ) : null}
            {recipe.forkedFrom ? (
              <>
                {" · "}
                {t("forkedFrom")} <Link href={`/recipes/${recipe.forkedFrom.id}`}>{recipe.forkedFrom.name}</Link>
              </>
            ) : null}
          </p>
        </section>

        <section className="card" aria-labelledby="steps-heading">
          <h2 id="steps-heading">{t("steps")}</h2>
          <ol className="steps">
            {recipe.steps.map((step, index) => (
              <li key={step.id}>
                <div>
                  <strong>{stepTypes(step.type as StepType)}</strong>
                  <div>{step.instruction}</div>
                  <div className="muted small">
                    {[
                      step.waterTargetG !== null ? t("targetAdd", { target: formatGrams(num(step.waterTargetG), locale, 0), add: formatGrams(additions[index], locale, 0) }) : null,
                      step.durationSeconds !== null ? t("duration", { time: formatSeconds(step.durationSeconds) }) : null,
                      step.targetElapsedSeconds !== null
                        ? t("targetTime", {
                            time: step.targetElapsedMaxSeconds !== null ? `${formatSeconds(step.targetElapsedSeconds)}–${formatSeconds(step.targetElapsedMaxSeconds)}` : formatSeconds(step.targetElapsedSeconds),
                          })
                        : null,
                      step.autoAdvance ? t("auto") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="section" aria-labelledby="recent-heading">
        <h2 id="recent-heading">{t("recentBrews")}</h2>
        {recent.length === 0 ? (
          <Empty>{t("noBrews")}</Empty>
        ) : (
          <ul className="list">
            {recent.map((brew) => (
              <BrewRow key={brew.id} brew={brew} locale={locale} />
            ))}
          </ul>
        )}
      </section>

      {own ? (
        <section className="section">
          <form action={archiveRecipeAction}>
            <input type="hidden" name="id" value={recipe.id} />
            <input type="hidden" name="archived" value={recipe.archivedAt ? "false" : "true"} />
            {recipe.archivedAt ? (
              <button className="btn" type="submit">
                {t("unarchive")}
              </button>
            ) : (
              <ConfirmSubmit message={t("archiveConfirm")}>{t("archive")}</ConfirmSubmit>
            )}
          </form>
        </section>
      ) : null}
    </>
  );
}
