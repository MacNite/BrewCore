import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getSharedCoffee } from "@/server/shared-coffees";
import { PageHead } from "@/components/ui";
import { CoffeeForm, EMPTY_COFFEE_VALUES } from "../../../coffee-form";
import { coffeeFormContext, sharedFormValues } from "../../../form-data";

/** Edits a shared coffee on its own; only its creator or an administrator. */
export default async function EditSharedCoffeePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("coffees");
  const { coffee, canEdit } = await orNotFound(getSharedCoffee(user, id));
  if (!canEdit) notFound();
  const context = await coffeeFormContext();

  return (
    <>
      <PageHead title={t("editShared")} subtitle={coffee.name} />
      <CoffeeForm {...context} scope="shared" values={{ ...EMPTY_COFFEE_VALUES, ...sharedFormValues(coffee) }} />
    </>
  );
}
