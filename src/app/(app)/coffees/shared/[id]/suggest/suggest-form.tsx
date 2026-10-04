"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { suggestCoffeeAction } from "@/server/coffee-actions";
import type { FormState } from "@/server/action-state";
import type { SuggestibleCoffeeField } from "@/server/shared-coffees";
import { FieldError, FormError, SubmitButton, invalidProps } from "@/components/form-bits";
import { ImageField } from "@/components/image-field";

const ROAST_LEVELS = ["LIGHT", "MEDIUM_LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"] as const;

const LABELS: Record<SuggestibleCoffeeField, string> = {
  roasterName: "roaster",
  roastLevel: "roastLevel",
  country: "country",
  region: "region",
  farm: "farm",
  producer: "producer",
  varieties: "varieties",
  process: "process",
  processingNotes: "processingNotes",
  altitudeMinMasl: "altitudeMin",
  altitudeMaxMasl: "altitudeMax",
  roasterTastingNotes: "tastingNotes",
  description: "description",
};

/** Only the empty fields of a shared coffee, and a photo when it has none. */
export function SuggestCoffeeForm({
  sharedCoffeeId,
  gaps,
  allowPhoto,
  roasters,
  processes,
  maxImageBytes,
  maxImageMb,
}: {
  sharedCoffeeId: string;
  gaps: SuggestibleCoffeeField[];
  allowPhoto: boolean;
  roasters: string[];
  processes: string[];
  maxImageBytes: number;
  maxImageMb: number;
}) {
  const t = useTranslations("coffees");
  const s = useTranslations("suggestions");
  const [state, action] = useActionState<FormState, FormData>(suggestCoffeeAction, {});

  if (gaps.length === 0 && !allowPhoto) return <p className="muted">{s("nothingMissing")}</p>;

  const field = (name: SuggestibleCoffeeField) => {
    const label = t(`fields.${LABELS[name]}` as "fields.name");
    let input: React.ReactNode;
    if (name === "roastLevel") {
      input = (
        <select id={name} name={name} defaultValue="UNKNOWN">
          <option value="UNKNOWN">–</option>
          {ROAST_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(`roastLevels.${level}`)}
            </option>
          ))}
        </select>
      );
    } else if (name === "processingNotes" || name === "description") {
      input = <textarea id={name} name={name} maxLength={name === "description" ? 4000 : 2000} />;
    } else {
      const list = name === "roasterName" ? "roaster-options" : name === "process" ? "process-options" : undefined;
      const numeric = name === "altitudeMinMasl" || name === "altitudeMaxMasl";
      const isList = name === "varieties" || name === "roasterTastingNotes";
      input = (
        <input
          id={name}
          name={name}
          list={list}
          inputMode={numeric ? "numeric" : undefined}
          placeholder={isList ? t("fields.listPlaceholder") : undefined}
          maxLength={isList ? 600 : 120}
          {...invalidProps(state, name)}
        />
      );
    }
    return (
      <div className="field" key={name}>
        <label htmlFor={name}>{label}</label>
        {input}
        <FieldError state={state} name={name} />
      </div>
    );
  };

  return (
    <form action={action} className="stack" encType="multipart/form-data">
      <FormError state={state} />
      <input type="hidden" name="sharedCoffeeId" value={sharedCoffeeId} />
      <section className="card stack">
        <p className="small muted">{s("onlyEmpty")}</p>
        {gaps.map(field)}
        <datalist id="roaster-options">
          {roasters.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <datalist id="process-options">
          {processes.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {allowPhoto ? (
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
          </div>
        ) : null}
      </section>
      <div className="form-actions">
        <SubmitButton>{s("send")}</SubmitButton>
      </div>
    </form>
  );
}
