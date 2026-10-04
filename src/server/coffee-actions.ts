"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "./session";
import { bagInput, saveCoffee, setCoffeeArchived, type SaveCoffee } from "./coffees";
import { findSimilarCoffees, saveSharedCoffee, setSharedCoffeeImage, sharedCoffeeInput, sharedCoffeeSuggestionInput, type SimilarCoffee } from "./shared-coffees";
import { roasterInput, roasterSuggestionInput, saveRoaster, setRoasterArchived } from "./roasters";
import { decideSuggestion, submitCoffeeSuggestion, submitRoasterSuggestion } from "./suggestions";
import { validateImageUpload } from "./image-upload";
import { errorState, formObject, validationState, type FormState } from "./action-state";

const idSchema = z.string().min(1).max(40);
const optionalId = (value: FormDataEntryValue | null) => (value ? idSchema.parse(value) : undefined);

/** The photo field of a form: a validated upload, or a field error to show. */
async function photoFrom(formData: FormData): Promise<{ image: Awaited<ReturnType<typeof validateImageUpload>> } | { error: FormState }> {
  try {
    return { image: await validateImageUpload(formData.get("image")) };
  } catch (error) {
    return { error: { error: "validation", fieldErrors: { image: error instanceof Error ? error.message : "imageInvalid" } } };
  }
}

/**
 * Saves the coffee form (§7). `scope` says which halves the form carried:
 *
 * - `both` - the shared coffee and the bag: a new coffee, or the creator
 *   editing their bag together with the coffee.
 * - `bag` - only the bag: a new bag of an existing shared coffee
 *   (`sharedCoffeeId`), or an edit of the bag alone.
 * - `shared` - only the shared coffee (`sharedCoffeeId`), from its own page.
 *
 * Whether the caller may change a shared coffee is decided in the server
 * module, not by which fields the form happened to show.
 */
export async function saveCoffeeAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const scope = z.enum(["both", "bag", "shared"]).parse(formData.get("scope") ?? "both");
  const bagId = optionalId(formData.get("id"));
  const sharedCoffeeId = optionalId(formData.get("sharedCoffeeId"));
  const fields = formObject(formData);

  const shared = scope === "bag" ? null : sharedCoffeeInput.safeParse(fields);
  const bag = scope === "shared" ? null : bagInput.safeParse(fields);
  if (shared && !shared.success) return validationState(shared.error);
  if (bag && !bag.success) return validationState(bag.error);

  const photo = scope === "bag" ? { image: null } : await photoFrom(formData);
  if ("error" in photo) return photo.error;

  let target: string;
  try {
    if (scope === "shared") {
      if (!sharedCoffeeId) return { error: "notFound" };
      await saveSharedCoffee(user, sharedCoffeeId, shared!.data!);
      target = `/coffees/shared/${sharedCoffeeId}`;
      await applyPhoto(user, sharedCoffeeId, photo.image, formData);
    } else {
      const save: SaveCoffee = {
        bag: bag!.data!,
        shared: shared ? { input: shared.data! } : sharedCoffeeId ? { id: sharedCoffeeId } : undefined,
      };
      const coffee = await saveCoffee(user, save, bagId);
      if (shared) await applyPhoto(user, coffee.sharedCoffeeId, photo.image, formData);
      target = `/coffees/${coffee.id}`;
    }
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/coffees", "layout");
  revalidatePath("/");
  redirect(target);
}

async function applyPhoto(user: { id: string; role: "USER" | "ADMIN" }, sharedCoffeeId: string, image: Awaited<ReturnType<typeof validateImageUpload>>, formData: FormData) {
  if (image) await setSharedCoffeeImage(user, sharedCoffeeId, image);
  else if (formData.get("removeImage") === "on") await setSharedCoffeeImage(user, sharedCoffeeId, null);
}

export async function archiveCoffeeAction(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await setCoffeeArchived(user.id, id, formData.get("archived") === "true");
  revalidatePath("/coffees");
  revalidatePath(`/coffees/${id}`);
}

/** Shared coffees that may be the one being typed into the new-coffee form. */
export async function similarCoffeesAction(query: { name: string; roasterName?: string; country?: string }): Promise<SimilarCoffee[]> {
  await requireUser();
  const parsed = z
    .object({ name: z.string().max(160), roasterName: z.string().max(120).optional(), country: z.string().max(80).optional() })
    .safeParse(query);
  if (!parsed.success) return [];
  return findSimilarCoffees(parsed.data);
}

/** Files a gap-filling suggestion for a shared coffee. */
export async function suggestCoffeeAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("sharedCoffeeId"));
  const parsed = sharedCoffeeSuggestionInput.safeParse(formObject(formData));
  if (!parsed.success) return validationState(parsed.error);
  const photo = await photoFrom(formData);
  if ("error" in photo) return photo.error;
  try {
    await submitCoffeeSuggestion(user, id, parsed.data, photo.image);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/coffees", "layout");
  redirect(`/coffees/shared/${id}?suggested=1`);
}

export async function saveRoasterAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = optionalId(formData.get("id"));
  const { id: _id, ...fields } = formObject(formData);
  const parsed = roasterInput.safeParse(fields);
  if (!parsed.success) return validationState(parsed.error);
  let roasterId: string;
  try {
    roasterId = (await saveRoaster(user, parsed.data, id)).id;
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/roasters", "layout");
  redirect(`/roasters/${roasterId}`);
}

/** Files a gap-filling suggestion for a roaster. */
export async function suggestRoasterAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  const { id: _id, ...fields } = formObject(formData);
  const parsed = roasterSuggestionInput.safeParse(fields);
  if (!parsed.success) return validationState(parsed.error);
  try {
    await submitRoasterSuggestion(user, id, parsed.data);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/roasters/${id}`);
  redirect(`/roasters/${id}?suggested=1`);
}

export async function archiveRoasterAction(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await setRoasterArchived(user, id, formData.get("archived") === "true");
  revalidatePath("/roasters");
  revalidatePath(`/roasters/${id}`);
}

/** Accepts or rejects a suggestion; only the entry's creator or an administrator can. */
export async function decideSuggestionAction(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  const accept = z.enum(["accept", "reject"]).parse(formData.get("decision")) === "accept";
  await decideSuggestion(user, id, accept);
  revalidatePath("/coffees", "layout");
  revalidatePath("/roasters", "layout");
}
