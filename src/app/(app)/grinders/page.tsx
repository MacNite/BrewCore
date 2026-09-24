import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { grinderLabel, listUserGrinders } from "@/server/grinders";
import { Empty, PageHead } from "@/components/ui";

export async function generateMetadata() {
  const t = await getTranslations("grinders");
  return { title: t("title") };
}

export default async function GrindersPage() {
  const user = await requirePageUser();
  const t = await getTranslations("grinders");
  const grinders = await listUserGrinders(user.id, { includeArchived: true });

  return (
    <>
      <PageHead
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Link className="btn" href="/brewers">
              {t("brewers")}
            </Link>
            <Link className="btn btn-primary" href="/grinders/new">
              {t("add")}
            </Link>
          </>
        }
      />
      {grinders.length === 0 ? (
        <Empty action={<Link className="btn btn-primary" href="/grinders/new">{t("add")}</Link>}>{t("empty")}</Empty>
      ) : (
        <ul className="list">
          {grinders.map((grinder) => (
            <li key={grinder.id}>
              <Link className="list-item" href={`/grinders/${grinder.id}`}>
                <div className="grow">
                  <div className="title">{grinderLabel(grinder)}</div>
                  <div className="meta">
                    {[t(`types.${grinder.grinderModel.type}`), t("brewCount", { count: grinder._count.brews })].join(" · ")}
                  </div>
                </div>
                {grinder.defaultForFilter ? <span className="badge badge-accent">{t("defaultFilter")}</span> : null}
                {grinder.defaultForEspresso ? <span className="badge badge-accent">{t("defaultEspresso")}</span> : null}
                {grinder.archivedAt ? <span className="badge">{t("archived")}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
