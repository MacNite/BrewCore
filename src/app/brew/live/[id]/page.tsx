import { getTranslations } from "next-intl/server";
import { orNotFound, requirePageUser } from "@/server/page-guard";
import { getLiveBrew } from "@/server/brews";
import { LiveBrewScreen } from "@/components/live/live-brew";

export async function generateMetadata() {
  const t = await getTranslations("live");
  return { title: t("title") };
}

/** The distraction-free live screen (§20–21). No app shell on purpose. */
export default async function LiveBrewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const brew = await orNotFound(getLiveBrew(user.id, id));
  return <LiveBrewScreen brew={brew} cues={{ sound: user.cueSound, vibration: user.cueVibration }} />;
}
