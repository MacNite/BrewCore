import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { brewSetup } from "@/server/brews";
import { PageHead } from "@/components/ui";
import { BrewSetup } from "./brew-setup";

export async function generateMetadata() {
  const t = await getTranslations("setup");
  return { title: t("title") };
}

const id = (value: string | undefined) => (value && value.length <= 40 ? value : undefined);

export default async function NewBrewPage({ searchParams }: { searchParams: Promise<{ coffeeId?: string; recipeId?: string; fromBrewId?: string }> }) {
  const user = await requirePageUser();
  const t = await getTranslations("setup");
  const params = await searchParams;
  const data = await brewSetup(user.id, user.language, { coffeeId: id(params.coffeeId), recipeId: id(params.recipeId), fromBrewId: id(params.fromBrewId) });
  return (
    <>
      <PageHead title={data.prefill.parentBrewId ? t("titleAgain") : t("title")} subtitle={data.prefill.parentBrewId ? t("againHint") : t("subtitle")} />
      <BrewSetup data={data} />
    </>
  );
}
