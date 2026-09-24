import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { listCoffees } from "@/server/coffees";
import { cleanQuery } from "@/server/ownership";
import { Empty, PageHead, SearchForm } from "@/components/ui";
import { daysSince, formatGrams, type AppLocale } from "@/lib/format";
import { num } from "@/lib/decimal";

export async function generateMetadata() {
  const t = await getTranslations("coffees");
  return { title: t("title") };
}

export default async function CoffeesPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const user = await requirePageUser();
  const t = await getTranslations("coffees");
  const locale = (await getLocale()) as AppLocale;
  const params = await searchParams;
  const q = cleanQuery(params.q);
  const includeArchived = params.archived === "1";
  const coffees = await listCoffees(user.id, { q, includeArchived });

  return (
    <>
      <PageHead
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Link className="btn" href="/roasters">
              {t("roasters")}
            </Link>
            <Link className="btn btn-primary" href="/coffees/new">
              {t("add")}
            </Link>
          </>
        }
      />
      <SearchForm q={q} label={t("search")} placeholder={t("searchPlaceholder")}>
        {includeArchived ? <input type="hidden" name="archived" value="1" /> : null}
      </SearchForm>
      <p className="small">
        <Link href={includeArchived ? "/coffees" : "/coffees?archived=1"}>{includeArchived ? t("hideArchived") : t("showArchived")}</Link>
      </p>

      {coffees.length === 0 ? (
        <Empty action={q ? undefined : <Link className="btn btn-primary" href="/coffees/new">{t("add")}</Link>}>{q ? t("noResults") : t("empty")}</Empty>
      ) : (
        <ul className="list">
          {coffees.map((coffee) => {
            const age = daysSince(coffee.roastDate);
            const remaining = num(coffee.remainingWeightG);
            return (
              <li key={coffee.id}>
                <Link className="list-item" href={`/coffees/${coffee.id}`}>
                  {coffee.imageUpdatedAt ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private, owner-only image route
                    <img className="thumb" src={`/api/coffees/${coffee.id}/image?v=${coffee.imageUpdatedAt.getTime()}`} alt="" />
                  ) : (
                    <span className="thumb" aria-hidden="true" />
                  )}
                  <div className="grow">
                    <div className="title">{coffee.name}</div>
                    <div className="meta">
                      {[
                        coffee.roasterNameSnapshot,
                        coffee.country,
                        coffee.process,
                        age !== null ? t("daysSinceRoast", { days: age }) : null,
                        remaining !== null ? t("remaining", { amount: formatGrams(remaining, locale, 0) }) : null,
                        t("brewCount", { count: coffee._count.brews }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  {coffee.archivedAt ? <span className="badge">{t("archived")}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
