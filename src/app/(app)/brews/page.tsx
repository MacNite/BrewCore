import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { listBrews } from "@/server/brews";
import { BrewRow, Empty, PageHead } from "@/components/ui";
import type { AppLocale } from "@/lib/format";

export async function generateMetadata() {
  const t = await getTranslations("brews");
  return { title: t("title") };
}

const STATUSES = ["COMPLETED", "ABORTED", "IN_PROGRESS"] as const;

export default async function BrewsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const user = await requirePageUser();
  const t = await getTranslations("brews");
  const locale = (await getLocale()) as AppLocale;
  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { brews, pages, total } = await listBrews(user.id, { status, page });
  const link = (next: { status?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (next.status) query.set("status", next.status);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const text = query.toString();
    return text ? `/brews?${text}` : "/brews";
  };

  return (
    <>
      <PageHead
        title={t("title")}
        subtitle={t("total", { count: total })}
        actions={
          <a className="btn" href="/api/export/json" download>
            {t("export")}
          </a>
        }
      />
      <nav aria-label={t("filter")} className="tags" style={{ marginBottom: 14 }}>
        <Link className={!status ? "btn btn-primary" : "btn"} href={link({})} aria-current={!status ? "page" : undefined}>
          {t("all")}
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} className={status === s ? "btn btn-primary" : "btn"} href={link({ status: s })} aria-current={status === s ? "page" : undefined}>
            {t(`status.${s}`)}
          </Link>
        ))}
      </nav>
      {brews.length === 0 ? (
        <Empty action={<Link className="btn btn-primary" href="/brew/new">{t("startBrew")}</Link>}>{t("empty")}</Empty>
      ) : (
        <ul className="list">
          {brews.map((brew) => (
            <BrewRow key={brew.id} brew={brew} locale={locale} />
          ))}
        </ul>
      )}
      {pages > 1 ? (
        <nav aria-label={t("pagination")} className="form-actions" style={{ justifyContent: "center", marginTop: 16 }}>
          {page > 1 ? (
            <Link className="btn" href={link({ status, page: page - 1 })}>
              ← {t("newer")}
            </Link>
          ) : null}
          <span className="muted" style={{ alignSelf: "center" }}>
            {t("pageOf", { page, pages })}
          </span>
          {page < pages ? (
            <Link className="btn" href={link({ status, page: page + 1 })}>
              {t("older")} →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
