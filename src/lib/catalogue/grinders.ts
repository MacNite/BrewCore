/**
 * Bundled grinder models (§9, §82). Upserted by slug with `ownerId = null`.
 * Setting ranges are indicative; users calibrate on their own grinder.
 *
 * `recommendations` are the manufacturer's starting points per brew method,
 * in the model's `settingUnit`. They are catalogue data, not persisted: the
 * UI looks them up by slug (§9, decision 19).
 */

/** Brew methods a grind chart can name, ordered fine → coarse. */
export const GRIND_METHODS = ["TURKISH", "ESPRESSO", "MOKA", "AEROPRESS", "POUR_OVER", "CHEMEX", "DRIP", "FRENCH_PRESS", "COLD_BREW"] as const;
export type GrindMethod = (typeof GRIND_METHODS)[number];

export interface GrindRecommendation {
  method: GrindMethod;
  min: number;
  max: number;
}

export interface GrindRecommendationSource {
  /** Who publishes the chart, e.g. "Comandante user manual". */
  label: string;
  url: string;
}

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
  recommendations: GrindRecommendation[];
  recommendationSource: GrindRecommendationSource | null;
}

export const BUNDLED_GRINDERS: BundledGrinder[] = [
  { slug: "comandante-c40-mk4", manufacturer: "Comandante", model: "C40 MK4", type: "HAND", burrType: "Conical", burrDiameterMm: 39, adjustmentType: "CLICK", settingUnit: "clicks", minSetting: 0, maxSetting: 40, recommendations: [], recommendationSource: null },
  { slug: "fellow-ode-gen-2", manufacturer: "Fellow", model: "Ode Gen 2", type: "ELECTRIC", burrType: "Flat", burrDiameterMm: 64, adjustmentType: "NUMBER", settingUnit: "setting", minSetting: 1, maxSetting: 11, recommendations: [], recommendationSource: null },
  { slug: "1zpresso-k-ultra", manufacturer: "1Zpresso", model: "K-Ultra", type: "HAND", burrType: "Conical", burrDiameterMm: 48, adjustmentType: "MICRON", settingUnit: "µm", minSetting: 0, maxSetting: 2200, recommendations: [], recommendationSource: null },
  { slug: "niche-zero", manufacturer: "Niche", model: "Zero", type: "ELECTRIC", burrType: "Conical", burrDiameterMm: 63, adjustmentType: "STEPLESS", settingUnit: "number", minSetting: 0, maxSetting: 50, recommendations: [], recommendationSource: null },
  { slug: "df64-gen-2", manufacturer: "DF64", model: "Gen 2", type: "ELECTRIC", burrType: "Flat", burrDiameterMm: 64, adjustmentType: "STEPLESS", settingUnit: "number", minSetting: 0, maxSetting: 90, recommendations: [], recommendationSource: null },
  { slug: "timemore-c3", manufacturer: "Timemore", model: "Chestnut C3", type: "HAND", burrType: "Conical", burrDiameterMm: 38, adjustmentType: "CLICK", settingUnit: "clicks", minSetting: 0, maxSetting: 36, recommendations: [], recommendationSource: null },
  { slug: "baratza-encore", manufacturer: "Baratza", model: "Encore", type: "ELECTRIC", burrType: "Conical", burrDiameterMm: 40, adjustmentType: "NUMBER", settingUnit: "setting", minSetting: 1, maxSetting: 40, recommendations: [], recommendationSource: null },
];

type BrewMethodType = "POUR_OVER" | "IMMERSION" | "HYBRID" | "AEROPRESS" | "ESPRESSO" | "MOKA" | "FRENCH_PRESS" | "COLD_BREW" | "CUPPING" | "OTHER";

/**
 * The grind chart row that applies to a recipe's brew method, if any. Generic
 * immersion, cupping and "other" have no single chart row, so no hint is shown.
 */
const METHOD_TO_GRIND: Partial<Record<BrewMethodType, GrindMethod>> = {
  POUR_OVER: "POUR_OVER",
  HYBRID: "POUR_OVER",
  AEROPRESS: "AEROPRESS",
  ESPRESSO: "ESPRESSO",
  MOKA: "MOKA",
  FRENCH_PRESS: "FRENCH_PRESS",
  COLD_BREW: "COLD_BREW",
};

export function bundledGrinder(slug: string | null | undefined): BundledGrinder | null {
  return (slug && BUNDLED_GRINDERS.find((grinder) => grinder.slug === slug)) || null;
}

/** Manufacturer recommendations of a bundled model, fine → coarse. */
export function grindRecommendations(slug: string | null | undefined): GrindRecommendation[] {
  const grinder = bundledGrinder(slug);
  if (!grinder) return [];
  return [...grinder.recommendations].sort((a, b) => GRIND_METHODS.indexOf(a.method) - GRIND_METHODS.indexOf(b.method));
}

/** The starting range for a recipe brewed on a bundled model, if the manufacturer names one. */
export function recommendedGrind(slug: string | null | undefined, methodType: string | null | undefined): GrindRecommendation | null {
  const method = methodType ? METHOD_TO_GRIND[methodType as BrewMethodType] : undefined;
  if (!method) return null;
  return bundledGrinder(slug)?.recommendations.find((r) => r.method === method) ?? null;
}

/** "18–24 clicks", or "20 clicks" when both ends are equal. */
export function formatGrindRange(recommendation: Pick<GrindRecommendation, "min" | "max">, unit: string | null): string {
  const range = recommendation.min === recommendation.max ? `${recommendation.min}` : `${recommendation.min}–${recommendation.max}`;
  return unit ? `${range} ${unit}` : range;
}
