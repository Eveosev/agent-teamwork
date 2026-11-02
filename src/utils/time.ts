/**
 * Time helpers shared by the session store and the HTTP layer.
 */

const UNIT_MS = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

type DurationUnit = keyof typeof UNIT_MS;

const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/;

/**
 * Parse a compact duration such as "500ms", "30s", "15m", "1h" or "7d"
 * into milliseconds. Throws `RangeError` for malformed or zero-length values.
 */
export function parseDuration(input: string): number {
  const match = DURATION_PATTERN.exec(input.trim());
  if (!match) {
    throw new RangeError(
      `Invalid duration ${JSON.stringify(input)}; expected a value like "30s", "15m", "1h" or "7d"`,
    );
  }

  const rawAmount = match[1] ?? "";
  const rawUnit = match[2] ?? "";
  if (!(rawUnit in UNIT_MS)) {
    throw new RangeError(`Unsupported duration unit ${JSON.stringify(rawUnit)}`);
  }

  const unit = rawUnit as DurationUnit;
  const durationMs = Number(rawAmount) * UNIT_MS[unit];
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) {
    throw new RangeError(`Duration must be a positive, finite number of milliseconds`);
  }

  return durationMs;
}

/**
 * Whether a deadline has passed.
 *
 * A deadline is considered expired once the current time reaches or passes it.
 */
export function isExpired(expiresAt: number, now: number = Date.now()): boolean {
  return now > expiresAt;
}
