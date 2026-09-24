import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getBrewDetail } from "@/server/brews";
import { deleteBrewAction } from "@/server/brew-actions";
import { PageHead, Rating } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";
import { formatDate, formatDateTime, formatGrams, formatRatioLocale, formatTemperature, type AppLocale } from "@/lib/format";
import { formatSeconds } from "@/lib/brewing/timer";
import { TASTE_ATTRIBUTES, type TasteTag } from "@/lib/brewing/tasting";
import type { StepType } from "@/lib/brewing/recipe";
import { num } from "@/lib/decimal";

export default async function BrewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("brews");
  const tasting = await getTranslations("tasting");
  const tags = await getTranslations("tasteTags");
  const stepTypes = await getTranslations("stepTypes");
  const locale = (await getLocale()) as AppLocale;
  const { brew, snapshot } = await orNotFound(getBrewDetail(user.id, id));
  const roastAge =
    brew.roastDateSnapshot && brew.startedAt ? Math.floor((brew.startedAt.getTime() - brew.roastDateSnapshot.getTime()) / 86_400_000) : null;

  // "What actually happened?" (§93): every value comes from the brew itself.
  const facts: [string, React.ReactNode][] = [
    [t("coffee"), brew.coffee && !brew.coffee.archivedAt ? <Link href={`/coffees/${brew.coffee.id}`}>{brew.coffeeNameSnapshot}</Link> : brew.coffeeNameSnapshot],
    [t("roaster"), brew.roasterSnapshot],
    [t("roastAge"), roastAge !== null ? t("daysOld", { days: roastAge, date: formatDate(brew.roastDateSnapshot, locale) }) : null],
    [t("recipe"), brew.recipe ? <Link href={`/recipes/${brew.recipe.id}`}>{brew.recipeNameSnapshot}</Link> : brew.recipeNameSnapshot],
    [t("brewer"), brew.brewerSnapshot],
    [t("dose"), formatGrams(num(brew.coffeeDoseG), locale)],
    [t("water"), formatGrams(num(brew.waterTargetG), locale, 0)],
    [t("waterActual"), brew.waterActualG ? formatGrams(num(brew.waterActualG), locale, 0) : null],
    [t("beverageWeight"), brew.beverageWeightG ? formatGrams(num(brew.beverageWeightG), locale) : null],
    [t("ratio"), formatRatioLocale(num(brew.ratio), locale)],
    [t("temperature"), formatTemperature(num(brew.waterTemperatureC), locale)],
    [t("grinder"), brew.grinderSnapshot],
    [t("grindSetting"), brew.grindSettingText],
    [t("time"), brew.actualDurationSeconds !== null ? `${formatSeconds(brew.actualDurationSeconds)}${brew.targetDurationSeconds ? ` (${t("target")} ${formatSeconds(brew.targetDurationSeconds)})` : ""}` : null],
    [t("started"), brew.startedAt ? formatDateTime(brew.startedAt, locale) : formatDateTime(brew.createdAt, locale)],
  ];

  return (
    <>
      <PageHead
        title={`${brew.coffeeNameSnapshot ?? t("noCoffee")} · ${brew.recipeNameSnapshot}`}
        subtitle={<span className={brew.status === "COMPLETED" ? "badge badge-accent" : brew.status === "ABORTED" ? "badge badge-danger" : "badge"}>{t(`status.${brew.status}`)}</span>}
        actions={
          <>
            {brew.status === "IN_PROGRESS" ? (
              <Link className="btn btn-primary btn-large" href={`/brew/live/${brew.id}`}>
                {t("resume")}
              </Link>
            ) : (
              <Link className="btn btn-primary btn-large" href={`/brew/new?fromBrewId=${brew.id}`}>
                {t("brewAgain")}
              </Link>
            )}
            {brew.status === "COMPLETED" ? (
              <Link className="btn" href={`/brews/${brew.id}/taste`}>
                {brew.tasting ? t("editTasting") : t("rate")}
              </Link>
            ) : null}
          </>
        }
      />

      {brew.parentBrew ? (
        <p className="notice">
          {t("brewedAgainFrom")}{" "}
          <Link href={`/brews/${brew.parentBrew.id}`}>
            {brew.parentBrew.recipeNameSnapshot} · {formatDate(brew.parentBrew.createdAt, locale)}
          </Link>
        </p>
      ) : null}

      <div className="grid grid-2">
        <section className="card" aria-labelledby="facts-heading">
          <h2 id="facts-heading">{t("whatHappened")}</h2>
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
          {brew.notes ? <p style={{ whiteSpace: "pre-wrap" }}>{brew.notes}</p> : null}
        </section>

        <section className="card" aria-labelledby="tasting-heading">
          <h2 id="tasting-heading">{tasting("title")}</h2>
          {brew.tasting ? (
            <>
              <p style={{ fontSize: "1.4rem", margin: "0 0 8px" }}>
                <Rating value={brew.tasting.rating} />
              </p>
              {brew.tasting.wouldBrewAgain !== null ? <p>{brew.tasting.wouldBrewAgain ? tasting("againYes") : tasting("againNo")}</p> : null}
              {brew.tasting.tags.length ? (
                <div className="tags">
                  {brew.tasting.tags.map((tag) => (
                    <span key={tag} className="badge badge-accent">
                      {tags(tag as TasteTag)}
                    </span>
                  ))}
                </div>
              ) : null}
              <dl className="facts" style={{ marginTop: 12 }}>
                {TASTE_ATTRIBUTES.filter((attr) => brew.tasting![attr] !== null).map((attr) => (
                  <div key={attr} style={{ display: "contents" }}>
                    <dt>{tasting(`attributes.${attr}`)}</dt>
                    <dd>{brew.tasting![attr]} / 5</dd>
                  </div>
                ))}
              </dl>
              {brew.tasting.notes ? <p style={{ whiteSpace: "pre-wrap" }}>{brew.tasting.notes}</p> : null}
            </>
          ) : (
            <p className="muted">{brew.status === "COMPLETED" ? tasting("none") : tasting("onlyCompleted")}</p>
          )}
        </section>
      </div>

      <section className="section card" aria-labelledby="steps-heading">
        <h2 id="steps-heading">{t("steps")}</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t("step")}</th>
                <th scope="col">{t("targetWeight")}</th>
                <th scope="col">{t("targetDuration")}</th>
                <th scope="col">{t("actualDuration")}</th>
                <th scope="col">{t("result")}</th>
              </tr>
            </thead>
            <tbody>
              {brew.stepResults.length > 0
                ? brew.stepResults.map((step, index) => (
                    <tr key={step.id}>
                      <td>{index + 1}</td>
                      <td>
                        {stepTypes(step.type as StepType)}
                        {snapshot?.steps[index]?.instruction ? <div className="muted small">{snapshot.steps[index].instruction}</div> : null}
                      </td>
                      <td>{step.targetWeightG ? formatGrams(num(step.targetWeightG), locale, 0) : "–"}</td>
                      <td>{formatSeconds(step.targetDurationSeconds)}</td>
                      <td>{formatSeconds(step.actualDurationSeconds)}</td>
                      <td>{step.skipped ? <span className="badge">{t("skipped")}</span> : <span className="badge badge-accent">{t("done")}</span>}</td>
                    </tr>
                  ))
                : snapshot?.steps.map((step, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>
                        {stepTypes(step.type as StepType)}
                        <div className="muted small">{step.instruction}</div>
                      </td>
                      <td>{step.waterTargetG !== null ? formatGrams(step.waterTargetG, locale, 0) : "–"}</td>
                      <td>{formatSeconds(step.durationSeconds)}</td>
                      <td>–</td>
                      <td>–</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">{t("snapshotHint")}</p>
      </section>

      {brew.status === "ABORTED" ? (
        <section className="section">
          <form action={deleteBrewAction}>
            <input type="hidden" name="id" value={brew.id} />
            <ConfirmSubmit message={t("deleteConfirm")}>{t("delete")}</ConfirmSubmit>
          </form>
        </section>
      ) : null}
    </>
  );
}
