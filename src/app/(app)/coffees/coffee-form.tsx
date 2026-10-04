"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveCoffeeAction } from "@/server/coffee-actions";
import type { FormState } from "@/server/action-state";
import { FieldError, FormError, SubmitButton, invalidProps } from "@/components/form-bits";
import { ImageField } from "@/components/image-field";
import { SimilarCoffees } from "./similar-coffees";

export interface CoffeeFormValues {
  /** The bag being edited. */
  id?: string;
  /** The shared coffee: the one a new bag is of, or the one being edited alone. */
  sharedCoffeeId?: string;
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

export const EMPTY_COFFEE_VALUES: CoffeeFormValues = {
  name: "",
  roasterName: "",
  country: "",
  region: "",
  farm: "",
  producer: "",
  varieties: "",
  process: "",
  processingNotes: "",
  altitudeMinMasl: "",
  altitudeMaxMasl: "",
  roastLevel: "UNKNOWN",
  roastDate: "",
  purchaseDate: "",
  openedDate: "",
  bagWeightG: "",
  remainingWeightG: "",
  roasterTastingNotes: "",
  userTags: "",
  description: "",
  notes: "",
  hasImage: false,
};

const ROAST_LEVELS = ["LIGHT", "MEDIUM_LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK", "UNKNOWN"] as const;

/**
 * The coffee form (§7), in two halves: the shared coffee everyone sees and
 * the caller's own bag. `scope` says which halves are shown - and therefore
 * posted; with `bag` only, `sharedSummary` shows the shared coffee read-only.
 */
export function CoffeeForm({
  values,
  scope,
  sharedSummary,
  checkSimilar = false,
  roasters,
  processes,
  maxImageBytes,
  maxImageMb,
}: {
  values: CoffeeFormValues;
  scope: "both" | "bag" | "shared";
  sharedSummary?: React.ReactNode;
  checkSimilar?: boolean;
  roasters: string[];
  processes: string[];
  maxImageBytes: number;
  maxImageMb: number;
}) {
  const t = useTranslations("coffees");
  const common = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveCoffeeAction, {});
  const [name, setName] = useState(values.name);
  const [roasterName, setRoasterName] = useState(values.roasterName);

  const text = (field: keyof CoffeeFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={field}>{label}</label>
      <input id={field} name={field} defaultValue={String(values[field] ?? "")} {...invalidProps(state, field)} {...props} />
      <FieldError state={state} name={field} />
    </div>
  );

  return (
    <form action={action} className="stack" encType="multipart/form-data">
      <FormError state={state} />
      <input type="hidden" name="scope" value={scope} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {values.sharedCoffeeId ? <input type="hidden" name="sharedCoffeeId" value={values.sharedCoffeeId} /> : null}

      {scope === "bag" ? sharedSummary : null}

      {scope !== "bag" ? (
        <section className="card stack" aria-labelledby="shared-heading">
          <div>
            <h2 id="shared-heading">{t("sharedSection")}</h2>
            <p className="small muted">{t("sharedHint")}</p>
          </div>
          {text("name", t("fields.name"), { required: true, maxLength: 160, autoFocus: !values.id && !values.sharedCoffeeId, onChange: (e) => setName(e.target.value) })}
          <div className="field">
            <label htmlFor="roasterName">{t("fields.roaster")}</label>
            <input
              id="roasterName"
              name="roasterName"
              list="roaster-options"
              defaultValue={values.roasterName}
              maxLength={120}
              aria-describedby="roaster-hint"
              onChange={(e) => setRoasterName(e.target.value)}
            />
            <span className="hint" id="roaster-hint">
              {t("fields.roasterHint")}
            </span>
            <datalist id="roaster-options">
              {roasters.map((roaster) => (
                <option key={roaster} value={roaster} />
              ))}
            </datalist>
          </div>
          {checkSimilar ? <SimilarCoffees name={name} roasterName={roasterName} /> : null}
          <div className="row">
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
            {text("country", t("fields.country"), { maxLength: 80 })}
          </div>
          <div className="field">
            <label htmlFor="process">{t("fields.process")}</label>
            <input id="process" name="process" list="process-options" defaultValue={values.process} maxLength={80} />
            <datalist id="process-options">
              {processes.map((process) => (
                <option key={process} value={process} />
              ))}
            </datalist>
          </div>

          <details className="more" open={Boolean(values.region || values.farm || values.producer || values.varieties)}>
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

          <details className="more" open={Boolean(values.roasterTastingNotes || values.description)}>
            <summary>{t("moreDetails")}</summary>
            {text("roasterTastingNotes", t("fields.tastingNotes"), { maxLength: 600, placeholder: t("fields.listPlaceholder") })}
            <div className="field">
              <label htmlFor="description">{t("fields.description")}</label>
              <textarea id="description" name="description" defaultValue={values.description} maxLength={4000} />
            </div>
          </details>

          <div>
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
        </section>
      ) : null}

      {scope !== "shared" ? (
        <section className="card stack" aria-labelledby="bag-heading">
          <div>
            <h2 id="bag-heading">{t("bagSection")}</h2>
            <p className="small muted">{t("bagHint")}</p>
          </div>
          <div className="field">
            <label htmlFor="roastDate">{t("fields.roastDate")}</label>
            <input id="roastDate" name="roastDate" type="date" defaultValue={values.roastDate} {...invalidProps(state, "roastDate")} />
            <FieldError state={state} name="roastDate" />
          </div>
          <div className="row">
            {text("bagWeightG", t("fields.bagWeight"), { inputMode: "decimal" })}
            {text("remainingWeightG", t("fields.remaining"), { inputMode: "decimal" })}
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="purchaseDate">{t("fields.purchaseDate")}</label>
              <input id="purchaseDate" name="purchaseDate" type="date" defaultValue={values.purchaseDate} {...invalidProps(state, "purchaseDate")} />
              <FieldError state={state} name="purchaseDate" />
            </div>
            <div className="field">
              <label htmlFor="openedDate">{t("fields.openedDate")}</label>
              <input id="openedDate" name="openedDate" type="date" defaultValue={values.openedDate} {...invalidProps(state, "openedDate")} />
              <FieldError state={state} name="openedDate" />
            </div>
          </div>
          {text("userTags", t("fields.tags"), { maxLength: 600, placeholder: t("fields.listPlaceholder") })}
          <div className="field">
            <label htmlFor="notes">{t("fields.notes")}</label>
            <textarea id="notes" name="notes" defaultValue={values.notes} maxLength={4000} />
          </div>
        </section>
      ) : null}

      <div className="form-actions">
        <SubmitButton>{common("save")}</SubmitButton>
      </div>
    </form>
  );
}
