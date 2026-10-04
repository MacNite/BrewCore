import { listRoasters } from "@/server/roasters";
import { COMMON_PROCESSES } from "@/server/coffees";
import { imageUploadMaxBytes, imageUploadMaxMb } from "@/lib/image-upload-limit";
import { dateInputValue } from "@/lib/format";
import { num } from "@/lib/decimal";
import type { CoffeeFormValues } from "./coffee-form";
import type { SharedCoffee } from "@prisma/client";

/** What every coffee form needs besides the values. */
export async function coffeeFormContext() {
  const roasters = await listRoasters();
  return {
    roasters: roasters.map((r) => r.name),
    processes: COMMON_PROCESSES,
    maxImageBytes: imageUploadMaxBytes(),
    maxImageMb: imageUploadMaxMb(),
  };
}

const str = (value: number | null) => (value === null ? "" : String(value));

/** The shared half of the form values. */
export const sharedFormValues = (coffee: Omit<SharedCoffee, "imageData">) => ({
  sharedCoffeeId: coffee.id,
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
  roasterTastingNotes: coffee.roasterTastingNotes.join(", "),
  description: coffee.description ?? "",
  hasImage: Boolean(coffee.imageUpdatedAt),
});

/** The bag half of the form values. */
export const bagFormValues = (bag: {
  id: string;
  roastDate: Date | null;
  purchaseDate: Date | null;
  openedDate: Date | null;
  bagWeightG: Parameters<typeof num>[0];
  remainingWeightG: Parameters<typeof num>[0];
  userTags: string[];
  notes: string | null;
}): Partial<CoffeeFormValues> => ({
  id: bag.id,
  roastDate: dateInputValue(bag.roastDate),
  purchaseDate: dateInputValue(bag.purchaseDate),
  openedDate: dateInputValue(bag.openedDate),
  bagWeightG: str(num(bag.bagWeightG)),
  remainingWeightG: str(num(bag.remainingWeightG)),
  userTags: bag.userTags.join(", "),
  notes: bag.notes ?? "",
});
