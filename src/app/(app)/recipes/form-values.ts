import { clockText } from "@/lib/brewing/timer";
import type { PlainRecipe } from "@/server/recipes";
import type { RecipeFormValues } from "./recipe-form";

const str = (value: number | null) => (value === null ? "" : String(value));

export function recipeFormValues(recipe: PlainRecipe): RecipeFormValues {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description ?? "",
    brewerId: recipe.brewerId ?? "",
    methodType: recipe.methodType,
    defaultCoffeeDoseG: str(recipe.defaultCoffeeDoseG),
    defaultWaterG: str(recipe.defaultWaterG),
    targetYieldG: str(recipe.targetYieldG),
    waterTemperatureC: str(recipe.waterTemperatureC),
    grindDescription: recipe.grindDescription ?? "",
    targetBrewTime: clockText(recipe.targetBrewTimeSeconds),
    tags: recipe.tags.join(", "),
    sourceName: recipe.sourceName ?? "",
    sourceUrl: recipe.sourceUrl ?? "",
    authorName: recipe.authorName ?? "",
    steps: recipe.steps.map((step) => ({
      type: step.type,
      title: step.title ?? "",
      instruction: step.instruction,
      waterTargetG: str(step.waterTargetG),
      duration: clockText(step.durationSeconds),
      targetElapsed: clockText(step.targetElapsedSeconds),
      targetElapsedMax: clockText(step.targetElapsedMaxSeconds),
      requiresConfirmation: step.requiresConfirmation,
      autoAdvance: step.autoAdvance,
    })),
  };
}

export const emptyRecipeValues: RecipeFormValues = {
  name: "",
  description: "",
  brewerId: "",
  methodType: "POUR_OVER",
  defaultCoffeeDoseG: "20",
  defaultWaterG: "320",
  targetYieldG: "",
  waterTemperatureC: "94",
  grindDescription: "MEDIUM_FINE",
  targetBrewTime: "3:00",
  tags: "",
  sourceName: "",
  sourceUrl: "",
  authorName: "",
  steps: [],
};
