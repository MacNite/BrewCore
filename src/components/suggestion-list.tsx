import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { decideSuggestionAction } from "@/server/coffee-actions";
import type { OpenSuggestion } from "@/server/suggestions";
import { formatDate, type AppLocale } from "@/lib/format";

/** The label of a suggested field: coffee fields under `coffees.fields`, roaster fields under `roasters.fields`. */
const COFFEE_LABELS: Record<string, string> = {
  roasterName: "roaster",
  roastLevel: "roastLevel",
  country: "country",
  region: "region",
  farm: "farm",
  producer: "producer",
  varieties: "varieties",
  process: "process",
  processingNotes: "processingNotes",
  altitudeMinMasl: "altitudeMin",
  altitudeMaxMasl: "altitudeMax",
  roasterTastingNotes: "tastingNotes",
  description: "description",
};

/**
 * Open gap-filling suggestions, each with what it proposes. With `canDecide`,
 * accept and reject buttons; `showTarget` names the coffee or roaster, for the
 * review queue that spans many.
 */
export async function SuggestionList({ suggestions, canDecide, showTarget = false }: { suggestions: OpenSuggestion[]; canDecide: boolean; showTarget?: boolean }) {
  const t = await getTranslations("suggestions");
  const coffees = await getTranslations("coffees");
  const roasters = await getTranslations("roasters");
  const locale = (await getLocale()) as AppLocale;

  const label = (kind: OpenSuggestion["kind"], field: string) =>
    kind === "coffee" ? coffees(`fields.${COFFEE_LABELS[field] ?? "notes"}` as "fields.notes") : roasters(`fields.${field}` as "fields.notes");
  const show = (field: string, value: unknown) => {
    if (Array.isArray(value)) return value.join(", ");
    if (field === "roastLevel" && typeof value === "string") return coffees(`roastLevels.${value}` as "roastLevels.UNKNOWN");
    return String(value);
  };

  return (
    <ul className="list">
      {suggestions.map((suggestion) => (
        <li key={suggestion.id} className="card stack">
          <div>
            {showTarget ? (
              <div className="title">
                <Link href={suggestion.kind === "coffee" ? `/coffees/shared/${suggestion.targetId}` : `/roasters/${suggestion.targetId}`}>{suggestion.targetName}</Link>{" "}
                <span className="badge">{t(`kinds.${suggestion.kind}`)}</span>
              </div>
            ) : null}
            <div className="meta small muted">{t("byOn", { name: suggestion.mine ? t("you") : suggestion.authorName, date: formatDate(suggestion.createdAt, locale) })}</div>
          </div>
          <dl className="facts">
            {Object.entries(suggestion.values).map(([field, value]) => (
              <div key={field} style={{ display: "contents" }}>
                <dt>{label(suggestion.kind, field)}</dt>
                <dd style={{ whiteSpace: "pre-wrap" }}>{show(field, value)}</dd>
              </div>
            ))}
          </dl>
          {suggestion.hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- author/reviewer-only image route
            <img src={`/api/suggestions/${suggestion.id}/image`} alt={t("photoAlt")} style={{ maxWidth: 240, maxHeight: 240, objectFit: "cover", borderRadius: 12 }} />
          ) : null}
          {canDecide ? (
            <div className="form-actions">
              {(["accept", "reject"] as const).map((decision) => (
                // One form per decision: the submitter's own name and value are not reliably part of a Server Action's form data.
                <form key={decision} action={decideSuggestionAction} className="inline-form">
                  <input type="hidden" name="id" value={suggestion.id} />
                  <input type="hidden" name="decision" value={decision} />
                  <button className={decision === "accept" ? "btn btn-primary" : "btn"} type="submit">
                    {t(decision)}
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <p className="small muted">{t("pending")}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
