import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "@/server/page-guard";
import { duplicateCandidates } from "@/server/catalogue-merge";
import { mergeDuplicateAction } from "@/server/admin-actions";
import { Empty, PageHead } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";

export async function generateMetadata() {
  const t = await getTranslations("admin.duplicates");
  return { title: t("title") };
}

interface Side {
  id: string;
  name: string;
  detail: string;
  count: string;
  href: string;
}

/**
 * Likely duplicate shared coffees and roasters (§7, §8). Merging keeps one
 * entry, fills its gaps from the other and moves every bag (or coffee) over;
 * brews are untouched.
 */
export default async function DuplicatesPage() {
  const admin = await requireAdminPage();
  const t = await getTranslations("admin.duplicates");
  const { coffees, roasters } = await duplicateCandidates(admin);

  const pair = (kind: "coffee" | "roaster", a: Side, b: Side, score: number) => (
    <li key={`${a.id}-${b.id}`} className="card stack">
      <div className="small muted">{t("score", { percent: Math.round(score * 100) })}</div>
      <div className="grid grid-2">
        {[
          [a, b],
          [b, a],
        ].map(([keep, drop]) => (
          <div key={keep.id} className="stack">
            <div>
              <div className="title">
                <Link href={keep.href}>{keep.name}</Link>
              </div>
              <div className="meta small">{[keep.detail, keep.count].filter(Boolean).join(" · ")}</div>
            </div>
            <form action={mergeDuplicateAction}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="keepId" value={keep.id} />
              <input type="hidden" name="dropId" value={drop.id} />
              <ConfirmSubmit className="btn" message={t("confirm", { keep: keep.name, drop: drop.name })}>
                {t("keepThis")}
              </ConfirmSubmit>
            </form>
          </div>
        ))}
      </div>
    </li>
  );

  return (
    <>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <section className="section" aria-labelledby="coffee-duplicates">
        <h2 id="coffee-duplicates">{t("coffees")}</h2>
        {coffees.length === 0 ? (
          <Empty>{t("none")}</Empty>
        ) : (
          <ul className="list">
            {coffees.map(({ a, b, score }) =>
              pair(
                "coffee",
                ...([a, b].map((c) => ({
                  id: c.id,
                  name: c.name,
                  detail: [c.roasterNameSnapshot, c.country].filter(Boolean).join(", "),
                  count: t("bagCount", { count: c._count.bags }),
                  href: `/coffees/shared/${c.id}`,
                })) as [Side, Side]),
                score,
              ),
            )}
          </ul>
        )}
      </section>
      <section className="section" aria-labelledby="roaster-duplicates">
        <h2 id="roaster-duplicates">{t("roasters")}</h2>
        {roasters.length === 0 ? (
          <Empty>{t("none")}</Empty>
        ) : (
          <ul className="list">
            {roasters.map(({ a, b, score }) =>
              pair(
                "roaster",
                ...([a, b].map((r) => ({
                  id: r.id,
                  name: r.name,
                  detail: [r.city, r.country].filter(Boolean).join(", "),
                  count: t("coffeeCount", { count: r._count.coffees }),
                  href: `/roasters/${r.id}`,
                })) as [Side, Side]),
                score,
              ),
            )}
          </ul>
        )}
      </section>
    </>
  );
}
