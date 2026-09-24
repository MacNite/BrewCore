"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveRecipeAction } from "@/server/recipe-actions";
import type { FormState } from "@/server/action-state";
import { FieldError, FormError, SubmitButton, invalidProps } from "@/components/form-bits";
import { GRIND_LEVELS, METHOD_TYPES, STEP_TYPES, estimateDurationSeconds, type StepType } from "@/lib/brewing/recipe";
import { formatRatio, ratioOf } from "@/lib/brewing/ratio";
import { stepAdditions } from "@/lib/brewing/scaling";
import { formatSeconds, parseClock } from "@/lib/brewing/timer";

export interface RecipeFormValues {
  id?: string;
  name: string;
  description: string;
  brewerId: string;
  methodType: string;
  defaultCoffeeDoseG: string;
  defaultWaterG: string;
  targetYieldG: string;
  waterTemperatureC: string;
  grindDescription: string;
  targetBrewTime: string;
  tags: string;
  sourceName: string;
  sourceUrl: string;
  authorName: string;
  steps: EditorStepValues[];
}

export interface EditorStepValues {
  type: string;
  title: string;
  instruction: string;
  waterTargetG: string;
  duration: string;
  targetElapsed: string;
  targetElapsedMax: string;
  requiresConfirmation: boolean;
  autoAdvance: boolean;
}

interface EditorStep extends EditorStepValues {
  key: number;
}

const emptyStep = (type: StepType = "POUR"): EditorStepValues => ({
  type,
  title: "",
  instruction: "",
  waterTargetG: "",
  duration: "",
  targetElapsed: "",
  targetElapsedMax: "",
  requiresConfirmation: false,
  autoAdvance: false,
});

const toNumber = (value: string) => {
  const text = value.trim().replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
};

/** The editor's strings as the numbers the Server Action validates. */
function serialize(steps: EditorStep[]) {
  return steps.map((step) => ({
    type: step.type,
    title: step.title.trim() || null,
    instruction: step.instruction.trim(),
    waterTargetG: toNumber(step.waterTargetG),
    durationSeconds: parseClock(step.duration),
    targetElapsedSeconds: parseClock(step.targetElapsed),
    targetElapsedMaxSeconds: parseClock(step.targetElapsedMax),
    temperatureC: null,
    requiresConfirmation: step.requiresConfirmation,
    autoAdvance: step.autoAdvance && !step.requiresConfirmation,
  }));
}

export function RecipeForm({ values, brewers }: { values: RecipeFormValues; brewers: { id: string; label: string }[] }) {
  const t = useTranslations("recipes");
  const stepTypes = useTranslations("stepTypes");
  const methods = useTranslations("methods");
  const grinds = useTranslations("grind");
  const common = useTranslations("common");
  const locale = useLocale();
  const [state, action] = useActionState<FormState, FormData>(saveRecipeAction, {});
  const nextKey = useRef(values.steps.length + 1);
  const [steps, setSteps] = useState<EditorStep[]>(() =>
    (values.steps.length ? values.steps : [emptyStep("PREPARE"), emptyStep("BLOOM"), emptyStep("POUR")]).map((step, index) => ({ ...step, key: index })),
  );
  const [dose, setDose] = useState(values.defaultCoffeeDoseG);
  const [water, setWater] = useState(values.defaultWaterG);
  const [brewTime, setBrewTime] = useState(values.targetBrewTime);
  const liveRegion = useRef<HTMLDivElement>(null);

  const serialized = useMemo(() => serialize(steps), [steps]);
  const additions = stepAdditions(serialized.map((s) => ({ waterTargetG: Number.isNaN(s.waterTargetG) ? null : s.waterTargetG })));
  const ratio = ratioOf(toNumber(water), toNumber(dose));
  const estimate = estimateDurationSeconds(serialized.map((s) => ({ ...s, durationSeconds: s.durationSeconds, targetElapsedSeconds: s.targetElapsedSeconds, targetElapsedMaxSeconds: s.targetElapsedMaxSeconds })), parseClock(brewTime));

  const announce = (message: string) => {
    if (liveRegion.current) liveRegion.current.textContent = message;
  };
  const update = (key: number, patch: Partial<EditorStepValues>) => setSteps((list) => list.map((step) => (step.key === key ? { ...step, ...patch } : step)));
  const move = (index: number, delta: number) => {
    setSteps((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    announce(t("editor.moved", { from: index + 1, to: index + delta + 1 }));
  };
  const add = (after: number) => {
    setSteps((list) => {
      const copy = [...list];
      copy.splice(after + 1, 0, { ...emptyStep(), key: nextKey.current++ });
      return copy;
    });
    announce(t("editor.added", { position: after + 2 }));
  };
  const remove = (key: number) => {
    setSteps((list) => (list.length > 1 ? list.filter((step) => step.key !== key) : list));
    announce(t("editor.removed"));
  };

  const stepError = (index: number) => state.fieldErrors?.[`steps.${index}`] ?? Object.entries(state.fieldErrors ?? {}).find(([k]) => k.startsWith(`steps.${index}.`))?.[1];
  const clockInvalid = (value: string) => value.trim() !== "" && parseClock(value) === null;

  return (
    <form action={action} className="stack">
      <FormError state={state} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="steps" value={JSON.stringify(serialized)} />
      <input type="hidden" name="targetBrewTimeSeconds" value={parseClock(brewTime) ?? ""} />

      <div className="card stack">
        <div className="field">
          <label htmlFor="name">{t("fields.name")}</label>
          <input id="name" name="name" defaultValue={values.name} required maxLength={160} {...invalidProps(state, "name")} />
          <FieldError state={state} name="name" />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="methodType">{t("fields.method")}</label>
            <select id="methodType" name="methodType" defaultValue={values.methodType || "POUR_OVER"}>
              {METHOD_TYPES.map((method) => (
                <option key={method} value={method}>
                  {methods(method)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="brewerId">{t("fields.brewer")}</label>
            <select id="brewerId" name="brewerId" defaultValue={values.brewerId}>
              <option value="">{t("noBrewer")}</option>
              {brewers.map((brewer) => (
                <option key={brewer.id} value={brewer.id}>
                  {brewer.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="defaultCoffeeDoseG">{t("fields.dose")}</label>
            <input id="defaultCoffeeDoseG" name="defaultCoffeeDoseG" inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} required {...invalidProps(state, "defaultCoffeeDoseG")} />
            <FieldError state={state} name="defaultCoffeeDoseG" />
          </div>
          <div className="field">
            <label htmlFor="defaultWaterG">{t("fields.water")}</label>
            <input id="defaultWaterG" name="defaultWaterG" inputMode="decimal" value={water} onChange={(e) => setWater(e.target.value)} required {...invalidProps(state, "defaultWaterG")} />
            <FieldError state={state} name="defaultWaterG" />
          </div>
          <div className="field">
            <span className="label">{t("fields.ratio")}</span>
            <output aria-live="polite" style={{ fontSize: "1.3rem", fontWeight: 750, paddingTop: 6 }}>
              {formatRatio(ratio, locale === "de" ? "," : ".")}
            </output>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="waterTemperatureC">{t("fields.temperature")}</label>
            <input id="waterTemperatureC" name="waterTemperatureC" inputMode="decimal" defaultValue={values.waterTemperatureC} {...invalidProps(state, "waterTemperatureC")} />
            <FieldError state={state} name="waterTemperatureC" />
          </div>
          <div className="field">
            <label htmlFor="grindDescription">{t("fields.grind")}</label>
            <select id="grindDescription" name="grindDescription" defaultValue={values.grindDescription}>
              <option value="">–</option>
              {GRIND_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {grinds(level)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="targetYieldG">{t("fields.yield")}</label>
            <input id="targetYieldG" name="targetYieldG" inputMode="decimal" defaultValue={values.targetYieldG} aria-describedby="yield-hint" />
            <span className="hint" id="yield-hint">
              {t("fields.yieldHint")}
            </span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="targetBrewTime">{t("fields.targetTime")}</label>
          <input id="targetBrewTime" value={brewTime} placeholder="3:00" onChange={(e) => setBrewTime(e.target.value)} aria-invalid={clockInvalid(brewTime) || undefined} />
        </div>
        <div className="field">
          <label htmlFor="description">{t("fields.description")}</label>
          <textarea id="description" name="description" defaultValue={values.description} maxLength={4000} />
        </div>
      </div>

      <section className="card" aria-labelledby="steps-heading">
        <div className="section-head">
          <h2 id="steps-heading">{t("steps")}</h2>
          <span className="muted small">{estimate !== null ? t("estimate", { time: formatSeconds(estimate) }) : null}</span>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          {t("editor.hint")}
        </p>
        <FieldError state={state} name="steps" />
        <div ref={liveRegion} className="sr-only" aria-live="polite" />
        <ol className="step-editor" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {steps.map((step, index) => {
            const error = stepError(index);
            const id = (field: string) => `step-${step.key}-${field}`;
            return (
              <li key={step.key} className="step-card" aria-label={t("editor.stepLabel", { number: index + 1 })}>
                <div className="step-card-head">
                  <span className="grow">
                    {index + 1}. {stepTypes(step.type as StepType)}
                    {additions[index] !== null && !Number.isNaN(additions[index]) ? <span className="muted small"> · {t("editor.add", { grams: additions[index]! })}</span> : null}
                  </span>
                  <button type="button" className="icon-btn" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t("editor.moveUp", { number: index + 1 })}>
                    ↑
                  </button>
                  <button type="button" className="icon-btn" onClick={() => move(index, 1)} disabled={index === steps.length - 1} aria-label={t("editor.moveDown", { number: index + 1 })}>
                    ↓
                  </button>
                  <button type="button" className="icon-btn" onClick={() => remove(step.key)} disabled={steps.length === 1} aria-label={t("editor.remove", { number: index + 1 })}>
                    ✕
                  </button>
                </div>
                {error ? (
                  <p className="error" role="alert" style={{ color: "var(--danger)", margin: "0 0 8px" }}>
                    {t(`editor.errors.${(["waterDecreasing", "waterAboveTotal", "timeDecreasing", "rangeInvalid"] as const).find((k) => k === error) ?? "invalid"}`)}
                  </p>
                ) : null}
                <div className="row">
                  <div className="field">
                    <label htmlFor={id("type")}>{t("editor.type")}</label>
                    <select id={id("type")} value={step.type} onChange={(e) => update(step.key, { type: e.target.value })}>
                      {STEP_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {stepTypes(type)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={id("water")}>{t("editor.waterTarget")}</label>
                    <input id={id("water")} inputMode="decimal" value={step.waterTargetG} onChange={(e) => update(step.key, { waterTargetG: e.target.value })} aria-describedby={id("water-hint")} />
                    <span className="hint" id={id("water-hint")}>
                      {t("editor.waterTargetHint")}
                    </span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor={id("instruction")}>{t("editor.instruction")}</label>
                  <input id={id("instruction")} value={step.instruction} onChange={(e) => update(step.key, { instruction: e.target.value })} required maxLength={1000} />
                </div>
                <div className="row">
                  <div className="field">
                    <label htmlFor={id("duration")}>{t("editor.duration")}</label>
                    <input id={id("duration")} value={step.duration} placeholder="0:45" onChange={(e) => update(step.key, { duration: e.target.value })} aria-invalid={clockInvalid(step.duration) || undefined} />
                  </div>
                  <div className="field">
                    <label htmlFor={id("target")}>{t("editor.targetElapsed")}</label>
                    <input id={id("target")} value={step.targetElapsed} placeholder="1:15" onChange={(e) => update(step.key, { targetElapsed: e.target.value })} aria-invalid={clockInvalid(step.targetElapsed) || undefined} />
                  </div>
                  <div className="field">
                    <label htmlFor={id("targetMax")}>{t("editor.targetElapsedMax")}</label>
                    <input id={id("targetMax")} value={step.targetElapsedMax} placeholder="3:15" onChange={(e) => update(step.key, { targetElapsedMax: e.target.value })} aria-invalid={clockInvalid(step.targetElapsedMax) || undefined} />
                  </div>
                </div>
                <div className="row">
                  <label className="check">
                    <input type="checkbox" checked={step.autoAdvance && !step.requiresConfirmation} disabled={step.requiresConfirmation} onChange={(e) => update(step.key, { autoAdvance: e.target.checked })} />
                    {t("editor.autoAdvance")}
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={step.requiresConfirmation} onChange={(e) => update(step.key, { requiresConfirmation: e.target.checked })} />
                    {t("editor.requiresConfirmation")}
                  </label>
                </div>
                <button type="button" className="btn btn-quiet" onClick={() => add(index)}>
                  + {t("editor.addAfter")}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <details className="more card" open={Boolean(values.sourceName || values.authorName || values.sourceUrl)}>
        <summary>{t("provenance")}</summary>
        <p className="muted small">{t("provenanceHint")}</p>
        <div className="row">
          <div className="field">
            <label htmlFor="sourceName">{t("fields.sourceName")}</label>
            <input id="sourceName" name="sourceName" defaultValue={values.sourceName} maxLength={160} />
          </div>
          <div className="field">
            <label htmlFor="authorName">{t("fields.authorName")}</label>
            <input id="authorName" name="authorName" defaultValue={values.authorName} maxLength={120} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="sourceUrl">{t("fields.sourceUrl")}</label>
          <input id="sourceUrl" name="sourceUrl" type="url" defaultValue={values.sourceUrl} maxLength={500} placeholder="https://" {...invalidProps(state, "sourceUrl")} />
          <FieldError state={state} name="sourceUrl" />
        </div>
        <div className="field">
          <label htmlFor="tags">{t("fields.tags")}</label>
          <input id="tags" name="tags" defaultValue={values.tags} maxLength={400} />
        </div>
      </details>

      <div className="form-actions">
        <SubmitButton>{common("save")}</SubmitButton>
      </div>
    </form>
  );
}
