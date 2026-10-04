import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { COMMON_PROCESSES, getSharedCoffee } from "@/server/shared-coffees";
import { listRoasters } from "@/server/roasters";
import { coffeeGaps } from "@/server/suggestions";
import { PageHead } from "@/components/ui";
import { imageUploadMaxBytes, imageUploadMaxMb } from "@/lib/image-upload-limit";
import { SuggestCoffeeForm } from "./suggest-form";

/**
 * Fills the gaps of a shared coffee someone else added (§7): only its empty
 * fields, and a photo if it has none. The creator or an administrator decides.
 */
export default async function SuggestCoffeePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("coffees");
  const { coffee, canEdit } = await orNotFound(getSharedCoffee(user, id));
  if (canEdit) notFound();
  const gaps = coffeeGaps(coffee);
  const roasters = gaps.includes("roasterName") ? (await listRoasters()).map((r) => r.name) : [];

  return (
    <>
      <PageHead title={t("suggestTitle")} subtitle={t("suggestHint", { name: coffee.name })} />
      <SuggestCoffeeForm
        sharedCoffeeId={coffee.id}
        gaps={gaps}
        allowPhoto={!coffee.imageUpdatedAt}
        roasters={roasters}
        processes={COMMON_PROCESSES}
        maxImageBytes={imageUploadMaxBytes()}
        maxImageMb={imageUploadMaxMb()}
      />
    </>
  );
}
