import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getSharedCoffee } from "@/server/shared-coffees";
import { PageHead } from "@/components/ui";
import { CoffeeForm, EMPTY_COFFEE_VALUES } from "../coffee-form";
import { coffeeFormContext } from "../form-data";
import { SharedCoffeeFacts } from "../shared-facts";

export async function generateMetadata() {
  const t = await getTranslations("coffees");
  return { title: t("new") };
}

/**
 * A new coffee (§7): either a new shared coffee together with the first bag
 * of it, or - with `?shared=` - a new bag of a coffee already in the shared
 * catalogue.
 */
export default async function NewCoffeePage({ searchParams }: { searchParams: Promise<{ shared?: string }> }) {
  const user = await requirePageUser();
  const t = await getTranslations("coffees");
  const sharedId = (await searchParams).shared;
  const context = await coffeeFormContext();

  if (sharedId) {
    const { coffee } = await orNotFound(getSharedCoffee(user, sharedId.slice(0, 40)));
    return (
      <>
        <PageHead title={t("newBag")} subtitle={t("newBagHint", { name: coffee.name })} />
        <CoffeeForm
          {...context}
          scope="bag"
          values={{ ...EMPTY_COFFEE_VALUES, sharedCoffeeId: coffee.id }}
          sharedSummary={
            <section className="card" aria-labelledby="shared-heading">
              <h2 id="shared-heading">{coffee.name}</h2>
              <SharedCoffeeFacts coffee={coffee} />
              <p className="small">
                <Link href="/coffees/new">{t("notThisOne")}</Link>
              </p>
            </section>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHead title={t("new")} subtitle={t("newHint")} />
      <CoffeeForm {...context} scope="both" checkSimilar values={EMPTY_COFFEE_VALUES} />
    </>
  );
}
