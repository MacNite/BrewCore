import type { z } from "zod";
import { ConflictError, NotFoundError } from "./errors";
import type { FormState } from "./profile-actions";

export type { FormState };

/**
 * Shared shape for Server Action results rendered by `useActionState`. Field
 * errors are message *keys* under `errors.fields`, translated in the form.
 */
export function validationState(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.code === "custom" ? issue.message : issue.code;
  }
  return { error: "validation", fieldErrors };
}

/** Known domain errors become form errors; anything else is a real failure. */
export function errorState(error: unknown): FormState {
  if (error instanceof NotFoundError) return { error: "notFound" };
  if (error instanceof ConflictError) return { error: error.reason };
  throw error;
}

export const formObject = (formData: FormData) => Object.fromEntries(formData) as Record<string, FormDataEntryValue>;
