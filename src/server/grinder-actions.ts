"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "./session";
import { createGrinderModel, grinderModelInput, saveUserGrinder, setUserGrinderArchived, userGrinderInput } from "./grinders";
import { brewerInput, createBrewer, setBrewerArchived } from "./brewers";
import { errorState, formObject, validationState, type FormState } from "./action-state";

const idSchema = z.string().min(1).max(40);

/**
 * Saves a personal grinder. When `grinderModelId` is "custom", a custom model
 * is created first from the `model*` fields, in the same request.
 */
export async function saveGrinderAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = formData.get("id") ? idSchema.parse(formData.get("id")) : undefined;
  const fields = formObject(formData);

  let grinderModelId = String(fields.grinderModelId ?? "");
  if (grinderModelId === "custom") {
    const model = grinderModelInput.safeParse({
      manufacturer: fields.modelManufacturer,
      model: fields.modelName,
      type: fields.modelType,
      burrType: fields.modelBurrType,
      burrDiameterMm: fields.modelBurrDiameterMm,
      adjustmentType: fields.modelAdjustmentType,
      settingUnit: fields.modelSettingUnit,
      minSetting: fields.modelMinSetting,
      maxSetting: fields.modelMaxSetting,
      notes: undefined,
    });
    if (!model.success) {
      const state = validationState(model.error);
      return { ...state, fieldErrors: Object.fromEntries(Object.entries(state.fieldErrors ?? {}).map(([k, v]) => [`model.${k}`, v])) };
    }
    grinderModelId = (await createGrinderModel(user.id, model.data)).id;
  }

  const parsed = userGrinderInput.safeParse({ ...fields, grinderModelId });
  if (!parsed.success) return validationState(parsed.error);
  let grinderId: string;
  try {
    grinderId = (await saveUserGrinder(user.id, parsed.data, id)).id;
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/grinders");
  redirect(`/grinders/${grinderId}`);
}

export async function archiveGrinderAction(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await setUserGrinderArchived(user.id, id, formData.get("archived") === "true");
  revalidatePath("/grinders");
  revalidatePath(`/grinders/${id}`);
}

export async function createBrewerAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = brewerInput.safeParse(formObject(formData));
  if (!parsed.success) return validationState(parsed.error);
  const brewer = await createBrewer(user.id, parsed.data);
  revalidatePath("/brewers");
  redirect(`/brewers/${brewer.id}`);
}

export async function archiveBrewerAction(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await setBrewerArchived(user.id, id, formData.get("archived") === "true");
  revalidatePath("/brewers");
  redirect("/brewers");
}
