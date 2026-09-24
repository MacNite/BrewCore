/**
 * The bundled recipe catalogue (§42, §82, §89).
 *
 * These are generic, widely used parameter sets written for BrewCore, not
 * copies of a named author's recipe, so their provenance says exactly that
 * (§43). The seed stores the English text; German users see the German text
 * through `localizeBundledRecipe`, matched by `bundledKey` and step position.
 */
import type { GrindLevel, MethodType, StepType } from "../brewing/recipe";

type Text = { en: string; de: string };

export interface BundledStep {
  type: StepType;
  instruction: Text;
  durationSeconds?: number;
  targetElapsedSeconds?: number;
  targetElapsedMaxSeconds?: number;
  waterTargetG?: number;
  requiresConfirmation?: boolean;
  autoAdvance?: boolean;
}

export interface BundledRecipe {
  key: string;
  brewerSlug: string | null;
  methodType: MethodType;
  name: Text;
  description: Text;
  doseG: number;
  waterG: number;
  targetYieldG?: number;
  temperatureC: number | null;
  grind: GrindLevel;
  targetBrewTimeSeconds: number | null;
  tags: string[];
  steps: BundledStep[];
}

export const BUNDLED_SOURCE_NAME = "BrewCore bundled catalogue";

const prepare = (en: string, de: string): BundledStep => ({ type: "PREPARE", instruction: { en, de }, requiresConfirmation: true });
const addCoffee = (grams: number): BundledStep => ({
  type: "ADD_COFFEE",
  instruction: { en: `Add ${grams} g ground coffee`, de: `${grams} g gemahlenen Kaffee einfüllen` },
  requiresConfirmation: true,
});
const tare: BundledStep = { type: "TARE", instruction: { en: "Tare the scale", de: "Waage tarieren" }, requiresConfirmation: true };
const serve = (en = "Swirl and serve", de = "Schwenken und servieren"): BundledStep => ({ type: "SERVE", instruction: { en, de } });
const pourTo = (grams: number, target: number, autoAdvance = false): BundledStep => ({
  type: "POUR",
  instruction: { en: `Pour to ${grams} g`, de: `Auf ${grams} g aufgießen` },
  waterTargetG: grams,
  targetElapsedSeconds: target,
  autoAdvance,
});

export const BUNDLED_RECIPES: BundledRecipe[] = [
  {
    key: "v60-two-pour",
    brewerSlug: "hario-v60-02",
    methodType: "POUR_OVER",
    name: { en: "V60 Two-Pour", de: "V60 mit zwei Aufgüssen" },
    description: {
      en: "A forgiving everyday V60: bloom, then two main pours. 20 g to 320 g at 1:16.",
      de: "Ein gutmütiger Alltags-V60: Blooming, dann zwei Hauptaufgüsse. 20 g auf 320 g im Verhältnis 1:16.",
    },
    doseG: 20,
    waterG: 320,
    temperatureC: 94,
    grind: "MEDIUM_FINE",
    targetBrewTimeSeconds: 180,
    tags: ["filter", "v60"],
    steps: [
      prepare("Rinse the filter and preheat the brewer", "Filter ausspülen und Brüher vorwärmen"),
      addCoffee(20),
      tare,
      {
        type: "BLOOM",
        instruction: { en: "Bloom: pour to 60 g and let it degas", de: "Blooming: auf 60 g aufgießen und ausgasen lassen" },
        waterTargetG: 60,
        durationSeconds: 45,
        autoAdvance: true,
      },
      pourTo(200, 75, true),
      pourTo(320, 105),
      {
        type: "DRAW_DOWN",
        instruction: { en: "Let it draw down completely", de: "Vollständig durchlaufen lassen" },
        targetElapsedSeconds: 165,
        targetElapsedMaxSeconds: 195,
      },
      serve(),
    ],
  },
  {
    key: "v60-basic",
    brewerSlug: "hario-v60-02",
    methodType: "POUR_OVER",
    name: { en: "Basic V60", de: "V60 Grundrezept" },
    description: {
      en: "The simplest V60: bloom, then one slow continuous pour. 15 g to 250 g.",
      de: "Der einfachste V60: Blooming, dann ein langsamer, gleichmäßiger Aufguss. 15 g auf 250 g.",
    },
    doseG: 15,
    waterG: 250,
    temperatureC: 94,
    grind: "MEDIUM_FINE",
    targetBrewTimeSeconds: 165,
    tags: ["filter", "v60", "beginner"],
    steps: [
      prepare("Rinse the filter and preheat the brewer", "Filter ausspülen und Brüher vorwärmen"),
      addCoffee(15),
      tare,
      {
        type: "BLOOM",
        instruction: { en: "Bloom: pour to 45 g", de: "Blooming: auf 45 g aufgießen" },
        waterTargetG: 45,
        durationSeconds: 40,
        autoAdvance: true,
      },
      {
        type: "POUR",
        instruction: { en: "Pour slowly in circles to 250 g", de: "Langsam kreisend auf 250 g aufgießen" },
        waterTargetG: 250,
        targetElapsedSeconds: 110,
      },
      {
        type: "DRAW_DOWN",
        instruction: { en: "Let it draw down", de: "Durchlaufen lassen" },
        targetElapsedSeconds: 150,
        targetElapsedMaxSeconds: 180,
      },
      serve(),
    ],
  },
  {
    key: "aeropress-standard",
    brewerSlug: "aeropress",
    methodType: "AEROPRESS",
    name: { en: "AeroPress Standard", de: "AeroPress Standard" },
    description: {
      en: "Upright AeroPress, short steep and a gentle press. 15 g to 230 g.",
      de: "AeroPress aufrecht, kurze Ziehzeit und sanftes Pressen. 15 g auf 230 g.",
    },
    doseG: 15,
    waterG: 230,
    temperatureC: 90,
    grind: "MEDIUM",
    targetBrewTimeSeconds: 150,
    tags: ["aeropress"],
    steps: [
      prepare("Rinse the paper filter in the cap", "Papierfilter in der Kappe ausspülen"),
      addCoffee(15),
      tare,
      { type: "POUR", instruction: { en: "Pour to 230 g", de: "Auf 230 g aufgießen" }, waterTargetG: 230, durationSeconds: 15, autoAdvance: true },
      { type: "STIR", instruction: { en: "Stir three times", de: "Dreimal umrühren" }, durationSeconds: 10, autoAdvance: true },
      {
        type: "WAIT",
        instruction: { en: "Insert the plunger and let it steep", de: "Stempel aufsetzen und ziehen lassen" },
        targetElapsedSeconds: 105,
        autoAdvance: true,
      },
      {
        type: "PRESS",
        instruction: { en: "Press gently for about 30 seconds", de: "Etwa 30 Sekunden sanft pressen" },
        targetElapsedSeconds: 135,
        targetElapsedMaxSeconds: 150,
      },
      serve("Serve", "Servieren"),
    ],
  },
  {
    key: "french-press",
    brewerSlug: "french-press",
    methodType: "FRENCH_PRESS",
    name: { en: "French Press", de: "French Press" },
    description: {
      en: "Four-minute immersion, break the crust, skim, then pour. 30 g to 500 g.",
      de: "Vier Minuten Immersion, Kruste brechen, abschöpfen, dann ausgießen. 30 g auf 500 g.",
    },
    doseG: 30,
    waterG: 500,
    temperatureC: 95,
    grind: "COARSE",
    targetBrewTimeSeconds: 300,
    tags: ["immersion"],
    steps: [
      prepare("Preheat the press", "Kanne vorwärmen"),
      addCoffee(30),
      tare,
      { type: "POUR", instruction: { en: "Pour all the water to 500 g", de: "Das gesamte Wasser auf 500 g aufgießen" }, waterTargetG: 500, durationSeconds: 20, autoAdvance: true },
      { type: "WAIT", instruction: { en: "Steep", de: "Ziehen lassen" }, targetElapsedSeconds: 240, autoAdvance: true },
      { type: "BREAK_CRUST", instruction: { en: "Break the crust and skim the foam", de: "Kruste brechen und Schaum abschöpfen" }, durationSeconds: 30 },
      { type: "PRESS", instruction: { en: "Press the plunger down slowly", de: "Stempel langsam herunterdrücken" }, durationSeconds: 20 },
      serve("Pour everything out and serve", "Vollständig ausgießen und servieren"),
    ],
  },
  {
    key: "chemex-classic",
    brewerSlug: "chemex-6-cup",
    methodType: "POUR_OVER",
    name: { en: "Chemex Classic", de: "Chemex Klassisch" },
    description: {
      en: "A larger, cleaner pour-over for two. 30 g to 500 g, coarser than V60.",
      de: "Ein größerer, klarer Pour-over für zwei. 30 g auf 500 g, gröber als beim V60.",
    },
    doseG: 30,
    waterG: 500,
    temperatureC: 94,
    grind: "MEDIUM_COARSE",
    targetBrewTimeSeconds: 270,
    tags: ["filter"],
    steps: [
      prepare("Rinse the thick filter and discard the water", "Dicken Filter ausspülen und Wasser weggießen"),
      addCoffee(30),
      tare,
      { type: "BLOOM", instruction: { en: "Bloom: pour to 90 g", de: "Blooming: auf 90 g aufgießen" }, waterTargetG: 90, durationSeconds: 45, autoAdvance: true },
      pourTo(300, 105, true),
      pourTo(500, 165),
      { type: "DRAW_DOWN", instruction: { en: "Let it draw down", de: "Durchlaufen lassen" }, targetElapsedSeconds: 240, targetElapsedMaxSeconds: 300 },
      serve(),
    ],
  },
  {
    key: "kalita-wave-pulse",
    brewerSlug: "kalita-wave-185",
    methodType: "POUR_OVER",
    name: { en: "Kalita Wave Pulse Pour", de: "Kalita Wave in Pulsen" },
    description: {
      en: "Flat-bottom pour-over in even pulses. 22 g to 350 g.",
      de: "Pour-over mit flachem Boden in gleichmäßigen Pulsen. 22 g auf 350 g.",
    },
    doseG: 22,
    waterG: 350,
    temperatureC: 93,
    grind: "MEDIUM",
    targetBrewTimeSeconds: 210,
    tags: ["filter"],
    steps: [
      prepare("Rinse the filter and preheat", "Filter ausspülen und vorwärmen"),
      addCoffee(22),
      tare,
      { type: "BLOOM", instruction: { en: "Bloom: pour to 50 g", de: "Blooming: auf 50 g aufgießen" }, waterTargetG: 50, durationSeconds: 40, autoAdvance: true },
      pourTo(150, 70, true),
      pourTo(250, 100, true),
      pourTo(350, 130),
      { type: "DRAW_DOWN", instruction: { en: "Let it draw down", de: "Durchlaufen lassen" }, targetElapsedSeconds: 190, targetElapsedMaxSeconds: 220 },
      serve(),
    ],
  },
  {
    key: "clever-dripper",
    brewerSlug: "clever-dripper",
    methodType: "HYBRID",
    name: { en: "Clever Dripper", de: "Clever Dripper" },
    description: {
      en: "Steep, then release onto the cup. Very repeatable. 20 g to 300 g.",
      de: "Ziehen lassen, dann auf die Tasse ablassen. Sehr reproduzierbar. 20 g auf 300 g.",
    },
    doseG: 20,
    waterG: 300,
    temperatureC: 94,
    grind: "MEDIUM",
    targetBrewTimeSeconds: 210,
    tags: ["immersion", "beginner"],
    steps: [
      prepare("Rinse the filter; the valve stays closed", "Filter ausspülen; das Ventil bleibt geschlossen"),
      tare,
      { type: "POUR", instruction: { en: "Pour all the water to 300 g", de: "Das gesamte Wasser auf 300 g aufgießen" }, waterTargetG: 300, durationSeconds: 15, autoAdvance: true },
      addCoffee(20),
      { type: "STIR", instruction: { en: "Stir gently until all grounds are wet", de: "Sanft rühren, bis alles benetzt ist" }, durationSeconds: 10, autoAdvance: true },
      { type: "WAIT", instruction: { en: "Steep with the lid on", de: "Mit Deckel ziehen lassen" }, targetElapsedSeconds: 120, autoAdvance: true },
      {
        type: "DRAW_DOWN",
        instruction: { en: "Place on the cup and let it drain", de: "Auf die Tasse setzen und ablaufen lassen" },
        targetElapsedSeconds: 180,
        targetElapsedMaxSeconds: 210,
      },
      serve("Serve", "Servieren"),
    ],
  },
  {
    key: "espresso-1-2",
    brewerSlug: "espresso-machine",
    methodType: "ESPRESSO",
    name: { en: "Espresso 1:2", de: "Espresso 1:2" },
    description: {
      en: "A classic starting point: 18 g in, 36 g out, in 25–30 seconds.",
      de: "Ein klassischer Ausgangspunkt: 18 g rein, 36 g raus, in 25–30 Sekunden.",
    },
    doseG: 18,
    waterG: 36,
    targetYieldG: 36,
    temperatureC: 93,
    grind: "FINE",
    targetBrewTimeSeconds: 30,
    tags: ["espresso"],
    steps: [
      prepare("Dose 18 g, distribute and tamp", "18 g dosieren, verteilen und tampen"),
      tare,
      {
        type: "POUR",
        instruction: { en: "Start the shot; stop at 36 g", de: "Bezug starten; bei 36 g stoppen" },
        waterTargetG: 36,
        targetElapsedSeconds: 25,
        targetElapsedMaxSeconds: 30,
      },
      serve("Serve", "Servieren"),
    ],
  },
  {
    key: "moka-pot",
    brewerSlug: "moka-pot",
    methodType: "MOKA",
    name: { en: "Moka Pot", de: "Espressokocher" },
    description: {
      en: "Start with hot water, medium heat, and stop before it sputters.",
      de: "Mit heißem Wasser starten, mittlere Hitze, und vor dem Sprudeln stoppen.",
    },
    doseG: 16,
    waterG: 160,
    temperatureC: null,
    grind: "MEDIUM_FINE",
    targetBrewTimeSeconds: 240,
    tags: ["moka"],
    steps: [
      prepare("Fill the base with hot water just below the valve", "Unterteil bis knapp unter das Ventil mit heißem Wasser füllen"),
      { type: "ADD_COFFEE", instruction: { en: "Fill the basket level with 16 g, do not tamp", de: "Sieb mit 16 g eben füllen, nicht tampen" }, requiresConfirmation: true },
      { type: "WAIT", instruction: { en: "Assemble and heat on medium", de: "Zusammenschrauben und bei mittlerer Hitze erhitzen" }, targetElapsedSeconds: 180 },
      {
        type: "STOP",
        instruction: { en: "When it turns pale and gurgles, take it off the heat", de: "Wenn es hell wird und gurgelt, vom Herd nehmen" },
        targetElapsedSeconds: 210,
        targetElapsedMaxSeconds: 240,
      },
      serve("Stir in the pot and serve", "In der Kanne umrühren und servieren"),
    ],
  },
];

const byKey = new Map(BUNDLED_RECIPES.map((recipe) => [recipe.key, recipe]));

/**
 * Shows a bundled recipe's text in the reader's language. Only applies while
 * the stored recipe still has the catalogue's shape (same step count), so a
 * catalogue change can never mislabel steps.
 */
export function localizeBundledRecipe<
  R extends { bundledKey: string | null; name: string; description: string | null; steps?: { instruction: string }[] },
>(recipe: R, locale: "en" | "de"): R {
  if (!recipe.bundledKey || locale === "en") return recipe;
  const bundled = byKey.get(recipe.bundledKey);
  if (!bundled) return recipe;
  const localized = { ...recipe, name: bundled.name[locale], description: bundled.description[locale] };
  if (!recipe.steps) return localized;
  if (bundled.steps.length !== recipe.steps.length) return recipe;
  return { ...localized, steps: recipe.steps.map((step, index) => ({ ...step, instruction: bundled.steps[index].instruction[locale] })) };
}
