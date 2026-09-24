"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import type { FormState } from "@/server/action-state";

/** Announces a form-level failure to screen readers as soon as it appears. */
export function FormError({ state }: { state: FormState }) {
  const t = useTranslations("errors");
  if (!state.error) return null;
  const known = ["validation", "notFound", "aborted", "completed", "notCompleted", "bundledReadOnly", "tooShort", "tooCommon", "wrongPassword"] as const;
  const key = (known as readonly string[]).includes(state.error) ? (state.error as (typeof known)[number]) : "generic";
  return (
    <div className="notice notice-error" role="alert">
      <span className="notice-icon" aria-hidden="true">
        !
      </span>
      <span>{t(key)}</span>
    </div>
  );
}

const FIELD_ERRORS = [
  "too_small",
  "too_big",
  "invalid_type",
  "invalid_format",
  "invalid_value",
  "url",
  "date",
  "altitudeRange",
  "rangeInvalid",
  "waterDecreasing",
  "waterAboveTotal",
  "timeDecreasing",
  "imageInvalid",
  "imageTooLarge",
  "imageEmpty",
  "invalid",
] as const;

/** A field's error, linked to its input through `id`. */
export function FieldError({ state, name, id }: { state: FormState; name: string; id?: string }) {
  const t = useTranslations("errors.fields");
  const code = state.fieldErrors?.[name];
  if (!code) return null;
  const key = (FIELD_ERRORS as readonly string[]).includes(code) ? (code as (typeof FIELD_ERRORS)[number]) : "invalid";
  return (
    <span className="error" id={id ?? `${name}-error`}>
      {t(key)}
    </span>
  );
}

export function SubmitButton({ children, className = "btn btn-primary", pendingLabel }: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const common = useTranslations("common");
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (pendingLabel ?? common("saving")) : children}
    </button>
  );
}

/** A submit button that asks for confirmation first (archive, delete, abort). */
export function ConfirmSubmit({ children, message, className = "btn btn-danger" }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

/** Props for an input that may carry a field error. */
export const invalidProps = (state: FormState, name: string) =>
  state.fieldErrors?.[name] ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {};
