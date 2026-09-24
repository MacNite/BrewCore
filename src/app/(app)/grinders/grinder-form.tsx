"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { saveGrinderAction } from "@/server/grinder-actions";
import type { FormState } from "@/server/action-state";
import { FieldError, FormError, SubmitButton, invalidProps } from "@/components/form-bits";

export interface GrinderModelOption {
  id: string;
  label: string;
  custom: boolean;
}

export interface GrinderValues {
  id?: string;
  grinderModelId: string;
  nickname: string;
  burrDescription: string;
  burrInstallDate: string;
  zeroPoint: string;
  calibrationNotes: string;
  defaultForFilter: boolean;
  defaultForEspresso: boolean;
}

const TYPES = ["HAND", "ELECTRIC", "BUILT_IN"] as const;
const ADJUSTMENTS = ["CLICK", "NUMBER", "STEPLESS", "MICRON", "CUSTOM"] as const;

export function GrinderForm({ values, models }: { values: GrinderValues; models: GrinderModelOption[] }) {
  const t = useTranslations("grinders");
  const common = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveGrinderAction, {});
  const [modelId, setModelId] = useState(values.grinderModelId);
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? models.filter((m) => m.label.toLowerCase().includes(q) || m.id === modelId) : models;
  }, [filter, models, modelId]);

  return (
    <form action={action}>
      <FormError state={state} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="field">
        <label htmlFor="model-filter">{t("searchModels")}</label>
        <input id="model-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("searchModelsPlaceholder")} />
      </div>
      <div className="field">
        <label htmlFor="grinderModelId">{t("fields.model")}</label>
        <select id="grinderModelId" name="grinderModelId" value={modelId} onChange={(e) => setModelId(e.target.value)} required {...invalidProps(state, "grinderModelId")}>
          <option value="">{t("chooseModel")}</option>
          <optgroup label={t("bundledModels")}>
            {visible.filter((m) => !m.custom).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </optgroup>
          {visible.some((m) => m.custom) ? (
            <optgroup label={t("customModels")}>
              {visible.filter((m) => m.custom).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          <option value="custom">{t("addCustomModel")}</option>
        </select>
        <FieldError state={state} name="grinderModelId" />
      </div>

      {modelId === "custom" ? (
        <fieldset style={{ marginBottom: 14 }}>
          <legend>{t("customModel")}</legend>
          <div className="row">
            <div className="field">
              <label htmlFor="modelManufacturer">{t("fields.manufacturer")}</label>
              <input id="modelManufacturer" name="modelManufacturer" required maxLength={80} {...invalidProps(state, "model.manufacturer")} />
              <FieldError state={state} name="model.manufacturer" />
            </div>
            <div className="field">
              <label htmlFor="modelName">{t("fields.modelName")}</label>
              <input id="modelName" name="modelName" required maxLength={120} {...invalidProps(state, "model.model")} />
              <FieldError state={state} name="model.model" />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="modelType">{t("fields.type")}</label>
              <select id="modelType" name="modelType" defaultValue="HAND">
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`types.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="modelAdjustmentType">{t("fields.adjustment")}</label>
              <select id="modelAdjustmentType" name="modelAdjustmentType" defaultValue="CLICK">
                {ADJUSTMENTS.map((type) => (
                  <option key={type} value={type}>
                    {t(`adjustments.${type}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="modelSettingUnit">{t("fields.settingUnit")}</label>
              <input id="modelSettingUnit" name="modelSettingUnit" maxLength={40} placeholder={t("settingUnitPlaceholder")} />
            </div>
            <div className="field">
              <label htmlFor="modelBurrType">{t("fields.burrType")}</label>
              <input id="modelBurrType" name="modelBurrType" maxLength={80} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="modelBurrDiameterMm">{t("fields.burrDiameter")}</label>
              <input id="modelBurrDiameterMm" name="modelBurrDiameterMm" inputMode="numeric" />
            </div>
            <div className="field">
              <label htmlFor="modelMinSetting">{t("fields.minSetting")}</label>
              <input id="modelMinSetting" name="modelMinSetting" inputMode="decimal" />
            </div>
            <div className="field">
              <label htmlFor="modelMaxSetting">{t("fields.maxSetting")}</label>
              <input id="modelMaxSetting" name="modelMaxSetting" inputMode="decimal" />
            </div>
          </div>
        </fieldset>
      ) : null}

      <div className="field">
        <label htmlFor="nickname">{t("fields.nickname")}</label>
        <input id="nickname" name="nickname" defaultValue={values.nickname} maxLength={80} />
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="zeroPoint">{t("fields.zeroPoint")}</label>
          <input id="zeroPoint" name="zeroPoint" defaultValue={values.zeroPoint} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="burrInstallDate">{t("fields.burrInstallDate")}</label>
          <input id="burrInstallDate" name="burrInstallDate" type="date" defaultValue={values.burrInstallDate} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="burrDescription">{t("fields.burrDescription")}</label>
        <input id="burrDescription" name="burrDescription" defaultValue={values.burrDescription} maxLength={200} />
      </div>
      <div className="field">
        <label htmlFor="calibrationNotes">{t("fields.calibrationNotes")}</label>
        <textarea id="calibrationNotes" name="calibrationNotes" defaultValue={values.calibrationNotes} maxLength={2000} />
      </div>
      <label className="check">
        <input type="checkbox" name="defaultForFilter" defaultChecked={values.defaultForFilter} /> {t("fields.defaultForFilter")}
      </label>
      <label className="check">
        <input type="checkbox" name="defaultForEspresso" defaultChecked={values.defaultForEspresso} /> {t("fields.defaultForEspresso")}
      </label>
      <div className="form-actions">
        <SubmitButton>{common("save")}</SubmitButton>
      </div>
    </form>
  );
}
