import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const COMMAND_ACTIONS = new Set(["buzzer.trigger", "leds.test", "leds.auto"]);
const MAX_RETAINED_COMMANDS = 500;
const DEFAULT_ACK_TIMEOUT_MS = 5000;
const MAX_ACK_TIMEOUT_MS = 60_000;

export class CommandValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "CommandValidationError";
    this.details = details;
  }
}

export class CommandDispatchError extends Error {
  constructor(message) {
    super(message);
    this.name = "CommandDispatchError";
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function publicCommand(command) {
  return {
    command_id: command.command_id,
    device_id: command.device_id,
    action: command.action,
    status: command.status,
    created_at: command.created_at,
    updated_at: command.updated_at,
    ...(command.error ? { error: command.error } : {}),
  };
}

function validateCommand(value) {
  if (!isRecord(value)) {
    throw new CommandValidationError("Command must be a JSON object.");
  }

  const details = [];
  for (const key of Object.keys(value)) {
    if (key !== "device_id" && key !== "action") {
      details.push({ field: key, message: "Unknown field." });
    }
  }

  if (
    typeof value.device_id !== "string" ||
    !DEVICE_ID_PATTERN.test(value.device_id)
  ) {
    details.push({
      field: "device_id",
      message:
        "device_id must be 1-128 characters and contain only letters, numbers, dots, underscores, or hyphens.",
    });
  }
  if (typeof value.action !== "string" || !COMMAND_ACTIONS.has(value.action)) {
    details.push({
      field: "action",
      message: `action must be one of: ${[...COMMAND_ACTIONS].join(", ")}.`,
    });
  }

  if (details.length > 0) {
    throw new CommandValidationError(
      "Command contains invalid fields.",
      details,
    );
  }

  return { device_id: value.device_id, action: value.action };
}

function validateTimeout(value) {
  const timeout = Number(value);
  if (
    !Number.isInteger(timeout) ||
    timeout < 1 ||
    timeout > MAX_ACK_TIMEOUT_MS
  ) {
    throw new Error(
      `COMMAND_ACK_TIMEOUT_MS must be an integer between 1 and ${MAX_ACK_TIMEOUT_MS}.`,
    );
  }
  return timeout;
}

export function createCommandService({
  mqttCommandClient,
  ackTimeoutMs = process.env.COMMAND_ACK_TIMEOUT_MS ?? DEFAULT_ACK_TIMEOUT_MS,
} = {}) {
  if (!mqttCommandClient) {
    throw new Error("An MQTT command client is required.");
  }

  const timeout = validateTimeout(ackTimeoutMs);
  const commands = new Map();
  const events = new EventEmitter();

  function updateCommand(command, status, errorMessage) {
    if (command.status !== "pending") return;
    if (command.timeout) clearTimeout(command.timeout);
    const updated = {
      ...command,
      status,
      updated_at: new Date().toISOString(),
      ...(errorMessage ? { error: errorMessage } : {}),
    };
    delete updated.timeout;
    commands.set(command.command_id, updated);
    events.emit("updated", updated);
  }

  function handleCommandResult(result) {
    if (!isRecord(result)) {
      console.error("Ignoring an invalid MQTT command result envelope.");
      return;
    }
    const { deviceId, payload } = result;
    if (
      typeof deviceId !== "string" ||
      !isRecord(payload) ||
      Object.keys(payload).some(
        (key) => !["command_id", "status", "error"].includes(key),
      ) ||
      typeof payload.command_id !== "string" ||
      !["completed", "failed"].includes(payload.status) ||
      (payload.status === "completed" && payload.error !== undefined) ||
      (payload.status === "failed" &&
        (typeof payload.error !== "string" ||
          payload.error.trim().length === 0 ||
          payload.error.length > 256))
    ) {
      console.error("Ignoring an invalid MQTT command result.");
      return;
    }

    const command = commands.get(payload.command_id);
    if (
      !command ||
      command.status !== "pending" ||
      command.device_id !== deviceId
    ) {
      console.error(
        `Ignoring an unmatched MQTT command result for ${payload.command_id}.`,
      );
      return;
    }

    updateCommand(
      command,
      payload.status,
      payload.status === "failed" ? payload.error : undefined,
    );
  }

  mqttCommandClient.on("command-result", handleCommandResult);

  function trimCommands() {
    while (commands.size >= MAX_RETAINED_COMMANDS) {
      const oldestTerminal = [...commands.entries()].find(
        ([, command]) => command.status !== "pending",
      );
      if (!oldestTerminal) {
        throw new CommandDispatchError(
          "The API has reached its limit of pending commands.",
        );
      }
      commands.delete(oldestTerminal[0]);
    }
  }

  return {
    on(eventName, listener) {
      events.on(eventName, listener);
    },

    async create(input) {
      const { device_id: deviceId, action } = validateCommand(input);
      trimCommands();

      const createdAt = new Date().toISOString();
      const commandId = randomUUID();
      const command = {
        command_id: commandId,
        device_id: deviceId,
        action,
        status: "pending",
        created_at: createdAt,
        updated_at: createdAt,
      };
      const pending = { ...command };
      commands.set(commandId, pending);

      const payload = {
        command_id: commandId,
        device_id: deviceId,
        action,
        ...(action === "buzzer.trigger" ? { duration_ms: 5000 } : {}),
      };

      try {
        await mqttCommandClient.publishCommand({ deviceId, payload });
      } catch (error) {
        commands.delete(commandId);
        throw new CommandDispatchError(
          error instanceof Error
            ? error.message
            : "The MQTT broker could not accept the command.",
        );
      }

      const stillPending = commands.get(commandId);
      if (stillPending?.status === "pending") {
        stillPending.timeout = setTimeout(() => {
          updateCommand(stillPending, "unconfirmed");
        }, timeout);
        stillPending.timeout.unref?.();
        events.emit("updated", publicCommand(stillPending));
      }

      return publicCommand(commands.get(commandId));
    },

    get(commandId) {
      const command = commands.get(commandId);
      return command ? publicCommand(command) : null;
    },

    close() {
      for (const command of commands.values()) {
        if (command.timeout) clearTimeout(command.timeout);
      }
      mqttCommandClient.off("command-result", handleCommandResult);
      events.removeAllListeners();
    },
  };
}
