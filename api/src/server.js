import "dotenv/config";
import { createServer } from "node:http";
import { resolve } from "node:path";
import WebSocket, { WebSocketServer } from "ws";
import { createAlertRepository } from "./persistence/alert-repository.influx.js";
import {
  AlertValidationError,
  createAlertWriteService,
} from "./services/alert-write-service.js";
import {
  AlertReadValidationError,
  createAlertReadService,
} from "./services/alert-read-service.js";

const ALERTS_PATH = "/api/v1/alerts";
const WEBSOCKET_PATH = "/ws";
const MAX_BODY_BYTES = 16 * 1024;

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const contentType = request.headers["content-type"]
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError(
      415,
      "unsupported_media_type",
      "Content-Type must be application/json.",
    );
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(
        413,
        "payload_too_large",
        `Request body must not exceed ${MAX_BODY_BYTES} bytes.`,
      );
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(
      400,
      "invalid_json",
      "Request body must contain valid JSON.",
    );
  }
}

export function createAlertServer({ alertRepository } = {}) {
  const repository = alertRepository ?? createAlertRepository();
  const alertWriteService = createAlertWriteService({
    alertRepository: repository,
  });
  const alertReadService = createAlertReadService({
    alertRepository: repository,
  });
  const websocketServer = new WebSocketServer({ noServer: true });

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://localhost");
    const { pathname } = requestUrl;
    if (pathname !== ALERTS_PATH) {
      sendJson(response, 404, {
        error: { code: "not_found", message: "Route not found." },
      });
      return;
    }

    if (request.method === "GET") {
      try {
        const allowedQueryParameters = new Set(["limit", "cursor"]);
        for (const name of requestUrl.searchParams.keys()) {
          if (!allowedQueryParameters.has(name)) {
            throw new AlertReadValidationError(
              "Invalid alert query parameters.",
              [{ field: name, message: "Unknown query parameter." }],
            );
          }
          if (requestUrl.searchParams.getAll(name).length !== 1) {
            throw new AlertReadValidationError(
              "Invalid alert query parameters.",
              [{ field: name, message: "Query parameter must appear once." }],
            );
          }
        }

        const result = await alertReadService.list({
          limit: requestUrl.searchParams.get("limit") ?? undefined,
          cursor: requestUrl.searchParams.get("cursor") ?? undefined,
        });
        sendJson(response, 200, result);
      } catch (error) {
        if (error instanceof AlertReadValidationError) {
          sendJson(response, 400, {
            error: {
              code: "invalid_query",
              message: error.message,
              ...(error.details.length > 0 ? { details: error.details } : {}),
            },
          });
          return;
        }

        console.error("Failed to read alerts:", error);
        sendJson(response, 500, {
          error: {
            code: "internal_error",
            message: "The alerts could not be retrieved.",
          },
        });
      }
      return;
    }

    if (request.method !== "POST") {
      sendJson(
        response,
        405,
        {
          error: {
            code: "method_not_allowed",
            message: "Use GET or POST for this route.",
          },
        },
        {
          allow: "GET, POST",
        },
      );
      return;
    }

    try {
      const savedAlert = await alertWriteService.create(
        await readJsonBody(request),
      );
      const notification = JSON.stringify({
        type: "alert.created",
        data: savedAlert,
      });

      for (const client of websocketServer.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(notification, (error) => {
            if (error) {
              console.error(
                "Failed to send alert to a WebSocket client:",
                error,
              );
            }
          });
        }
      }

      sendJson(response, 201, { data: savedAlert });
    } catch (error) {
      if (error instanceof HttpError) {
        const errorBody = { code: error.code, message: error.message };
        if (error.details) errorBody.details = error.details;
        sendJson(response, error.status, { error: errorBody });
        return;
      }
      if (error instanceof AlertValidationError) {
        sendJson(response, 422, {
          error: {
            code: "validation_failed",
            message: error.message,
            ...(error.details.length > 0 ? { details: error.details } : {}),
          },
        });
        return;
      }

      console.error("Failed to process alert:", error);
      sendJson(response, 500, {
        error: {
          code: "internal_error",
          message: "The alert could not be processed.",
        },
      });
    }
  });

  server.on("upgrade", (request, socket, head) => {
    let pathname;
    try {
      pathname = new URL(request.url, "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }

    if (pathname !== WEBSOCKET_PATH) {
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit("connection", websocket, request);
    });
  });

  return {
    server,
    async close() {
      for (const client of websocketServer.clients) {
        client.close(1001, "Server shutting down");
      }
      if (server.listening) {
        await new Promise((resolveClose, rejectClose) => {
          server.close((error) =>
            error ? rejectClose(error) : resolveClose(),
          );
        });
      }
      websocketServer.close();
      await repository.close();
    },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
) {
  const app = createAlertServer();
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";

  app.server.listen(port, host, () => {
    console.log(`SENTINEL-X API listening on http://${host}:${port}`);
    console.log(
      `WebSocket alerts available at ws://${host}:${port}${WEBSOCKET_PATH}`,
    );
  });

  const shutdown = () => {
    app
      .close()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error("Failed to shut down cleanly:", error);
        process.exitCode = 1;
      });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
