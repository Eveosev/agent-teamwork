import { randomUUID } from "node:crypto";
import { isExpired, parseDuration } from "../utils/time";

export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export const DEFAULT_SESSION_TTL_MS = parseDuration("1h");

/**
 * In-memory session storage. A real deployment would swap this for Redis or a
 * database; for the demo target an in-memory Map keeps the surface small.
 */
export class SessionStore {
  readonly #sessions = new Map<string, Session>();
  readonly #ttlMs: number;

  constructor(ttlMs: number = DEFAULT_SESSION_TTL_MS) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new RangeError("Session TTL must be a positive number of milliseconds");
    }
    this.#ttlMs = ttlMs;
  }

  get ttlMs(): number {
    return this.#ttlMs;
  }

  get size(): number {
    return this.#sessions.size;
  }

  create(userId: string, now: number = Date.now()): Session {
    const session: Session = {
      id: randomUUID(),
      userId,
      createdAt: now,
      expiresAt: now + this.#ttlMs,
    };
    this.#sessions.set(session.id, session);
    return session;
  }

  /**
   * Look up a session. Expired sessions are evicted and treated as missing.
   */
  get(id: string, now: number = Date.now()): Session | undefined {
    const session = this.#sessions.get(id);
    if (!session) {
      return undefined;
    }
    if (isExpired(session.expiresAt, now)) {
      this.#sessions.delete(id);
      return undefined;
    }
    return session;
  }

  revoke(id: string): boolean {
    return this.#sessions.delete(id);
  }

  clear(): void {
    this.#sessions.clear();
  }
}
