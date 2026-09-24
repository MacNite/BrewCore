import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getRoaster } from "@/server/roasters";
import { archiveRoasterAction } from "@/server/coffee-actions";
import { Empty, PageHead } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";
import { formatDate, type AppLocale } from "@/lib/format";
import { safeHttpUrl } from "@/lib/url";
import { RoasterForm } from "../roaster-form";

export default async function RoasterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("roasters");
  const locale = (await getLocale()) as AppLocale;
  const roaster = await orNotFound(getRoaster(user.id, id));
  const website = safeHttpUrl(roaster.website);

  return (
    <>
      <PageHead
        title={roaster.name}
        subtitle={[roaster.city, roaster.country].filter(Boolean).join(", ") || undefined}
        actions={
          website ? (
            <a className="btn" href={website} rel="noopener noreferrer nofollow" target="_blank">
              {t("visitWebsite")}
            </a>
          ) : undefined
        }
      />
      <div className="grid grid-2">
        <section aria-labelledby="coffees-heading">
          <h2 id="coffees-heading">{t("coffees")}</h2>
          {roaster.coffees.length === 0 ? (
            <Empty action={<Link className="btn" href="/coffees/new">{t("addCoffee")}</Link>}>{t("noCoffees")}</Empty>
          ) : (
            <ul className="list">
              {roaster.coffees.map((coffee) => (
                <li key={coffee.id}>
                  <Link className="list-item" href={`/coffees/${coffee.id}`}>
                    <div className="grow">
                      <div className="title">{coffee.name}</div>
                      <div className="meta">{coffee.roastDate ? formatDate(coffee.roastDate, locale) : ""}</div>
                    </div>
                    {coffee.archivedAt ? <span className="badge">{t("archived")}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="edit-heading">
          <h2 id="edit-heading">{t("edit")}</h2>
          <RoasterForm
            values={{ id: roaster.id, name: roaster.name, country: roaster.country ?? "", city: roaster.city ?? "", website: roaster.website ?? "", notes: roaster.notes ?? "" }}
          />
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
      </div>
    </>
  );
}
