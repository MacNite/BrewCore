import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { brewerLabel, listBrewers } from "@/server/brewers";
import { cleanQuery } from "@/server/ownership";
import { Empty, PageHead, SearchForm } from "@/components/ui";
import { BrewerForm } from "./brewer-form";

export async function generateMetadata() {
  const t = await getTranslations("brewers");
  return { title: t("title") };
}

export default async function BrewersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePageUser();
  const t = await getTranslations("brewers");
  const methods = await getTranslations("methods");
  const q = cleanQuery((await searchParams).q);
  const brewers = await listBrewers(user.id, q);

  return (
    <>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <div className="grid grid-2">
        <section>
          <SearchForm q={q} label={t("search")} placeholder={t("searchPlaceholder")} />
          {brewers.length === 0 ? (
            <Empty>{t("noResults")}</Empty>
          ) : (
            <ul className="list">
              {brewers.map((brewer) => (
                <li key={brewer.id}>
                  <Link className="list-item" href={`/brewers/${brewer.id}`}>
                    <div className="grow">
                      <div className="title">{brewerLabel(brewer)}</div>
                      <div className="meta">{methods(brewer.methodType)}</div>
                    </div>
                    <span className={brewer.ownerId ? "badge badge-accent" : "badge"}>{brewer.ownerId ? t("custom") : t("bundled")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="add-brewer">
          <h2 id="add-brewer">{t("add")}</h2>
          <p className="muted small">{t("addHint")}</p>
          <BrewerForm />
        </section>
      </div>
    </>
  );
}
