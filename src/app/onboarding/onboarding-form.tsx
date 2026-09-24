"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { completeOnboardingAction, type FormState } from "@/server/profile-actions";
import { ProfileFields, type ProfileValues } from "@/components/profile-fields";
import { FormError } from "@/components/form-bits";

export function OnboardingForm({ values }: { values: ProfileValues }) {
  const t = useTranslations("onboarding");
  const common = useTranslations("common");
  const [state, action, pending] = useActionState<FormState, FormData>(completeOnboardingAction, {});

  return (
    <form action={action}>
      <FormError state={state} />
      <ProfileFields values={values} />
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? common("loading") : t("finish")}
      </button>
    </form>
  );
}
