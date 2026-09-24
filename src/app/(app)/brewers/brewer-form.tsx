"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createBrewerAction } from "@/server/grinder-actions";
import type { FormState } from "@/server/action-state";
import { FieldError, FormError, SubmitButton, invalidProps } from "@/components/form-bits";
import { METHOD_TYPES } from "@/lib/brewing/recipe";

export function BrewerForm() {
  const t = useTranslations("brewers");
  const methods = useTranslations("methods");
  const common = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(createBrewerAction, {});
  return (
    <form action={action}>
      <FormError state={state} />
      <div className="row">
        <div className="field">
          <label htmlFor="brewer-manufacturer">{t("fields.manufacturer")}</label>
          <input id="brewer-manufacturer" name="manufacturer" maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="brewer-model">{t("fields.model")}</label>
          <input id="brewer-model" name="model" required maxLength={120} {...invalidProps(state, "model")} />
          <FieldError state={state} name="model" />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="brewer-method">{t("fields.method")}</label>
          <select id="brewer-method" name="methodType" defaultValue="POUR_OVER">
            {METHOD_TYPES.map((method) => (
              <option key={method} value={method}>
                {methods(method)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="brewer-capacity">{t("fields.capacity")}</label>
          <input id="brewer-capacity" name="capacityMl" inputMode="numeric" {...invalidProps(state, "capacityMl")} />
          <FieldError state={state} name="capacityMl" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="brewer-description">{t("fields.description")}</label>
        <textarea id="brewer-description" name="description" maxLength={2000} />
      </div>
      <SubmitButton>{common("save")}</SubmitButton>
    </form>
  );
}
