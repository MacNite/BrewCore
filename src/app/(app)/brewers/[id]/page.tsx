import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { brewerLabel, getBrewer } from "@/server/brewers";
import { archiveBrewerAction } from "@/server/grinder-actions";
import { Empty, PageHead } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";

export default async function BrewerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("brewers");
  const methods = await getTranslations("methods");
  const { brewer, brewCount } = await orNotFound(getBrewer(user.id, id, user.language));
  const own = brewer.ownerId === user.id;

  return (
    <>
      <PageHead title={brewerLabel(brewer)} subtitle={`${methods(brewer.methodType)} · ${own ? t("custom") : t("bundled")}`} />
      <div className="grid grid-2">
        <section className="card">
          <dl className="facts">
            <dt>{t("fields.method")}</dt>
            <dd>{methods(brewer.methodType)}</dd>
            <dt>{t("fields.capacity")}</dt>
            <dd>{brewer.capacityMl ? `${brewer.capacityMl} ml` : "–"}</dd>
            <dt>{t("brewCount")}</dt>
            <dd>{brewCount}</dd>
          </dl>
          {brewer.description ? <p>{brewer.description}</p> : null}
          {own ? (
            <form action={archiveBrewerAction} style={{ marginTop: 16 }}>
              <input type="hidden" name="id" value={brewer.id} />
              <input type="hidden" name="archived" value="true" />
              <ConfirmSubmit message={t("archiveConfirm")}>{t("archive")}</ConfirmSubmit>
            </form>
          ) : null}
        </section>
        <section aria-labelledby="recipes-heading">
          <h2 id="recipes-heading">{t("recipes")}</h2>
          {brewer.recipes.length === 0 ? (
            <Empty>{t("noRecipes")}</Empty>
          ) : (
            <ul className="list">
              {brewer.recipes.map((recipe) => (
                <li key={recipe.id}>
                  <Link className="list-item" href={`/recipes/${recipe.id}`}>
                    <div className="grow title">{recipe.name}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
