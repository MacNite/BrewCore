import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getUserGrinderDetail, grinderLabel } from "@/server/grinders";
import { archiveGrinderAction } from "@/server/grinder-actions";
import { BrewRow, Empty, PageHead, Rating } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";
import { dateInputValue, formatDate, type AppLocale } from "@/lib/format";
import { num } from "@/lib/decimal";
import { GrinderForm } from "../grinder-form";
import { grinderModelOptions } from "../models";

export default async function GrinderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("grinders");
  const locale = (await getLocale()) as AppLocale;
  const { grinder, recent, best, combinations } = await orNotFound(getUserGrinderDetail(user.id, id));
  const models = await grinderModelOptions(user.id);
  const model = grinder.grinderModel;
  const range = num(model.minSetting) !== null && num(model.maxSetting) !== null ? `${num(model.minSetting)}–${num(model.maxSetting)} ${model.settingUnit ?? ""}` : null;

  return (
    <>
      <PageHead title={grinderLabel(grinder)} subtitle={grinder.archivedAt ? <span className="badge">{t("archived")}</span> : undefined} />
      <div className="grid grid-2">
        <section className="card" aria-labelledby="model-heading">
          <h2 id="model-heading">{t("modelAndCalibration")}</h2>
          <dl className="facts">
            <dt>{t("fields.model")}</dt>
            <dd>
              {model.manufacturer} {model.model}
            </dd>
            <dt>{t("fields.type")}</dt>
            <dd>{t(`types.${model.type}`)}</dd>
            <dt>{t("fields.adjustment")}</dt>
            <dd>{t(`adjustments.${model.adjustmentType}`)}</dd>
            {range ? (
              <>
                <dt>{t("fields.range")}</dt>
                <dd>{range}</dd>
              </>
            ) : null}
            {model.burrType ? (
              <>
                <dt>{t("fields.burrType")}</dt>
                <dd>
                  {model.burrType}
                  {model.burrDiameterMm ? ` · ${model.burrDiameterMm} mm` : ""}
                </dd>
              </>
            ) : null}
            <dt>{t("fields.zeroPoint")}</dt>
            <dd>{grinder.zeroPoint ?? "–"}</dd>
            <dt>{t("fields.calibrationNotes")}</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{grinder.calibrationNotes ?? "–"}</dd>
          </dl>
        </section>
        <section className="card" aria-labelledby="best-heading">
          <h2 id="best-heading">{t("bestSettings")}</h2>
          {best.length === 0 ? (
            <p className="muted">{t("noBest")}</p>
          ) : (
            <ul className="list">
              {best.map((brew) => (
                <li key={brew.id}>
                  <Link className="list-item" href={`/brews/${brew.id}`}>
                    <div className="grow">
                      <div className="title">{brew.grindSettingText}</div>
                      <div className="meta">{[brew.coffeeNameSnapshot, brew.recipeNameSnapshot].filter(Boolean).join(" · ")}</div>
                    </div>
                    <Rating value={brew.tasting?.rating} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {combinations.length > 0 ? (
            <>
              <h3 style={{ marginTop: 16 }}>{t("combinations")}</h3>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th scope="col">{t("coffee")}</th>
                      <th scope="col">{t("recipe")}</th>
                      <th scope="col">{t("brews")}</th>
                      <th scope="col">{t("last")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinations.map((row) => (
                      <tr key={`${row.coffeeNameSnapshot}-${row.recipeNameSnapshot}`}>
                        <td>{row.coffeeNameSnapshot ?? "–"}</td>
                        <td>{row.recipeNameSnapshot}</td>
                        <td>{row._count._all}</td>
                        <td>{formatDate(row._max.completedAt, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </div>

      <section className="section" aria-labelledby="recent-heading">
        <h2 id="recent-heading">{t("recentSettings")}</h2>
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

      <section className="section card" aria-labelledby="edit-heading">
        <h2 id="edit-heading">{t("edit")}</h2>
        <GrinderForm
          models={models}
          values={{
            id: grinder.id,
            grinderModelId: grinder.grinderModelId,
            nickname: grinder.nickname ?? "",
            burrDescription: grinder.burrDescription ?? "",
            burrInstallDate: dateInputValue(grinder.burrInstallDate),
            zeroPoint: grinder.zeroPoint ?? "",
            calibrationNotes: grinder.calibrationNotes ?? "",
            defaultForFilter: grinder.defaultForFilter,
            defaultForEspresso: grinder.defaultForEspresso,
          }}
        />
        <form action={archiveGrinderAction} style={{ marginTop: 16 }}>
          <input type="hidden" name="id" value={grinder.id} />
          <input type="hidden" name="archived" value={grinder.archivedAt ? "false" : "true"} />
          {grinder.archivedAt ? (
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
