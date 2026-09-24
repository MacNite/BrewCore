"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "./session";
import { coffeeInput, saveCoffee, setCoffeeArchived, setCoffeeImage } from "./coffees";
import { roasterInput, saveRoaster, setRoasterArchived } from "./roasters";
import { validateImageUpload } from "./image-upload";
import { errorState, formObject, validationState, type FormState } from "./action-state";

const idSchema = z.string().min(1).max(40);

export async function saveCoffeeAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = formData.get("id") ? idSchema.parse(formData.get("id")) : undefined;
  const { image: _image, removeImage: _remove, id: _id, ...fields } = formObject(formData);
  const parsed = coffeeInput.safeParse(fields);
  if (!parsed.success) return validationState(parsed.error);

  let image: Awaited<ReturnType<typeof validateImageUpload>> = null;
  try {
    image = await validateImageUpload(formData.get("image"));
  } catch (error) {
    return { error: "validation", fieldErrors: { image: error instanceof Error ? error.message : "imageInvalid" } };
  }

  let coffeeId: string;
  try {
    const coffee = await saveCoffee(user.id, parsed.data, id);
    coffeeId = coffee.id;
    if (image) await setCoffeeImage(user.id, coffeeId, image);
    else if (formData.get("removeImage") === "on") await setCoffeeImage(user.id, coffeeId, null);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/coffees");
  revalidatePath("/");
  redirect(`/coffees/${coffeeId}`);
}

export async function archiveCoffeeAction(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await setCoffeeArchived(user.id, id, formData.get("archived") === "true");
  revalidatePath("/coffees");
  revalidatePath(`/coffees/${id}`);
}

export async function saveRoasterAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = formData.get("id") ? idSchema.parse(formData.get("id")) : undefined;
  const { id: _id, ...fields } = formObject(formData);
  const parsed = roasterInput.safeParse(fields);
  if (!parsed.success) return validationState(parsed.error);
  let roasterId: string;
  try {
    roasterId = (await saveRoaster(user.id, parsed.data, id)).id;
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/roasters");
  redirect(`/roasters/${roasterId}`);
}

export async function archiveRoasterAction(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await setRoasterArchived(user.id, id, formData.get("archived") === "true");
  revalidatePath("/roasters");
  revalidatePath(`/roasters/${id}`);
}
