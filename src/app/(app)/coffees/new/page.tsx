import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { PageHead } from "@/components/ui";
import { CoffeeForm } from "../coffee-form";
import { coffeeFormContext } from "../form-data";

export async function generateMetadata() {
  const t = await getTranslations("coffees");
  return { title: t("new") };
}

export default async function NewCoffeePage() {
  const user = await requirePageUser();
  const t = await getTranslations("coffees");
  const context = await coffeeFormContext(user.id);
  return (
    <>
      <PageHead title={t("new")} subtitle={t("newHint")} />
      <CoffeeForm
        {...context}
        values={{
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
        }}
      />
    </>
  );
}
