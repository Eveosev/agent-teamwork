import { describe, expect, it } from "vitest";
import { SessionStore } from "../src/auth/session";

describe("SessionStore", () => {
  it("creates a session with a TTL-derived expiry", () => {
    const store = new SessionStore(60_000);
    const session = store.create("agent@example.com", 10_000);

    expect(session.userId).toBe("agent@example.com");
    expect(session.createdAt).toBe(10_000);
    expect(session.expiresAt).toBe(70_000);
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns an active session and keeps it in the store", () => {
    const store = new SessionStore(60_000);
    const session = store.create("agent@example.com", 1_000);

    expect(store.get(session.id, 30_000)).toEqual(session);
    expect(store.size).toBe(1);
  });

  it("evicts a session once its TTL has elapsed", () => {
    const store = new SessionStore(60_000);
    const session = store.create("agent@example.com", 1_000);

    expect(store.get(session.id, session.expiresAt + 1)).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it("revokes a session and reports whether it existed", () => {
    const store = new SessionStore();
    const session = store.create("agent@example.com");

    expect(store.revoke(session.id)).toBe(true);
    expect(store.get(session.id)).toBeUndefined();
    expect(store.revoke(session.id)).toBe(false);
  });

  it("returns undefined for an unknown session id", () => {
    const store = new SessionStore();
    expect(store.get("does-not-exist")).toBeUndefined();
  });

  it("rejects a non-positive TTL", () => {
    expect(() => new SessionStore(0)).toThrow(RangeError);
    expect(() => new SessionStore(-1)).toThrow(RangeError);
  });
});
