import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getCoffee } from "@/server/coffees";
import { PageHead } from "@/components/ui";
import { CoffeeForm, EMPTY_COFFEE_VALUES } from "../../coffee-form";
import { bagFormValues, coffeeFormContext, sharedFormValues } from "../../form-data";
import { SharedCoffeeFacts } from "../../shared-facts";

/**
 * Edits a bag. Its creator (or an administrator) edits the shared coffee in
 * the same form; anyone else sees it read-only, with a way to fill its gaps.
 */
export default async function EditCoffeePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("coffees");
  const coffee = await orNotFound(getCoffee(user, id));
  const context = await coffeeFormContext();
  const shared = coffee.sharedCoffee;
  const values = { ...EMPTY_COFFEE_VALUES, ...sharedFormValues(shared), ...bagFormValues(coffee) };

  return (
    <>
      <PageHead title={t("edit")} subtitle={shared.name} />
      {coffee.canEditShared ? (
        <CoffeeForm {...context} scope="both" values={values} />
      ) : (
        <CoffeeForm
          {...context}
          scope="bag"
          values={{ ...values, sharedCoffeeId: undefined }}
          sharedSummary={
            <section className="card" aria-labelledby="shared-heading">
              <h2 id="shared-heading">{shared.name}</h2>
              <p className="small muted">{t("sharedReadOnly")}</p>
              <SharedCoffeeFacts coffee={shared} />
              <p>
                <Link className="btn" href={`/coffees/shared/${shared.id}/suggest`}>
                  {t("suggestMissing")}
                </Link>
              </p>
            </section>
          }
        />
      )}
    </>
  );
}
