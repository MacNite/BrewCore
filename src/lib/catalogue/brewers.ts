/** Bundled brewers (§12, §82). Upserted by slug with `ownerId = null`. */
export interface BundledBrewer {
  slug: string;
  manufacturer: string | null;
  model: string;
  methodType: "POUR_OVER" | "IMMERSION" | "HYBRID" | "AEROPRESS" | "ESPRESSO" | "MOKA" | "FRENCH_PRESS" | "COLD_BREW" | "CUPPING" | "OTHER";
  capacityMl: number | null;
}

export const BUNDLED_BREWERS: BundledBrewer[] = [
  { slug: "hario-v60-02", manufacturer: "Hario", model: "V60 02", methodType: "POUR_OVER", capacityMl: 700 },
  { slug: "aeropress", manufacturer: "AeroPress", model: "AeroPress", methodType: "AEROPRESS", capacityMl: 250 },
  { slug: "chemex-6-cup", manufacturer: "Chemex", model: "6 Cup", methodType: "POUR_OVER", capacityMl: 900 },
  { slug: "kalita-wave-185", manufacturer: "Kalita", model: "Wave 185", methodType: "POUR_OVER", capacityMl: 750 },
  { slug: "clever-dripper", manufacturer: "Clever", model: "Dripper", methodType: "HYBRID", capacityMl: 500 },
  { slug: "french-press", manufacturer: null, model: "French Press", methodType: "FRENCH_PRESS", capacityMl: 1000 },
  { slug: "moka-pot", manufacturer: null, model: "Moka Pot", methodType: "MOKA", capacityMl: 300 },
  { slug: "espresso-machine", manufacturer: null, model: "Espresso Machine", methodType: "ESPRESSO", capacityMl: null },
  { slug: "origami-dripper-m", manufacturer: "Origami", model: "Dripper M", methodType: "POUR_OVER", capacityMl: 600 },
  { slug: "april-brewer", manufacturer: "April", model: "Brewer", methodType: "POUR_OVER", capacityMl: 600 },
  { slug: "orea-v4", manufacturer: "Orea", model: "V4", methodType: "POUR_OVER", capacityMl: 600 },
];
