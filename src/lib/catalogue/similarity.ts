/**
 * How alike two shared catalogue entries are, so the same coffee or roaster
 * is not added twice (§7a).
 *
 * Deterministic and dependency-free, in the spirit of NutriCore's
 * `textSimilarity` (`src/lib/ranking.ts`), but symmetric: that function
 * answers "how well does this name answer the query", while a duplicate check
 * asks "are these two names the same thing", which must not depend on which
 * of the two was typed first.
 */

/** Words that say nothing about which coffee it is. */
const NOISE_WORDS = new Set(["coffee", "kaffee", "cafe", "coffees", "roasters", "roastery", "rosterei", "kaffeerosterei", "the", "der", "die", "das", "and", "und", "&"]);

/** Lowercase, accents and punctuation removed, whitespace collapsed. */
export function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const tokensOf = (value: string) => {
  const tokens = normalizeName(value).split(" ").filter(Boolean);
  const meaningful = tokens.filter((token) => !NOISE_WORDS.has(token));
  // A name made only of noise words ("The Coffee") is still a name.
  return meaningful.length > 0 ? meaningful : tokens;
};

/** Levenshtein distance, capped: only "one typo" vs. "different word" matters here. */
function editDistanceAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return false;
    previous = current;
  }
  return previous[b.length] <= max;
}

/** Whether two tokens are the same word, allowing a plural or a single typo. */
function sameToken(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 3 && long.startsWith(short) && long.length - short.length <= 2) return true;
  return short.length >= 5 && editDistanceAtMost(a, b, 1);
}

/** Character trigrams of the whole normalized name, for spelling variants. */
function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

/**
 * How alike two names are, in [0, 1], symmetric.
 *
 * Two measures, the better one wins: token overlap (word order and an extra
 * word do not matter much - "Guji Ethiopia" is "Ethiopia Guji", "Kiambu AA" is
 * close to "Kiambu") and trigram overlap (spelling - "Yirgacheffe" is
 * "Yirgachefe").
 */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = tokensOf(na);
  const tb = tokensOf(nb);
  let matched = 0;
  const used = new Set<number>();
  for (const token of ta) {
    const index = tb.findIndex((other, i) => !used.has(i) && sameToken(token, other));
    if (index >= 0) {
      used.add(index);
      matched += 1;
    }
  }
  // Dice says how much of both is shared; overlap says whether the shorter
  // name is contained in the longer one. Averaged so containment helps but an
  // extra word still costs something.
  const dice = (2 * matched) / (ta.length + tb.length);
  const overlap = matched / Math.min(ta.length, tb.length);
  const tokenScore = (dice + overlap) / 2;

  const ga = trigrams(ta.join(" "));
  const gb = trigrams(tb.join(" "));
  let shared = 0;
  for (const gram of ga) if (gb.has(gram)) shared += 1;
  const trigramScore = (2 * shared) / (ga.size + gb.size);

  return Math.max(tokenScore, trigramScore);
}

export interface CoffeeIdentity {
  name: string;
  roasterName?: string | null;
  country?: string | null;
}

/**
 * How likely two shared coffees are the same coffee, in [0, 1].
 *
 * The name decides; the roaster and the origin can only lower the score: the
 * same "House Blend" from two roasters is two coffees, and an "Espresso" from
 * Brazil is not one from Ethiopia. A missing roaster or country is neutral -
 * the gap is exactly what a duplicate entry tends to have.
 */
export function coffeeSimilarity(a: CoffeeIdentity, b: CoffeeIdentity): number {
  let score = nameSimilarity(a.name, b.name);
  if (normalizeName(a.roasterName) && normalizeName(b.roasterName)) {
    const roaster = nameSimilarity(a.roasterName, b.roasterName);
    if (roaster < 0.6) score *= 0.4;
  }
  const ca = normalizeName(a.country);
  const cb = normalizeName(b.country);
  if (ca && cb && ca !== cb) score *= 0.6;
  return Math.round(score * 1000) / 1000;
}

/** Shown while a coffee is being added: worth a look. */
export const SUGGEST_THRESHOLD = 0.55;
/** Listed for an administrator: probably the same entry. */
export const DUPLICATE_THRESHOLD = 0.75;

/**
 * Every pair at or above `threshold`, best first.
 *
 * Quadratic, which is fine at the size of a self-hosted instance's catalogue;
 * `limit` keeps the result readable when it is not.
 */
export function similarPairs<T extends { id: string }>(
  rows: readonly T[],
  score: (a: T, b: T) => number,
  threshold: number,
  limit = 50,
): { a: T; b: T; score: number }[] {
  const pairs: { a: T; b: T; score: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const value = score(rows[i], rows[j]);
      if (value >= threshold) pairs.push({ a: rows[i], b: rows[j], score: value });
    }
  }
  return pairs.sort((x, y) => y.score - x.score).slice(0, limit);
}
