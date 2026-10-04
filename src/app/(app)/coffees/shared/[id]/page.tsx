import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getSharedCoffee } from "@/server/shared-coffees";
import { coffeeGaps, openSuggestionsFor } from "@/server/suggestions";
import { PageHead } from "@/components/ui";
import { SuggestionList } from "@/components/suggestion-list";
import { formatDate, type AppLocale } from "@/lib/format";
import { SharedCoffeeFacts } from "../../shared-facts";

/**
 * A shared coffee (§7): what every member sees. Its creator and
 * administrators edit it and decide on suggestions; everyone else can add a
 * bag of it and fill its gaps.
 */
export default async function SharedCoffeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ suggested?: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const suggested = (await searchParams).suggested === "1";
  const t = await getTranslations("coffees");
  const locale = (await getLocale()) as AppLocale;
  const { coffee, createdByName, myBags, canEdit } = await orNotFound(getSharedCoffee(user, id));
  const suggestions = await openSuggestionsFor(user, { sharedCoffeeId: id }, canEdit);
  const gaps = coffeeGaps(coffee);
  const canSuggest = !canEdit && (gaps.length > 0 || !coffee.imageUpdatedAt) && !suggestions.some((s) => s.mine);

  return (
    <>
      <PageHead
        title={coffee.name}
        subtitle={createdByName ? t("addedBy", { name: createdByName }) : coffee.roasterNameSnapshot}
        actions={
          <>
            <Link className="btn btn-primary" href={`/coffees/new?shared=${coffee.id}`}>
              {myBags.length > 0 ? t("addAnotherBag") : t("addToMine")}
            </Link>
            {canEdit ? (
              <Link className="btn" href={`/coffees/shared/${coffee.id}/edit`}>
                {t("edit")}
              </Link>
            ) : null}
            {canSuggest ? (
              <Link className="btn" href={`/coffees/shared/${coffee.id}/suggest`}>
                {t("suggestMissing")}
              </Link>
            ) : null}
          </>
        }
      />

      {suggested ? (
        <div className="notice notice-success" role="status">
          {t("suggestionSent")}
        </div>
      ) : null}

      <div className="grid grid-2">
        <section className="card" aria-labelledby="facts-heading">
          <h2 id="facts-heading">{t("details")}</h2>
          <SharedCoffeeFacts coffee={coffee} />
          <p className="small muted">{t("sharedHint")}</p>
        </section>

        <section className="card" aria-labelledby="bags-heading">
          <h2 id="bags-heading">{t("myBags")}</h2>
          {myBags.length === 0 ? (
            <p className="muted">{t("noBagsYet")}</p>
          ) : (
            <ul className="list">
              {myBags.map((bag) => (
                <li key={bag.id}>
                  <Link className="list-item" href={`/coffees/${bag.id}`}>
                    <div className="grow">
                      <div className="title">{bag.roastDate ? t("roastedOn", { date: formatDate(bag.roastDate, locale) }) : t("bagWithoutDate")}</div>
                    </div>
                    {bag.archivedAt ? <span className="badge">{t("archived")}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
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
