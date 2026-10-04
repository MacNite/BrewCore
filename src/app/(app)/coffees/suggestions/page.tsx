import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { reviewQueue } from "@/server/suggestions";
import { Empty, PageHead } from "@/components/ui";
import { SuggestionList } from "@/components/suggestion-list";

export async function generateMetadata() {
  const t = await getTranslations("suggestions");
  return { title: t("queueTitle") };
}

/** Suggestions on the coffees and roasters the caller added, or all of them for an administrator. */
export default async function SuggestionQueuePage() {
  const user = await requirePageUser();
  const t = await getTranslations("suggestions");
  const queue = await reviewQueue(user);
  return (
    <>
      <PageHead title={t("queueTitle")} subtitle={user.role === "ADMIN" ? t("queueHintAdmin") : t("queueHint")} />
      {queue.length === 0 ? <Empty>{t("queueEmpty")}</Empty> : <SuggestionList suggestions={queue} canDecide showTarget />}
    </>
  );
}
