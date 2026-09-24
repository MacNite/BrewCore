/**
 * Bundled grinder models (§9, §82). Upserted by slug with `ownerId = null`.
 * Setting ranges are indicative; users calibrate on their own grinder.
 */
export interface BundledGrinder {
  slug: string;
  manufacturer: string;
  model: string;
  type: "HAND" | "ELECTRIC" | "BUILT_IN";
  burrType: string | null;
  burrDiameterMm: number | null;
  adjustmentType: "CLICK" | "NUMBER" | "STEPLESS" | "MICRON" | "CUSTOM";
  settingUnit: string | null;
  minSetting: number | null;
  maxSetting: number | null;
}

export const BUNDLED_GRINDERS: BundledGrinder[] = [
  { slug: "comandante-c40-mk4", manufacturer: "Comandante", model: "C40 MK4", type: "HAND", burrType: "Conical", burrDiameterMm: 39, adjustmentType: "CLICK", settingUnit: "clicks", minSetting: 0, maxSetting: 40 },
  { slug: "fellow-ode-gen-2", manufacturer: "Fellow", model: "Ode Gen 2", type: "ELECTRIC", burrType: "Flat", burrDiameterMm: 64, adjustmentType: "NUMBER", settingUnit: "setting", minSetting: 1, maxSetting: 11 },
  { slug: "1zpresso-k-ultra", manufacturer: "1Zpresso", model: "K-Ultra", type: "HAND", burrType: "Conical", burrDiameterMm: 48, adjustmentType: "MICRON", settingUnit: "µm", minSetting: 0, maxSetting: 2200 },
  { slug: "niche-zero", manufacturer: "Niche", model: "Zero", type: "ELECTRIC", burrType: "Conical", burrDiameterMm: 63, adjustmentType: "STEPLESS", settingUnit: "number", minSetting: 0, maxSetting: 50 },
  { slug: "df64-gen-2", manufacturer: "DF64", model: "Gen 2", type: "ELECTRIC", burrType: "Flat", burrDiameterMm: 64, adjustmentType: "STEPLESS", settingUnit: "number", minSetting: 0, maxSetting: 90 },
  { slug: "timemore-c3", manufacturer: "Timemore", model: "Chestnut C3", type: "HAND", burrType: "Conical", burrDiameterMm: 38, adjustmentType: "CLICK", settingUnit: "clicks", minSetting: 0, maxSetting: 36 },
  { slug: "baratza-encore", manufacturer: "Baratza", model: "Encore", type: "ELECTRIC", burrType: "Conical", burrDiameterMm: 40, adjustmentType: "NUMBER", settingUnit: "setting", minSetting: 1, maxSetting: 40 },
];
