import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { listRecipes } from "@/server/recipes";
import { cleanQuery } from "@/server/ownership";
import { Empty, PageHead, SearchForm } from "@/components/ui";
import { METHOD_TYPES } from "@/lib/brewing/recipe";
import { formatRatio, ratioOf } from "@/lib/brewing/ratio";
import { num } from "@/lib/decimal";

export async function generateMetadata() {
  const t = await getTranslations("recipes");
  return { title: t("title") };
}

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ q?: string; method?: string; archived?: string }> }) {
  const user = await requirePageUser();
  const t = await getTranslations("recipes");
  const methods = await getTranslations("methods");
  const params = await searchParams;
  const q = cleanQuery(params.q);
  const method = (METHOD_TYPES as readonly string[]).includes(params.method ?? "") ? params.method : undefined;
  const includeArchived = params.archived === "1";
  const recipes = await listRecipes(user.id, user.language, { q, methodType: method, includeArchived });
  const sep = user.language === "de" ? "," : ".";

  return (
    <>
      <PageHead
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link className="btn btn-primary" href="/recipes/new">
            {t("new")}
          </Link>
        }
      />
      <SearchForm q={q} label={t("search")} placeholder={t("searchPlaceholder")}>
        <label className="sr-only" htmlFor="method">
          {t("fields.method")}
        </label>
        <select id="method" name="method" defaultValue={method ?? ""} style={{ width: "auto" }}>
          <option value="">{t("allMethods")}</option>
          {METHOD_TYPES.map((m) => (
            <option key={m} value={m}>
              {methods(m)}
            </option>
          ))}
        </select>
      </SearchForm>
      <p className="small">
        <Link href={includeArchived ? "/recipes" : "/recipes?archived=1"}>{includeArchived ? t("hideArchived") : t("showArchived")}</Link>
      </p>
      {recipes.length === 0 ? (
        <Empty>{t("noResults")}</Empty>
      ) : (
        <ul className="list">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <Link className="list-item" href={`/recipes/${recipe.id}`}>
                <div className="grow">
                  <div className="title">
                    {recipe.isFavorite ? <span aria-label={t("favorite")}>♥ </span> : null}
                    {recipe.name}
                  </div>
                  <div className="meta">
                    {[
                      methods(recipe.methodType),
                      `${num(recipe.defaultCoffeeDoseG)} g → ${num(recipe.defaultWaterG)} g`,
                      formatRatio(ratioOf(num(recipe.defaultWaterG), num(recipe.defaultCoffeeDoseG)), sep),
                      t("stepCount", { count: recipe._count.steps }),
                    ].join(" · ")}
                  </div>
                </div>
                <span className={recipe.ownerId ? "badge badge-accent" : "badge"}>{recipe.ownerId ? t("mine") : t("bundled")}</span>
                {recipe.archivedAt ? <span className="badge">{t("archived")}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
