"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveRoasterAction, suggestRoasterAction } from "@/server/coffee-actions";
import type { FormState } from "@/server/action-state";
import { FieldError, FormError, SubmitButton, invalidProps } from "@/components/form-bits";

export interface RoasterValues {
  id?: string;
  name: string;
  country: string;
  city: string;
  website: string;
  notes: string;
}

/**
 * Creates or edits a roaster - or, with `suggestFields`, proposes values for
 * the empty fields of a roaster someone else added (§8).
 */
export function RoasterForm({ values, suggestFields }: { values: RoasterValues; suggestFields?: readonly string[] }) {
  const t = useTranslations("roasters");
  const common = useTranslations("common");
  const s = useTranslations("suggestions");
  const [state, action] = useActionState<FormState, FormData>(suggestFields ? suggestRoasterAction : saveRoasterAction, {});
  const shown = (field: string) => !suggestFields || suggestFields.includes(field);
  return (
    <form action={action}>
      <FormError state={state} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {suggestFields ? (
        <p className="small muted">{s("onlyEmpty")}</p>
      ) : (
        <div className="field">
          <label htmlFor="roaster-name">{t("fields.name")}</label>
          <input id="roaster-name" name="name" defaultValue={values.name} required maxLength={120} {...invalidProps(state, "name")} />
          <FieldError state={state} name="name" />
        </div>
      )}
      <div className="row">
        {shown("country") ? (
          <div className="field">
            <label htmlFor="roaster-country">{t("fields.country")}</label>
            <input id="roaster-country" name="country" defaultValue={values.country} maxLength={80} />
          </div>
        ) : null}
        {shown("city") ? (
          <div className="field">
            <label htmlFor="roaster-city">{t("fields.city")}</label>
            <input id="roaster-city" name="city" defaultValue={values.city} maxLength={80} />
          </div>
        ) : null}
      </div>
      {shown("website") ? (
        <div className="field">
          <label htmlFor="roaster-website">{t("fields.website")}</label>
          <input id="roaster-website" name="website" type="url" defaultValue={values.website} maxLength={500} placeholder="https://" {...invalidProps(state, "website")} />
          <FieldError state={state} name="website" />
        </div>
      ) : null}
      {shown("notes") ? (
        <div className="field">
          <label htmlFor="roaster-notes">{t("fields.notes")}</label>
          <textarea id="roaster-notes" name="notes" defaultValue={values.notes} maxLength={4000} />
        </div>
      ) : null}
      <SubmitButton>{suggestFields ? s("send") : common("save")}</SubmitButton>
    </form>
  );
}
