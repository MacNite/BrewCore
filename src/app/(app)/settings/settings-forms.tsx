"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changePasswordAction, updateProfileAction, type FormState } from "@/server/profile-actions";
import { ProfileFields, type ProfileValues } from "@/components/profile-fields";
import { FormError, SubmitButton } from "@/components/form-bits";

export function ProfileForm({ values }: { values: ProfileValues }) {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(updateProfileAction, {});
  return (
    <form action={action}>
      <FormError state={state} />
      {state.ok ? (
        <p className="notice notice-success" role="status">
          {t("saved")}
        </p>
      ) : null}
      <ProfileFields values={values} />
      <SubmitButton>{common("save")}</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("settings");
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action}>
      <FormError state={state} />
      {state.ok ? (
        <p className="notice notice-success" role="status">
          {t("passwordChanged")}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="currentPassword">{t("currentPassword")}</label>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="newPassword">{t("newPassword")}</label>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <SubmitButton>{t("changePassword")}</SubmitButton>
    </form>
  );
}
