"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveCoffeeAction } from "@/server/coffee-actions";
import type { FormState } from "@/server/action-state";
import { FieldError, FormError, SubmitButton, invalidProps } from "@/components/form-bits";
import { ImageField } from "@/components/image-field";

export interface CoffeeFormValues {
  id?: string;
  name: string;
  roasterName: string;
  country: string;
  region: string;
  farm: string;
  producer: string;
  varieties: string;
  process: string;
  processingNotes: string;
  altitudeMinMasl: string;
  altitudeMaxMasl: string;
  roastLevel: string;
  roastDate: string;
  purchaseDate: string;
  openedDate: string;
  bagWeightG: string;
  remainingWeightG: string;
  roasterTastingNotes: string;
  userTags: string;
  description: string;
  notes: string;
  hasImage: boolean;
}

const ROAST_LEVELS = ["LIGHT", "MEDIUM_LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK", "UNKNOWN"] as const;

export function CoffeeForm({
  values,
  roasters,
  processes,
  maxImageBytes,
  maxImageMb,
}: {
  values: CoffeeFormValues;
  roasters: string[];
  processes: string[];
  maxImageBytes: number;
  maxImageMb: number;
}) {
  const t = useTranslations("coffees");
  const common = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveCoffeeAction, {});

  const text = (name: keyof CoffeeFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={String(values[name] ?? "")} {...invalidProps(state, name)} {...props} />
      <FieldError state={state} name={name} />
    </div>
  );

  return (
    <form action={action} className="stack" encType="multipart/form-data">
      <FormError state={state} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="card stack">
        {text("name", t("fields.name"), { required: true, maxLength: 160, autoFocus: !values.id })}
        <div className="field">
          <label htmlFor="roasterName">{t("fields.roaster")}</label>
          <input id="roasterName" name="roasterName" list="roaster-options" defaultValue={values.roasterName} maxLength={120} aria-describedby="roaster-hint" />
          <span className="hint" id="roaster-hint">
            {t("fields.roasterHint")}
          </span>
          <datalist id="roaster-options">
            {roasters.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="roastDate">{t("fields.roastDate")}</label>
            <input id="roastDate" name="roastDate" type="date" defaultValue={values.roastDate} {...invalidProps(state, "roastDate")} />
            <FieldError state={state} name="roastDate" />
          </div>
          <div className="field">
            <label htmlFor="roastLevel">{t("fields.roastLevel")}</label>
            <select id="roastLevel" name="roastLevel" defaultValue={values.roastLevel || "UNKNOWN"}>
              {ROAST_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {t(`roastLevels.${level}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          {text("country", t("fields.country"), { maxLength: 80 })}
          <div className="field">
            <label htmlFor="process">{t("fields.process")}</label>
            <input id="process" name="process" list="process-options" defaultValue={values.process} maxLength={80} />
            <datalist id="process-options">
              {processes.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="row">
          {text("bagWeightG", t("fields.bagWeight"), { inputMode: "decimal" })}
          {text("remainingWeightG", t("fields.remaining"), { inputMode: "decimal" })}
        </div>
      </div>

      <details className="more card" open={Boolean(values.region || values.farm || values.producer || values.varieties)}>
        <summary>{t("originDetails")}</summary>
        <div className="row">
          {text("region", t("fields.region"), { maxLength: 120 })}
          {text("farm", t("fields.farm"), { maxLength: 120 })}
        </div>
        <div className="row">
          {text("producer", t("fields.producer"), { maxLength: 120 })}
          {text("varieties", t("fields.varieties"), { maxLength: 400 })}
        </div>
        <div className="row">
          {text("altitudeMinMasl", t("fields.altitudeMin"), { inputMode: "numeric" })}
          {text("altitudeMaxMasl", t("fields.altitudeMax"), { inputMode: "numeric" })}
        </div>
        <div className="field">
          <label htmlFor="processingNotes">{t("fields.processingNotes")}</label>
          <textarea id="processingNotes" name="processingNotes" defaultValue={values.processingNotes} maxLength={2000} />
        </div>
      </details>

      <details className="more card" open={Boolean(values.roasterTastingNotes || values.notes || values.purchaseDate)}>
        <summary>{t("moreDetails")}</summary>
        {text("roasterTastingNotes", t("fields.tastingNotes"), { maxLength: 600, placeholder: t("fields.listPlaceholder") })}
        {text("userTags", t("fields.tags"), { maxLength: 600, placeholder: t("fields.listPlaceholder") })}
        <div className="row">
          <div className="field">
            <label htmlFor="purchaseDate">{t("fields.purchaseDate")}</label>
            <input id="purchaseDate" name="purchaseDate" type="date" defaultValue={values.purchaseDate} />
          </div>
          <div className="field">
            <label htmlFor="openedDate">{t("fields.openedDate")}</label>
            <input id="openedDate" name="openedDate" type="date" defaultValue={values.openedDate} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="description">{t("fields.description")}</label>
          <textarea id="description" name="description" defaultValue={values.description} maxLength={4000} />
        </div>
        <div className="field">
          <label htmlFor="notes">{t("fields.notes")}</label>
          <textarea id="notes" name="notes" defaultValue={values.notes} maxLength={4000} />
        </div>
      </details>

      <div className="card">
        <ImageField
          id="image"
          name="image"
          label={t("fields.photo")}
          hint={t("fields.photoHint", { mb: maxImageMb })}
          maxBytes={maxImageBytes}
          shrinkingLabel={t("fields.photoShrinking")}
          tooLargeLabel={t("fields.photoTooLarge", { mb: maxImageMb })}
        />
        <FieldError state={state} name="image" />
        {values.hasImage ? (
          <label className="check">
            <input type="checkbox" name="removeImage" /> {t("fields.removePhoto")}
          </label>
        ) : null}
      </div>

      <div className="form-actions">
        <SubmitButton>{common("save")}</SubmitButton>
      </div>
    </form>
  );
}
