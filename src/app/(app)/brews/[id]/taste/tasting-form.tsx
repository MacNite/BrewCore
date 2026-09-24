"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveTastingAction } from "@/server/brew-actions";
import type { FormState } from "@/server/action-state";
import { FormError, SubmitButton } from "@/components/form-bits";
import { TASTE_ATTRIBUTES, TASTE_TAGS } from "@/lib/brewing/tasting";

export interface TastingValues {
  rating: number;
  wouldBrewAgain: boolean | null;
  tags: string[];
  notes: string;
  brewNotes: string;
  attributes: Record<string, number | null>;
}

export function TastingForm({ brewId, values }: { brewId: string; values: TastingValues }) {
  const t = useTranslations("tasting");
  const tags = useTranslations("tasteTags");
  const common = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveTastingAction, {});
  const [rating, setRating] = useState(values.rating);

  return (
    <form action={action} className="stack">
      <FormError state={state} />
      <input type="hidden" name="brewId" value={brewId} />
      <div className="card stack">
        <fieldset className="stars">
          <legend>{t("rating")}</legend>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className={value <= rating ? "on" : undefined}>
              <input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} required />
              <span aria-hidden="true">{value <= rating ? "★" : "☆"}</span>
              <span className="sr-only">{t("ratingOf", { rating: value })}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="chip-group">
          <legend>{t("wouldBrewAgain")}</legend>
          {[
            ["yes", t("yes")],
            ["no", t("no")],
            ["", t("unsure")],
          ].map(([value, label]) => (
            <label key={value} className="chip">
              <input type="radio" name="wouldBrewAgain" value={value} defaultChecked={(values.wouldBrewAgain === true ? "yes" : values.wouldBrewAgain === false ? "no" : "") === value} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="chip-group">
          <legend>{t("tags")}</legend>
          {TASTE_TAGS.map((tag) => (
            <label key={tag} className="chip">
              <input type="checkbox" name="tags" value={tag} defaultChecked={values.tags.includes(tag)} />
              <span>{tags(tag)}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <details className="more card" open={Object.values(values.attributes).some((v) => v !== null)}>
        <summary>{t("detailed")}</summary>
        <div className="grid grid-2">
          {TASTE_ATTRIBUTES.map((attr) => (
            <div key={attr} className="field">
              <label htmlFor={attr}>{t(`attributes.${attr}`)}</label>
              <select id={attr} name={attr} defaultValue={values.attributes[attr] ?? ""}>
                <option value="">–</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </details>

      <div className="card">
        <div className="field">
          <label htmlFor="notes">{t("notes")}</label>
          <textarea id="notes" name="notes" defaultValue={values.notes} maxLength={4000} />
        </div>
        <div className="field">
          <label htmlFor="brewNotes">{t("brewNotes")}</label>
          <textarea id="brewNotes" name="brewNotes" defaultValue={values.brewNotes} maxLength={4000} />
        </div>
      </div>
      <div className="form-actions">
        <SubmitButton>{common("save")}</SubmitButton>
      </div>
    </form>
  );
}
