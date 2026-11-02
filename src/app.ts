import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { SessionStore } from "./auth/session";
import {
  ValidationError,
  parseBearerToken,
  parseCredentials,
  parseJsonBody,
} from "./http/validation";
import { parseDuration } from "./utils/time";

export interface AppOptions {
  /** Lifetime of newly created sessions. Defaults to `SESSION_TTL` or one hour. */
  sessionTtlMs?: number;
  /** Demo login email. Defaults to `DEMO_EMAIL` or `demo@example.com`. */
  demoEmail?: string;
  /** Demo login password. Defaults to `DEMO_PASSWORD` or `password123`. */
  demoPassword?: string;
}

const MAX_BODY_BYTES = 16 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw new ValidationError("Request body must be 16 KiB or smaller", 413);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Build the HTTP server. Kept as a factory so tests can run it on an ephemeral
 * port and inject credentials/TTL without touching the environment.
 */
export function createApp(options: AppOptions = {}): Server {
  const sessions = new SessionStore(
    options.sessionTtlMs ?? parseDuration(process.env.SESSION_TTL ?? "1h"),
  );
  const demoEmail = (
    options.demoEmail ??
    process.env.DEMO_EMAIL ??
    "demo@example.com"
  )
    .trim()
    .toLowerCase();
  const demoPassword =
    options.demoPassword ?? process.env.DEMO_PASSWORD ?? "password123";

  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const segments = url.pathname.split("/").filter(Boolean);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/sessions") {
      const rawBody = await readBody(req);
      const credentials = parseCredentials(parseJsonBody(rawBody));

      if (
        credentials.email !== demoEmail ||
        credentials.password !== demoPassword
      ) {
        sendJson(res, 401, { error: "Invalid email or password" });
        return;
      }

      const session = sessions.create(credentials.email);
      sendJson(res, 201, {
        token: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
      });
      return;
    }

    if (segments[0] === "sessions" && segments.length === 2) {
      const sessionId = segments[1] ?? "";

      if (req.method === "GET" || req.method === "DELETE") {
        const token = parseBearerToken(req.headers.authorization);
        if (token !== sessionId) {
          throw new ValidationError(
            "Bearer token does not match the requested session",
            403,
          );
        }

        if (req.method === "GET") {
          const session = sessions.get(sessionId);
          if (!session) {
            sendJson(res, 404, { error: "Session not found" });
            return;
          }
          sendJson(res, 200, { session });
          return;
        }

        if (!sessions.revoke(sessionId)) {
          sendJson(res, 404, { error: "Session not found" });
          return;
        }
        res.writeHead(204).end();
        return;
      }
    }

    sendJson(res, 404, { error: "Not found" });
  }

  return createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (error instanceof ValidationError) {
        sendJson(res, error.statusCode, { error: error.message });
        return;
      }
      console.error("Unhandled request error", error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error" });
      }
    });
  });
}
