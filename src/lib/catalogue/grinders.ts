/**
 * Bundled grinder models (§9, §82). Upserted by slug with `ownerId = null`.
 * Setting ranges are indicative; users calibrate on their own grinder.
 *
 * `recommendations` are published starting points per brew method, in the
 * model's `settingUnit`, each with its source (manufacturer or a community
 * guide). They are catalogue data, not persisted: the UI looks them up by
 * slug (§9, decision 19).
 */

/** Brew methods a grind chart can name, ordered fine → coarse. */
export const GRIND_METHODS = ["TURKISH", "ESPRESSO", "MOKA", "AEROPRESS", "POUR_OVER", "CHEMEX", "DRIP", "FRENCH_PRESS", "COLD_BREW"] as const;
export type GrindMethod = (typeof GRIND_METHODS)[number];

export interface GrindRecommendationSource {
  /** MANUFACTURER = manual or official site; COMMUNITY = a published third-party grind guide. */
  kind: "MANUFACTURER" | "COMMUNITY";
  label: string;
  url: string;
}

export interface GrindRecommendation {
  method: GrindMethod;
  min: number;
  max: number;
  source: GrindRecommendationSource;
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
}

const source = (kind: GrindRecommendationSource["kind"], label: string, url: string): GrindRecommendationSource => ({ kind, label, url });

const COFFEEDESK_COMANDANTE = source("COMMUNITY", "Coffeedesk: How to set the Comandante grinder", "https://www.coffeedesk.com/blog/how-to-set-the-comandante-grinder/");
const FELLOW_POUR_OVER = source("MANUFACTURER", "Fellow help centre: Ode Gen 2 grind settings", "https://help.fellowproducts.com/hc/en-us/articles/9962302561819");
const FELLOW_AEROPRESS = source("MANUFACTURER", "Fellow: How to brew with an AeroPress", "https://fellowproducts.com/pages/how-to-aeropress");
const FELLOW_DRIP = source("MANUFACTURER", "Fellow help centre: dialing in the Aiden with Ode", "https://help.fellowproducts.com/hc/en-us/articles/29101533994267");
const FELLOW_COLD_BREW = source("MANUFACTURER", "Fellow: How to make cold brew", "https://fellowproducts.com/pages/how-to-cold-brew");
const SQUARE_MILE_ODE = source("COMMUNITY", "Square Mile: How to use the Fellow Ode Gen 2", "https://shop.squaremilecoffee.com/blogs/all/how-to-use-the-fellow-ode-gen-2");
const ONEZPRESSO_POUR_OVER = source("MANUFACTURER", "1Zpresso: Dialing in grind size for pour-over", "https://1zpresso.coffee/how-to-dial-in-the-perfect-grind-size-for-pour-over-coffee/");
const HONEST_K_ULTRA = source("COMMUNITY", "Honest Coffee Guide: 1Zpresso K-Ultra grind settings", "https://honestcoffeeguide.com/1zpresso-k-ultra-grind-settings/");
const NICHE_GUIDE = source("MANUFACTURER", "Niche: The ultimate grind size guide for Niche grinders", "https://www.nichecoffee.co.uk/blogs/exploring-coffee/the-ultimate-grind-size-guide-for-niche-grinders");
const GRINDLOGIC_DF64 = source("COMMUNITY", "Grindlogic: DF64 grind size guide", "https://grindlogic.com.au/blogs/articles/df64-coffee-grinder-grind-size-guide");
const TIMEMORE_MANUAL = source("MANUFACTURER", "Timemore Chestnut C3 user manual", "https://manuals.plus/timemore/c3-chestnut-grinder-manual");
const BARATZA_ENCORE_MANUAL = source("MANUFACTURER", "Baratza Encore operations manual", "https://www.baratza.com/wp-content/uploads/2019/02/manual-encore-en-v4.pdf");
const PORLEX_MINI = source("MANUFACTURER", "Porlex: Mini Grinder II", "https://porlexgrinders.com/products/porlex-mini-grinder-ii");
const PORLEX_TALL = source("MANUFACTURER", "Porlex: Tall Grinder II", "https://porlexgrinders.com/products/porlex-tall-grinder-ii");

const rec = (method: GrindMethod, min: number, max: number, from: GrindRecommendationSource): GrindRecommendation => ({ method, min, max, source: from });

export const BUNDLED_GRINDERS: BundledGrinder[] = [
  {
    slug: "comandante-c40-mk4", manufacturer: "Comandante", model: "C40 MK4", type: "HAND", burrType: "Conical", burrDiameterMm: 39, adjustmentType: "CLICK", settingUnit: "clicks", minSetting: 0, maxSetting: 40,
    // Comandante publishes its click chart only in the printed manual.
    recommendations: [
      rec("TURKISH", 5, 10, COFFEEDESK_COMANDANTE),
      rec("ESPRESSO", 10, 15, COFFEEDESK_COMANDANTE),
      rec("MOKA", 16, 21, COFFEEDESK_COMANDANTE),
      rec("AEROPRESS", 15, 20, COFFEEDESK_COMANDANTE),
      rec("POUR_OVER", 22, 28, COFFEEDESK_COMANDANTE),
      rec("FRENCH_PRESS", 28, 34, COFFEEDESK_COMANDANTE),
    ],
  },
  {
    slug: "fellow-ode-gen-2", manufacturer: "Fellow", model: "Ode Gen 2", type: "ELECTRIC", burrType: "Flat", burrDiameterMm: 64, adjustmentType: "NUMBER", settingUnit: "setting", minSetting: 1, maxSetting: 11,
    // Brewed coffee only: Fellow does not support espresso on the Ode Gen 2.
    recommendations: [
      rec("AEROPRESS", 4, 4, FELLOW_AEROPRESS),
      rec("POUR_OVER", 5, 5, FELLOW_POUR_OVER),
      rec("DRIP", 9, 10, FELLOW_DRIP),
      rec("FRENCH_PRESS", 7, 9, SQUARE_MILE_ODE),
      rec("COLD_BREW", 7, 10, FELLOW_COLD_BREW),
    ],
  },
  {
    slug: "1zpresso-k-ultra", manufacturer: "1Zpresso", model: "K-Ultra", type: "HAND", burrType: "Conical", burrDiameterMm: 48, adjustmentType: "MICRON", settingUnit: "µm", minSetting: 0, maxSetting: 2200,
    // 20 µm burr travel per click, 100 clicks per rotation: 0.8.0 = 80 clicks = 1600 µm.
    recommendations: [
      rec("ESPRESSO", 480, 1000, HONEST_K_ULTRA),
      rec("AEROPRESS", 1200, 1600, HONEST_K_ULTRA),
      rec("POUR_OVER", 1600, 1800, ONEZPRESSO_POUR_OVER),
      rec("FRENCH_PRESS", 2000, 2000, HONEST_K_ULTRA),
    ],
  },
  {
    slug: "niche-zero", manufacturer: "Niche", model: "Zero", type: "ELECTRIC", burrType: "Conical", burrDiameterMm: 63, adjustmentType: "STEPLESS", settingUnit: "number", minSetting: 0, maxSetting: 50,
    recommendations: [
      rec("ESPRESSO", 5, 20, NICHE_GUIDE),
      rec("MOKA", 20, 30, NICHE_GUIDE),
      rec("AEROPRESS", 20, 30, NICHE_GUIDE),
      rec("POUR_OVER", 35, 50, NICHE_GUIDE),
      rec("FRENCH_PRESS", 45, 50, NICHE_GUIDE),
    ],
  },
  {
    slug: "df64-gen-2", manufacturer: "DF64", model: "Gen 2", type: "ELECTRIC", burrType: "Flat", burrDiameterMm: 64, adjustmentType: "STEPLESS", settingUnit: "number", minSetting: 0, maxSetting: 90,
    // DF publishes no chart and calls its dial "for reference only"; zero points vary per unit.
    recommendations: [
      rec("ESPRESSO", 5, 17, GRINDLOGIC_DF64),
      rec("MOKA", 17, 25, GRINDLOGIC_DF64),
      rec("AEROPRESS", 25, 40, GRINDLOGIC_DF64),
      rec("POUR_OVER", 40, 55, GRINDLOGIC_DF64),
      rec("FRENCH_PRESS", 55, 65, GRINDLOGIC_DF64),
    ],
  },
  {
    slug: "timemore-c3", manufacturer: "Timemore", model: "Chestnut C3", type: "HAND", burrType: "Conical", burrDiameterMm: 38, adjustmentType: "CLICK", settingUnit: "clicks", minSetting: 0, maxSetting: 36,
    // The manual advises against grinding below 6 clicks.
    recommendations: [
      rec("ESPRESSO", 6, 12, TIMEMORE_MANUAL),
      rec("POUR_OVER", 15, 24, TIMEMORE_MANUAL),
      rec("FRENCH_PRESS", 24, 24, TIMEMORE_MANUAL),
    ],
  },
  {
    slug: "baratza-encore", manufacturer: "Baratza", model: "Encore", type: "ELECTRIC", burrType: "Conical", burrDiameterMm: 40, adjustmentType: "NUMBER", settingUnit: "setting", minSetting: 1, maxSetting: 40,
    recommendations: [
      rec("ESPRESSO", 8, 8, BARATZA_ENCORE_MANUAL),
      rec("AEROPRESS", 12, 12, BARATZA_ENCORE_MANUAL),
      rec("POUR_OVER", 15, 15, BARATZA_ENCORE_MANUAL),
      rec("DRIP", 18, 18, BARATZA_ENCORE_MANUAL),
      rec("CHEMEX", 20, 20, BARATZA_ENCORE_MANUAL),
      rec("FRENCH_PRESS", 28, 28, BARATZA_ENCORE_MANUAL),
    ],
  },
  {
    // Ceramic conical burr shared with the Tall II; 16 clicks per rotation. Porlex
    // publishes no burr diameter and no upper click limit.
    slug: "porlex-mini-ii", manufacturer: "Porlex", model: "Mini II", type: "HAND", burrType: "Conical (ceramic)", burrDiameterMm: null, adjustmentType: "CLICK", settingUnit: "clicks", minSetting: 0, maxSetting: null,
    recommendations: [rec("POUR_OVER", 9, 11, PORLEX_MINI)],
  },
  {
    slug: "porlex-tall-ii", manufacturer: "Porlex", model: "Tall II", type: "HAND", burrType: "Conical (ceramic)", burrDiameterMm: null, adjustmentType: "CLICK", settingUnit: "clicks", minSetting: 0, maxSetting: null,
    recommendations: [rec("POUR_OVER", 9, 11, PORLEX_TALL)],
  },
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
