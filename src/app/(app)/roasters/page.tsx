import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { listRoasters } from "@/server/roasters";
import { cleanQuery } from "@/server/ownership";
import { Empty, PageHead, SearchForm } from "@/components/ui";
import { RoasterForm } from "./roaster-form";

export async function generateMetadata() {
  const t = await getTranslations("roasters");
  return { title: t("title") };
}

export default async function RoastersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePageUser();
  const t = await getTranslations("roasters");
  const q = cleanQuery((await searchParams).q);
  const roasters = await listRoasters(user.id, { q, includeArchived: true });

  return (
    <>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <div className="grid grid-2">
        <section>
          <SearchForm q={q} label={t("search")} placeholder={t("searchPlaceholder")} />
          {roasters.length === 0 ? (
            <Empty>{q ? t("noResults") : t("empty")}</Empty>
          ) : (
            <ul className="list">
              {roasters.map((roaster) => (
                <li key={roaster.id}>
                  <Link className="list-item" href={`/roasters/${roaster.id}`}>
                    <div className="grow">
                      <div className="title">{roaster.name}</div>
                      <div className="meta">
                        {[roaster.city, roaster.country, t("coffeeCount", { count: roaster._count.coffees })].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {roaster.archivedAt ? <span className="badge">{t("archived")}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="add-roaster">
          <h2 id="add-roaster">{t("add")}</h2>
          <RoasterForm values={{ name: "", country: "", city: "", website: "", notes: "" }} />
        </section>
      </div>
    </>
  );
}
