/**
 * Ownership rules in one place (§45).
 *
 * Catalogue-type rows (`GrinderModel`, `Brewer`, `Recipe`, `Roaster`) are
 * visible when they are bundled (`ownerId = null`) or the caller's own, and
 * writable only when they are the caller's own. Personal rows (`Coffee`,
 * `UserGrinder`, `Brew`, `Favorite`) are only ever the caller's own.
 *
 * Every server read, update and delete goes through one of these `where`
 * fragments, so a forged id from another account simply is not found.
 */

/** Bundled or own. */
export const visibleTo = (userId: string) => ({ OR: [{ ownerId: null }, { ownerId: userId }] });

/** Own only. */
export const ownedBy = (userId: string) => ({ ownerId: userId });

/** Active (not archived) rows. */
export const notArchived = { archivedAt: null } as const;

/** Case-insensitive `contains`, for the simple server-side search (§39). */
export const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

export const cleanQuery = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 100) : "");
