import { getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getCoffee } from "@/server/coffees";
import { PageHead } from "@/components/ui";
import { dateInputValue } from "@/lib/format";
import { num } from "@/lib/decimal";
import { CoffeeForm } from "../../coffee-form";
import { coffeeFormContext } from "../../form-data";

export default async function EditCoffeePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("coffees");
  const coffee = await orNotFound(getCoffee(user.id, id));
  const context = await coffeeFormContext(user.id);
  const str = (value: number | null) => (value === null ? "" : String(value));

  return (
    <>
      <PageHead title={t("edit")} subtitle={coffee.name} />
      <CoffeeForm
        {...context}
        values={{
          id: coffee.id,
          name: coffee.name,
          roasterName: coffee.roasterNameSnapshot ?? "",
          country: coffee.country ?? "",
          region: coffee.region ?? "",
          farm: coffee.farm ?? "",
          producer: coffee.producer ?? "",
          varieties: coffee.varieties.join(", "),
          process: coffee.process ?? "",
          processingNotes: coffee.processingNotes ?? "",
          altitudeMinMasl: str(coffee.altitudeMinMasl),
          altitudeMaxMasl: str(coffee.altitudeMaxMasl),
          roastLevel: coffee.roastLevel,
          roastDate: dateInputValue(coffee.roastDate),
          purchaseDate: dateInputValue(coffee.purchaseDate),
          openedDate: dateInputValue(coffee.openedDate),
          bagWeightG: str(num(coffee.bagWeightG)),
          remainingWeightG: str(num(coffee.remainingWeightG)),
          roasterTastingNotes: coffee.roasterTastingNotes.join(", "),
          userTags: coffee.userTags.join(", "),
          description: coffee.description ?? "",
          notes: coffee.notes ?? "",
          hasImage: Boolean(coffee.imageUpdatedAt),
        }}
      />
    </>
  );
}
