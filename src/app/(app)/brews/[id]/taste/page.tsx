import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getBrewDetail } from "@/server/brews";
import { PageHead } from "@/components/ui";
import { TASTE_ATTRIBUTES } from "@/lib/brewing/tasting";
import { TastingForm } from "./tasting-form";

export default async function TastePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const t = await getTranslations("tasting");
  const { brew } = await orNotFound(getBrewDetail(user.id, id));
  if (brew.status !== "COMPLETED") redirect(`/brews/${id}`);
  const tasting = brew.tasting;

  return (
    <>
      <PageHead title={t("title")} subtitle={`${brew.coffeeNameSnapshot ?? ""} ${brew.recipeNameSnapshot}`.trim()} />
      <TastingForm
        brewId={brew.id}
        values={{
          rating: tasting?.rating ?? 0,
          wouldBrewAgain: tasting?.wouldBrewAgain ?? null,
          tags: tasting?.tags ?? [],
          notes: tasting?.notes ?? "",
          brewNotes: brew.notes ?? "",
          attributes: Object.fromEntries(TASTE_ATTRIBUTES.map((attr) => [attr, tasting?.[attr] ?? null])),
        }}
      />
    </>
  );
}
