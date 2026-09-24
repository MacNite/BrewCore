"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "./session";
import { duplicateRecipe, recipeInput, saveRecipe, setRecipeArchived } from "./recipes";
import { errorState, formObject, validationState, type FormState } from "./action-state";

const idSchema = z.string().min(1).max(40);

export async function saveRecipeAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = formData.get("id") ? idSchema.parse(formData.get("id")) : undefined;
  const { id: _id, steps: rawSteps, ...fields } = formObject(formData);

  let steps: unknown;
  try {
    steps = JSON.parse(String(rawSteps ?? "[]"));
  } catch {
    return { error: "validation", fieldErrors: { steps: "invalid" } };
  }

  const parsed = recipeInput.safeParse({ ...fields, steps });
  if (!parsed.success) return validationState(parsed.error);

  let recipeId: string;
  try {
    recipeId = (await saveRecipe(user.id, parsed.data, id)).id;
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}`);
}

/**
 * Duplicate — and "Edit" on a bundled recipe, which lands on the editor of a
 * fresh user copy (§42).
 */
export async function duplicateRecipeAction(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  const t = await getTranslations("recipes");
  const copy = await duplicateRecipe(user.id, id, t("copySuffix"), user.language);
  revalidatePath("/recipes");
  redirect(formData.get("edit") === "true" ? `/recipes/${copy.id}/edit` : `/recipes/${copy.id}`);
}

export async function archiveRecipeAction(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await setRecipeArchived(user.id, id, formData.get("archived") === "true");
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
}
