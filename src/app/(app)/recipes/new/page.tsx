import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { brewerLabel, listBrewers } from "@/server/brewers";
import { PageHead } from "@/components/ui";
import { RecipeForm } from "../recipe-form";
import { emptyRecipeValues } from "../form-values";

export async function generateMetadata() {
  const t = await getTranslations("recipes");
  return { title: t("new") };
}

export default async function NewRecipePage() {
  const user = await requirePageUser();
  const t = await getTranslations("recipes");
  const brewers = await listBrewers(user.id);
  return (
    <>
      <PageHead title={t("new")} subtitle={t("newHint")} />
      <RecipeForm values={emptyRecipeValues} brewers={brewers.map((b) => ({ id: b.id, label: brewerLabel(b) }))} />
    </>
  );
}
