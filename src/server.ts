import { createApp } from "./app";
import { parseDuration } from "./utils/time";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  console.error(`Invalid PORT: ${process.env.PORT ?? "(unset)"}`);
  process.exit(1);
}

const sessionTtlMs = parseDuration(process.env.SESSION_TTL ?? "1h");
const server = createApp({ sessionTtlMs });

server.listen(port, () => {
  console.log(`agent-teamwork listening on http://localhost:${port}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}; shutting down`);
  server.close((error) => {
    if (error) {
      console.error("Failed to close HTTP server", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
