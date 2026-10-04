import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getRoaster } from "@/server/roasters";
import { openSuggestionsFor, roasterGaps } from "@/server/suggestions";
import { archiveRoasterAction } from "@/server/coffee-actions";
import { Empty, PageHead } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";
import { SuggestionList } from "@/components/suggestion-list";
import { safeHttpUrl } from "@/lib/url";
import { RoasterForm } from "../roaster-form";

/**
 * A shared roaster (§8): its coffees on this instance, editable by whoever
 * added it and administrators; everyone else may fill its gaps.
 */
export default async function RoasterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ suggested?: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const suggested = (await searchParams).suggested === "1";
  const t = await getTranslations("roasters");
  const { roaster, coffees, createdByName, canEdit } = await orNotFound(getRoaster(user, id));
  const suggestions = await openSuggestionsFor(user, { roasterId: id }, canEdit);
  const website = safeHttpUrl(roaster.website);
  const gaps = roasterGaps(roaster);
  const canSuggest = !canEdit && gaps.length > 0 && !suggestions.some((s) => s.mine);
  const values = { id: roaster.id, name: roaster.name, country: roaster.country ?? "", city: roaster.city ?? "", website: roaster.website ?? "", notes: roaster.notes ?? "" };

  return (
    <>
      <PageHead
        title={roaster.name}
        subtitle={[[roaster.city, roaster.country].filter(Boolean).join(", "), createdByName ? t("addedBy", { name: createdByName }) : null].filter(Boolean).join(" · ") || undefined}
        actions={
          website ? (
            <a className="btn" href={website} rel="noopener noreferrer nofollow" target="_blank">
              {t("visitWebsite")}
            </a>
          ) : undefined
        }
      />
      {suggested ? (
        <div className="notice notice-success" role="status">
          {t("suggestionSent")}
        </div>
      ) : null}
      <div className="grid grid-2">
        <section aria-labelledby="coffees-heading">
          <h2 id="coffees-heading">{t("coffees")}</h2>
          {coffees.length === 0 ? (
            <Empty action={<Link className="btn" href="/coffees/new">{t("addCoffee")}</Link>}>{t("noCoffees")}</Empty>
          ) : (
            <ul className="list">
              {coffees.map((coffee) => (
                <li key={coffee.id}>
                  <Link className="list-item" href={`/coffees/shared/${coffee.id}`}>
                    <div className="grow">
                      <div className="title">{coffee.name}</div>
                      <div className="meta">{[coffee.country, coffee.process].filter(Boolean).join(" · ")}</div>
                    </div>
                    {coffee.myBagId ? <span className="badge badge-accent">{t("inMyCoffees")}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        {canEdit ? (
          <section className="card" aria-labelledby="edit-heading">
            <h2 id="edit-heading">{t("edit")}</h2>
            <RoasterForm values={values} />
            <form action={archiveRoasterAction} style={{ marginTop: 16 }}>
              <input type="hidden" name="id" value={roaster.id} />
              <input type="hidden" name="archived" value={roaster.archivedAt ? "false" : "true"} />
              {roaster.archivedAt ? (
                <button className="btn" type="submit">
                  {t("unarchive")}
                </button>
              ) : (
                <ConfirmSubmit message={t("archiveConfirm")}>{t("archive")}</ConfirmSubmit>
              )}
            </form>
          </section>
        ) : canSuggest ? (
          <section className="card" aria-labelledby="suggest-heading">
            <h2 id="suggest-heading">{t("suggestMissing")}</h2>
            <RoasterForm values={values} suggestFields={gaps} />
          </section>
        ) : null}
      </div>
      {suggestions.length > 0 ? (
        <section className="section" aria-labelledby="suggestions-heading">
          <h2 id="suggestions-heading">{canEdit ? t("suggestionsToReview") : t("yourSuggestion")}</h2>
          <SuggestionList suggestions={suggestions} canDecide={canEdit} />
        </section>
      ) : null}
    </>
  );
}
