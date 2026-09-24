"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "./session";
import { abortBrew, deleteAbortedBrew, saveTasting, startBrew, startBrewInput, tastingInput, updateBrewNotes } from "./brews";
import { toggleFavorite, favoriteTarget } from "./favorites";
import { ConflictError } from "./errors";
import { errorState, formObject, validationState, type FormState } from "./action-state";

const idSchema = z.string().min(1).max(40);

/** Start Brew (§56): validate, create with snapshots, open the live screen. */
export async function startBrewAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = startBrewInput.safeParse(formObject(formData));
  if (!parsed.success) return validationState(parsed.error);
  const t = await getTranslations("live");
  let brewId: string;
  try {
    brewId = (await startBrew(user.id, parsed.data, t("fallbackInstruction"), user.language)).id;
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/");
  redirect(`/brew/live/${brewId}`);
}

/** Abort from the home screen's "Continue active brew" when local state is gone. */
export async function abortBrewAction(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  try {
    await abortBrew(user.id, id);
  } catch (error) {
    if (!(error instanceof ConflictError)) throw error;
  }
  revalidatePath("/");
  revalidatePath("/brews");
}

export async function deleteBrewAction(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await deleteAbortedBrew(user.id, id);
  revalidatePath("/brews");
  redirect("/brews");
}

const scoreFields = ["acidity", "sweetness", "bitterness", "body", "clarity", "aftertaste"] as const;

/** The full tasting form at /brews/[id]/taste. */
export async function saveTastingAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("brewId"));
  const wouldBrewAgain = formData.get("wouldBrewAgain");
  const input = {
    rating: Number(formData.get("rating")),
    wouldBrewAgain: wouldBrewAgain === "yes" ? true : wouldBrewAgain === "no" ? false : null,
    tags: formData.getAll("tags").map(String),
    notes: String(formData.get("notes") ?? ""),
    ...Object.fromEntries(scoreFields.map((field) => [field, formData.get(field) ? Number(formData.get(field)) : null])),
  };
  const parsed = tastingInput.safeParse(input);
  if (!parsed.success) return validationState(parsed.error);
  try {
    await saveTasting(user.id, id, parsed.data);
    const notes = String(formData.get("brewNotes") ?? "").trim().slice(0, 4000);
    if (formData.has("brewNotes")) await updateBrewNotes(user.id, id, notes || null);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/brews/${id}`);
  revalidatePath("/brews");
  redirect(`/brews/${id}`);
}

export async function toggleFavoriteAction(formData: FormData) {
  const user = await requireUser();
  const target = favoriteTarget.parse({ kind: formData.get("kind"), id: formData.get("id") });
  await toggleFavorite(user.id, target);
  const path = { coffee: "/coffees", recipe: "/recipes", brew: "/brews" }[target.kind];
  revalidatePath(`${path}/${target.id}`);
  revalidatePath(path);
  revalidatePath("/");
}
