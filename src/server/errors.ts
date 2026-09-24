/** Errors shared by the server modules. Kept free of Next and Prisma imports. */

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * A record that does not exist *or is not the caller's*. The two are
 * deliberately indistinguishable, so probing ids reveals nothing (§45).
 */
export class NotFoundError extends Error {
  constructor(entity = "record") {
    super(`${entity} not found`);
    this.name = "NotFoundError";
  }
}

/** A request that is well-formed but not allowed in the record's current state. */
export class ConflictError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "ConflictError";
  }
}
