import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/app";

const DEMO_EMAIL = "agent@example.com";
const DEMO_PASSWORD = "correct-horse";

let server: Server;
let baseUrl: string;

interface SessionResponse {
  token: string;
  userId: string;
  expiresAt: number;
}

beforeAll(async () => {
  server = createApp({
    sessionTtlMs: 60_000,
    demoEmail: DEMO_EMAIL,
    demoPassword: DEMO_PASSWORD,
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected the test server to bind a TCP port");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function login(
  body: Record<string, unknown> = {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  },
): Promise<Response> {
  return fetch(`${baseUrl}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createSession(): Promise<SessionResponse> {
  const response = await login();
  expect(response.status).toBe(201);
  return (await response.json()) as SessionResponse;
}

describe("GET /health", () => {
  it("reports that the service is up", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("POST /sessions", () => {
  it("issues a session token for valid demo credentials", async () => {
    const session = await createSession();

    expect(session.userId).toBe(DEMO_EMAIL);
    expect(session.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{oops",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/valid JSON/),
    });
  });

  it("rejects an invalid email with 400", async () => {
    const response = await login({ email: "not-an-email", password: DEMO_PASSWORD });

    expect(response.status).toBe(400);
  });

  it("rejects an incorrect password with 401", async () => {
    const response = await login({ email: DEMO_EMAIL, password: "wrong-password" });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid email or password",
    });
  });
});

describe("GET /sessions/:id", () => {
  it("returns the session when the bearer token matches", async () => {
    const session = await createSession();

    const response = await fetch(`${baseUrl}/sessions/${session.token}`, {
      headers: { authorization: `Bearer ${session.token}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { session: { id: string; userId: string } };
    expect(body.session.id).toBe(session.token);
    expect(body.session.userId).toBe(DEMO_EMAIL);
  });

  it("requires an authorization header", async () => {
    const session = await createSession();

    const response = await fetch(`${baseUrl}/sessions/${session.token}`);

    expect(response.status).toBe(401);
  });

  it("rejects a token belonging to a different session with 403", async () => {
    const first = await createSession();
    const second = await createSession();

    const response = await fetch(`${baseUrl}/sessions/${first.token}`, {
      headers: { authorization: `Bearer ${second.token}` },
    });

    expect(response.status).toBe(403);
  });

  it("returns 404 for an unknown session", async () => {
    const unknownId = "00000000-0000-4000-8000-000000000000";

    const response = await fetch(`${baseUrl}/sessions/${unknownId}`, {
      headers: { authorization: `Bearer ${unknownId}` },
    });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /sessions/:id", () => {
  it("revokes the session and makes it unreadable", async () => {
    const session = await createSession();
    const headers = { authorization: `Bearer ${session.token}` };

    const deleteResponse = await fetch(`${baseUrl}/sessions/${session.token}`, {
      method: "DELETE",
      headers,
    });
    expect(deleteResponse.status).toBe(204);

    const getResponse = await fetch(`${baseUrl}/sessions/${session.token}`, {
      headers,
    });
    expect(getResponse.status).toBe(404);
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404", async () => {
    const response = await fetch(`${baseUrl}/nope`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});
