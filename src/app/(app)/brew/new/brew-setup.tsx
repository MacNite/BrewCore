"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { startBrewAction } from "@/server/brew-actions";
import type { FormState } from "@/server/action-state";
import type { BrewSetupData } from "@/server/brews";
import { FieldError, FormError, SubmitButton, invalidProps } from "@/components/form-bits";
import { scaleRecipe, displayGrams } from "@/lib/brewing/scaling";
import { formatRatio, ratioOf } from "@/lib/brewing/ratio";
import { estimateDurationSeconds, type StepType } from "@/lib/brewing/recipe";
import { formatSeconds } from "@/lib/brewing/timer";
import { formatGrindRange, recommendedGrind } from "@/lib/catalogue/grinders";

const parse = (value: string) => {
  const text = value.trim().replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const show = (value: number | null) => (value === null ? "" : String(value));

export function BrewSetup({ data }: { data: BrewSetupData }) {
  const t = useTranslations("setup");
  const stepTypes = useTranslations("stepTypes");
  const grinds = useTranslations("grind");
  const grindMethods = useTranslations("grindMethods");
  const locale = useLocale();
  const sep = locale === "de" ? "," : ".";
  const [state, action] = useActionState<FormState, FormData>(startBrewAction, {});
  const { prefill } = data;

  const [recipeId, setRecipeId] = useState(prefill.recipeId ?? "");
  const [coffeeId, setCoffeeId] = useState(prefill.coffeeId ?? "");
  const [grinderId, setGrinderId] = useState(prefill.userGrinderId ?? "");
  const [brewerId, setBrewerId] = useState(prefill.brewerId ?? "");
  const recipe = data.recipes.find((r) => r.id === recipeId) ?? null;

  const [dose, setDose] = useState(show(prefill.coffeeDoseG ?? recipe?.defaultCoffeeDoseG ?? null));
  const [water, setWater] = useState(show(prefill.waterTargetG ?? recipe?.defaultWaterG ?? null));
  // Brew Again keeps the previous water exactly; a fresh setup follows the ratio.
  const [waterOverride, setWaterOverride] = useState(prefill.parentBrewId !== null && prefill.waterTargetG !== null);
  const [temperature, setTemperature] = useState(show(prefill.waterTemperatureC ?? recipe?.waterTemperatureC ?? null));
  const [grindText, setGrindText] = useState(prefill.grindSettingText ?? "");
  const [grindNumeric, setGrindNumeric] = useState(show(prefill.grindSettingNumeric));
  const [grindUnit, setGrindUnit] = useState(prefill.grindSettingUnit ?? "");
  const grindTouched = useRef(Boolean(prefill.grindSettingText));
  const first = useRef(true);

  // Choosing another recipe resets the parameters to its defaults.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!recipe) return;
    setDose(show(recipe.defaultCoffeeDoseG));
    setWater(show(recipe.defaultWaterG));
    setWaterOverride(false);
    setTemperature(show(recipe.waterTemperatureC));
    setBrewerId("");
  }, [recipeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The last setting used with this recipe and grinder, unless typed over (§17).
  const suggestedGrind = data.recentGrinds.find((g) => g.recipeId === recipeId && g.userGrinderId === grinderId) ?? null;
  useEffect(() => {
    if (grindTouched.current) return;
    setGrindText(suggestedGrind?.grindSettingText ?? "");
    setGrindNumeric(show(suggestedGrind?.grindSettingNumeric ?? null));
    setGrindUnit(suggestedGrind?.grindSettingUnit ?? data.grinders.find((g) => g.id === grinderId)?.settingUnit ?? "");
  }, [recipeId, grinderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const doseValue = parse(dose);
  const scaled = useMemo(() => {
    if (!recipe || doseValue === null) return null;
    try {
      return scaleRecipe(
        { defaultCoffeeDoseG: recipe.defaultCoffeeDoseG, defaultWaterG: recipe.defaultWaterG, targetYieldG: recipe.targetYieldG, steps: recipe.steps },
        { doseG: doseValue, waterOverrideG: waterOverride ? parse(water) : null },
      );
    } catch {
      return null;
    }
  }, [recipe, doseValue, water, waterOverride]);
  const waterValue = waterOverride ? parse(water) : (scaled?.waterG ?? null);
  const espresso = recipe?.methodType === "ESPRESSO";

  const coffee = data.coffees.find((c) => c.id === coffeeId);
  const grinder = data.grinders.find((g) => g.id === grinderId);
  const brewer = data.brewers.find((b) => b.id === (brewerId || recipe?.brewerId));
  // The published starting range for this grinder and brew method (§9).
  const publishedGrind = grinder ? recommendedGrind(grinder.catalogueSlug, recipe?.methodType) : null;
  const estimate = scaled ? estimateDurationSeconds(scaled.steps, recipe?.targetBrewTimeSeconds ?? null) : null;

  if (data.recipes.length === 0) return <p className="empty">{t("noRecipes")}</p>;

  return (
    <form action={action} className="grid grid-2" style={{ alignItems: "start" }}>
      <div className="stack">
        <FormError state={state} />
        <input type="hidden" name="parentBrewId" value={prefill.parentBrewId ?? ""} />
        <input type="hidden" name="waterTargetG" value={show(waterValue)} />

        <div className="card stack">
          <div className="field">
            <label htmlFor="coffeeId">{t("coffee")}</label>
            <select id="coffeeId" name="coffeeId" value={coffeeId} onChange={(e) => setCoffeeId(e.target.value)}>
              <option value="">{t("noCoffee")}</option>
              {data.coffees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.roaster ? `${c.name} · ${c.roaster}` : c.name}
                </option>
              ))}
            </select>
            {data.coffees.length === 0 ? (
              <span className="hint">
                <Link href="/coffees/new">{t("addCoffee")}</Link>
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="recipeId">{t("recipe")}</label>
            <select id="recipeId" name="recipeId" value={recipeId} onChange={(e) => setRecipeId(e.target.value)} required {...invalidProps(state, "recipeId")}>
              <option value="">{t("chooseRecipe")}</option>
              <optgroup label={t("myRecipes")}>
                {data.recipes.filter((r) => r.ownerId).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t("bundledRecipes")}>
                {data.recipes.filter((r) => !r.ownerId).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <FieldError state={state} name="recipeId" />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="userGrinderId">{t("grinder")}</label>
              <select id="userGrinderId" name="userGrinderId" value={grinderId} onChange={(e) => setGrinderId(e.target.value)}>
                <option value="">{t("noGrinder")}</option>
                {data.grinders.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              {data.grinders.length === 0 ? (
                <span className="hint">
                  <Link href="/grinders/new">{t("addGrinder")}</Link>
                </span>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="brewerId">{t("brewer")}</label>
              <select id="brewerId" name="brewerId" value={brewerId} onChange={(e) => setBrewerId(e.target.value)}>
                <option value="">{recipe?.brewerName ? t("recipeBrewer", { name: recipe.brewerName }) : t("noBrewer")}</option>
                {data.brewers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {recipe ? (
          <div className="card stack">
            <div className="row">
              <div className="field">
                <label htmlFor="coffeeDoseG">{t("dose")}</label>
                <input id="coffeeDoseG" name="coffeeDoseG" inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} required {...invalidProps(state, "coffeeDoseG")} />
                <FieldError state={state} name="coffeeDoseG" />
              </div>
              <div className="field">
                <label htmlFor="water">{espresso ? t("water") : t("water")}</label>
                <input
                  id="water"
                  inputMode="decimal"
                  value={waterOverride ? water : show(scaled?.waterG ?? null)}
                  onChange={(e) => {
                    setWaterOverride(true);
                    setWater(e.target.value);
                  }}
                  aria-describedby="water-hint"
                  {...invalidProps(state, "waterTargetG")}
                />
                <span className="hint" id="water-hint">
                  {waterOverride ? (
                    <button type="button" className="btn btn-quiet" style={{ minHeight: 32, padding: "2px 8px" }} onClick={() => setWaterOverride(false)}>
                      {t("followRatio")}
                    </button>
                  ) : (
                    t("scaledFromRecipe")
                  )}
                </span>
                <FieldError state={state} name="waterTargetG" />
              </div>
              <div className="field">
                <label htmlFor="waterTemperatureC">{t("temperature")}</label>
                <input id="waterTemperatureC" name="waterTemperatureC" inputMode="decimal" value={temperature} onChange={(e) => setTemperature(e.target.value)} {...invalidProps(state, "waterTemperatureC")} />
                <FieldError state={state} name="waterTemperatureC" />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="grindSettingText">{t("grindSetting")}</label>
                <input
                  id="grindSettingText"
                  name="grindSettingText"
                  value={grindText}
                  maxLength={120}
                  placeholder={recipe.grindDescription ? grinds(recipe.grindDescription as "MEDIUM") : t("grindPlaceholder")}
                  onChange={(e) => {
                    grindTouched.current = true;
                    setGrindText(e.target.value);
                  }}
                  aria-describedby="grind-hint"
                />
                <span className="hint" id="grind-hint">
                  {suggestedGrind
                    ? t("lastGrind", { setting: suggestedGrind.grindSettingText })
                    : publishedGrind
                      ? t("recommendedGrind", { method: grindMethods(publishedGrind.method), range: formatGrindRange(publishedGrind, grinder?.settingUnit ?? null) })
                      : recipe.grindDescription
                        ? t("recipeGrind", { grind: grinds(recipe.grindDescription as "MEDIUM") })
                        : ""}
                </span>
              </div>
              <div className="field">
                <label htmlFor="grindSettingNumeric">{t("grindNumeric")}</label>
                <input id="grindSettingNumeric" name="grindSettingNumeric" inputMode="decimal" value={grindNumeric} onChange={(e) => { grindTouched.current = true; setGrindNumeric(e.target.value); }} />
              </div>
              <div className="field">
                <label htmlFor="grindSettingUnit">{t("grindUnit")}</label>
                <input id="grindSettingUnit" name="grindSettingUnit" value={grindUnit} maxLength={40} onChange={(e) => setGrindUnit(e.target.value)} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <section className="card sticky-review" aria-labelledby="review-heading">
        <h2 id="review-heading">{t("review")}</h2>
        {recipe && scaled ? (
          <>
            <dl className="review">
              <dt>{t("coffee")}</dt>
              <dd>{coffee?.name ?? "–"}</dd>
              <dt>{t("recipe")}</dt>
              <dd>{recipe.name}</dd>
              <dt>{t("dose")}</dt>
              <dd>{scaled.coffeeDoseG.toFixed(1).replace(".", sep)} g</dd>
              <dt>{espresso ? t("yield") : t("water")}</dt>
              <dd>{displayGrams(espresso && scaled.targetYieldG ? scaled.targetYieldG : (waterValue ?? scaled.waterG))} g</dd>
              <dt>{t("ratio")}</dt>
              <dd>{formatRatio(ratioOf(espresso && scaled.targetYieldG ? scaled.targetYieldG : waterValue, scaled.coffeeDoseG), sep)}</dd>
              <dt>{t("temperature")}</dt>
              <dd>{temperature ? `${temperature} °C` : "–"}</dd>
              <dt>{t("grinder")}</dt>
              <dd>{grinder?.label ?? "–"}</dd>
              <dt>{t("grindSetting")}</dt>
              <dd>{grindText || "–"}</dd>
              <dt>{t("brewer")}</dt>
              <dd>{brewer?.label ?? recipe.brewerName ?? "–"}</dd>
              <dt>{t("duration")}</dt>
              <dd>{estimate !== null ? formatSeconds(estimate) : "–"}</dd>
            </dl>
            <details className="more">
              <summary>{t("targets")}</summary>
              <ol className="steps">
                {scaled.steps.map((step) => (
                  <li key={step.id}>
                    <div>
                      <strong>{stepTypes(step.type as StepType)}</strong>
                      {step.waterTargetG !== null ? ` · ${displayGrams(step.waterTargetG)} g` : ""}
                      <div className="muted small">{step.instruction}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </details>
            <div className="sticky-start" style={{ marginTop: 16 }}>
              <SubmitButton className="btn btn-primary btn-large btn-block" pendingLabel={t("starting")}>
                {t("start")}
              </SubmitButton>
            </div>
            <p className="muted small">{t("startHint")}</p>
          </>
        ) : (
          <p className="muted">{t("chooseRecipeFirst")}</p>
        )}
      </section>
    </form>
  );
}
