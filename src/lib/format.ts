/**
 * Locale-aware display formatting. Values are stored canonically (grams, °C,
 * seconds, ISO dates); formatting happens only here, in the UI layer (§49).
 */
import { formatRatio } from "./brewing/ratio";

export type AppLocale = "de" | "en";

const tag = (locale: AppLocale) => (locale === "de" ? "de-DE" : "en-GB");

export function formatNumber(value: number | null | undefined, locale: AppLocale, maximumFractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  return new Intl.NumberFormat(tag(locale), { maximumFractionDigits }).format(value);
}

/** `18.5 g`; whole grams unless `digits` says otherwise. */
export const formatGrams = (value: number | null | undefined, locale: AppLocale, digits = 1) =>
  value === null || value === undefined ? "–" : `${formatNumber(value, locale, digits)} g`;

export const formatTemperature = (value: number | null | undefined, locale: AppLocale) =>
  value === null || value === undefined ? "–" : `${formatNumber(value, locale, 1)} °C`;

export const formatRatioLocale = (ratio: number | null, locale: AppLocale) =>
  formatRatio(ratio, locale === "de" ? "," : ".");

export function formatDate(value: Date | string | null | undefined, locale: AppLocale): string {
  if (!value) return "–";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined, locale: AppLocale): string {
  if (!value) return "–";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Whole days between a (UTC date-only) roast date and `now` (§41). */
export function daysSince(date: Date | string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const then = typeof date === "string" ? new Date(date) : date;
  const start = Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - start) / 86_400_000);
}

/** `yyyy-mm-dd` for a date input. */
export const dateInputValue = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : "");

/** Splits comma- or newline-separated free text into a clean, de-duplicated list. */
export function splitList(value: unknown, max = 30): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean))].slice(0, max).map((entry) => entry.slice(0, 80));
}
