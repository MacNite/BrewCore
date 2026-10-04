import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { RoastLevel } from "@prisma/client";

export interface SharedFactsCoffee {
  id: string;
  name: string;
  roasterNameSnapshot: string | null;
  roaster?: { id: string; name: string } | null;
  country: string | null;
  region: string | null;
  farm: string | null;
  producer: string | null;
  varieties: string[];
  process: string | null;
  altitudeMinMasl: number | null;
  altitudeMaxMasl: number | null;
  roastLevel: RoastLevel;
  roasterTastingNotes: string[];
  description: string | null;
  imageUpdatedAt: Date | null;
}

export const sharedImageUrl = (coffee: { id: string; imageUpdatedAt: Date | null }) =>
  coffee.imageUpdatedAt ? `/api/shared-coffees/${coffee.id}/image?v=${coffee.imageUpdatedAt.getTime()}` : null;

/** The shared half of a coffee, read-only: photo and facts (§7, §34). */
export async function SharedCoffeeFacts({ coffee, extra = [] }: { coffee: SharedFactsCoffee; extra?: [string, React.ReactNode][] }) {
  const t = await getTranslations("coffees");
  const altitude =
    coffee.altitudeMinMasl !== null || coffee.altitudeMaxMasl !== null ? [coffee.altitudeMinMasl, coffee.altitudeMaxMasl].filter((v) => v !== null).join("–") + " m" : null;
  const facts: [string, React.ReactNode][] = [
    [t("fields.roaster"), coffee.roaster ? <Link href={`/roasters/${coffee.roaster.id}`}>{coffee.roaster.name}</Link> : coffee.roasterNameSnapshot],
    [t("fields.origin"), [coffee.country, coffee.region, coffee.farm].filter(Boolean).join(", ") || null],
    [t("fields.producer"), coffee.producer],
    [t("fields.varieties"), coffee.varieties.join(", ") || null],
    [t("fields.process"), coffee.process],
    [t("fields.altitude"), altitude],
    [t("fields.roastLevel"), coffee.roastLevel === "UNKNOWN" ? null : t(`roastLevels.${coffee.roastLevel}`)],
    [t("fields.tastingNotes"), coffee.roasterTastingNotes.join(", ") || null],
    ...extra,
  ];
  const image = sharedImageUrl(coffee);

  return (
    <>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed-in-only image route
        <img src={image} alt={t("photoAlt", { name: coffee.name })} style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />
      ) : null}
      <dl className="facts">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} style={{ display: "contents" }}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {coffee.description ? <p style={{ whiteSpace: "pre-wrap" }}>{coffee.description}</p> : null}
    </>
  );
}
