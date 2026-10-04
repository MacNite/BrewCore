import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { listSharedCoffees } from "@/server/shared-coffees";
import { cleanQuery } from "@/server/ownership";
import { Empty, PageHead, SearchForm } from "@/components/ui";
import { sharedImageUrl } from "../shared-facts";

export async function generateMetadata() {
  const t = await getTranslations("coffees");
  return { title: t("sharedCatalogue") };
}

/** Every coffee on this instance (§7): what other members added, to add a bag of. */
export default async function SharedCoffeesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePageUser();
  const t = await getTranslations("coffees");
  const q = cleanQuery((await searchParams).q);
  const coffees = await listSharedCoffees(user.id, { q });

  return (
    <>
      <PageHead
        title={t("sharedCatalogue")}
        subtitle={t("sharedCatalogueHint")}
        actions={
          <>
            <Link className="btn" href="/coffees">
              {t("myCoffees")}
            </Link>
            <Link className="btn btn-primary" href="/coffees/new">
              {t("add")}
            </Link>
          </>
        }
      />
      <SearchForm q={q} label={t("search")} placeholder={t("searchPlaceholder")} />
      {coffees.length === 0 ? (
        <Empty action={q ? undefined : <Link className="btn btn-primary" href="/coffees/new">{t("add")}</Link>}>{q ? t("noResults") : t("sharedEmpty")}</Empty>
      ) : (
        <ul className="list">
          {coffees.map((coffee) => {
            const image = sharedImageUrl(coffee);
            return (
              <li key={coffee.id}>
                <Link className="list-item" href={`/coffees/shared/${coffee.id}`}>
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed-in-only image route
                    <img className="thumb" src={image} alt="" />
                  ) : (
                    <span className="thumb" aria-hidden="true" />
                  )}
                  <div className="grow">
                    <div className="title">{coffee.name}</div>
                    <div className="meta">{[coffee.roasterNameSnapshot, coffee.country, coffee.process].filter(Boolean).join(" · ")}</div>
                  </div>
                  {coffee.myBagId ? <span className="badge badge-accent">{t("inMyCoffees")}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
