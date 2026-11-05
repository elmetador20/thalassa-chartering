import 'server-only';

/** The signed-in admin's role does not grant the attempted action. */
export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to do that.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** An expected, user-facing refusal (invalid state transition, duplicate…). */
export class AdminActionError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'AdminActionError';
  }
}
