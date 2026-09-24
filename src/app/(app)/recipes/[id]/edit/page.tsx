import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getRecipe, recipeToPlain } from "@/server/recipes";
import { brewerLabel, listBrewers } from "@/server/brewers";
import { PageHead } from "@/components/ui";
import { RecipeForm } from "../../recipe-form";
import { recipeFormValues } from "../../form-values";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("recipes");
  const recipe = await orNotFound(getRecipe(user.id, id, user.language));
  // Bundled recipes are read-only; their detail page offers "edit a copy".
  if (recipe.ownerId !== user.id) redirect(`/recipes/${id}`);
  const brewers = await listBrewers(user.id);
  return (
    <>
      <PageHead title={t("edit")} subtitle={recipe.name} />
      <RecipeForm values={recipeFormValues(recipeToPlain(recipe))} brewers={brewers.map((b) => ({ id: b.id, label: brewerLabel(b) }))} />
    </>
  );
}
