import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { PageHead } from "@/components/ui";
import { GrinderForm } from "../grinder-form";
import { grinderModelOptions } from "../models";

export async function generateMetadata() {
  const t = await getTranslations("grinders");
  return { title: t("add") };
}

export default async function NewGrinderPage() {
  const user = await requirePageUser();
  const t = await getTranslations("grinders");
  const models = await grinderModelOptions(user.id);
  return (
    <>
      <PageHead title={t("add")} subtitle={t("addHint")} />
      <div className="card">
        <GrinderForm
          models={models}
          values={{ grinderModelId: "", nickname: "", burrDescription: "", burrInstallDate: "", zeroPoint: "", calibrationNotes: "", defaultForFilter: false, defaultForEspresso: false }}
        />
      </div>
    </>
  );
}
