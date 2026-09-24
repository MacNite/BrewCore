"use client";

import { useTranslations } from "next-intl";
import { LOCALE_LABELS, LOCALES } from "@/i18n/locales";

export interface ProfileValues {
  displayName: string;
  language: string;
  cueSound: boolean;
  cueVibration: boolean;
}

export function ProfileFields({ values }: { values: ProfileValues }) {
  const t = useTranslations("settings");
  return (
    <>
      <div className="field">
        <label htmlFor="displayName">{t("displayName")}</label>
        <input id="displayName" name="displayName" defaultValue={values.displayName} required maxLength={80} autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="language">{t("language")}</label>
        <select id="language" name="language" defaultValue={values.language}>
          {LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_LABELS[locale]}
            </option>
          ))}
        </select>
      </div>
      <fieldset>
        <legend>{t("cues")}</legend>
        <p className="hint muted small" style={{ marginTop: 0 }}>
          {t("cuesHint")}
        </p>
        <label className="check">
          <input type="checkbox" name="cueSound" defaultChecked={values.cueSound} /> {t("cueSound")}
        </label>
        <label className="check">
          <input type="checkbox" name="cueVibration" defaultChecked={values.cueVibration} /> {t("cueVibration")}
        </label>
      </fieldset>
      <div style={{ height: 14 }} />
    </>
  );
}
