"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveRoasterAction } from "@/server/coffee-actions";
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

export function RoasterForm({ values }: { values: RoasterValues }) {
  const t = useTranslations("roasters");
  const common = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveRoasterAction, {});
  return (
    <form action={action}>
      <FormError state={state} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <div className="field">
        <label htmlFor="roaster-name">{t("fields.name")}</label>
        <input id="roaster-name" name="name" defaultValue={values.name} required maxLength={120} {...invalidProps(state, "name")} />
        <FieldError state={state} name="name" />
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="roaster-country">{t("fields.country")}</label>
          <input id="roaster-country" name="country" defaultValue={values.country} maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="roaster-city">{t("fields.city")}</label>
          <input id="roaster-city" name="city" defaultValue={values.city} maxLength={80} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="roaster-website">{t("fields.website")}</label>
        <input id="roaster-website" name="website" type="url" defaultValue={values.website} maxLength={500} placeholder="https://" {...invalidProps(state, "website")} />
        <FieldError state={state} name="website" />
      </div>
      <div className="field">
        <label htmlFor="roaster-notes">{t("fields.notes")}</label>
        <textarea id="roaster-notes" name="notes" defaultValue={values.notes} maxLength={4000} />
      </div>
      <SubmitButton>{common("save")}</SubmitButton>
    </form>
  );
}
