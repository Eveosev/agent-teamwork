/**
 * Request parsing and validation for the demo HTTP API.
 */

/** An expected client error, carrying the HTTP status the API should return. */
export class ValidationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = statusCode;
  }
}

export interface Credentials {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/** Parse a JSON request body, rejecting malformed documents. */
export function parseJsonBody(raw: string): unknown {
  if (raw.trim() === "") {
    throw new ValidationError("Request body is required");
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

/** Validate and normalise a login payload. */
export function parseCredentials(input: unknown): Credentials {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ValidationError("Request body must be a JSON object");
  }

  const { email, password } = input as Record<string, unknown>;

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    throw new ValidationError("`email` must be a valid email address");
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(
      `\`password\` must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }

  return { email: email.trim().toLowerCase(), password };
}

/**
 * Extract the token from an `Authorization: Bearer <token>` header.
 * The scheme comparison is case-insensitive, as required by RFC 6750.
 */
export function parseBearerToken(header: string | undefined): string {
  if (header === undefined || header.trim() === "") {
    throw new ValidationError("Missing Authorization header", 401);
  }

  const parts = header.trim().split(/\s+/);
  const scheme = parts[0] ?? "";
  const token = parts[1] ?? "";

  if (scheme.toLowerCase() !== "bearer" || token === "" || parts.length !== 2) {
    throw new ValidationError(
      "Authorization header must use the Bearer scheme",
      401,
    );
  }

  return token;
}
