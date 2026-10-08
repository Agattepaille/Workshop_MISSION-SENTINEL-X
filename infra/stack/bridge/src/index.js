// Pont MQTT -> API REST de la borne Sentinel-X
//
// Role : les cartes de la table publient leurs mesures sur le broker ; ce pont
// les lit et les ecrit dans la base via l API (une seule porte d entree, donc
// un seul endroit ou la validation existe).
//
// Il ne fait AUCUN traitement metier : pas de seuil, pas de "si temperature >
// 40". Le modele predictif (pilier IA) lit la base et decide. Le pont ne fait
// que transporter et mettre en forme.
//
// Contrat des topics (voir infra/stack/docs/guide-connexion-esp.md) :
//   sentinel/table/sensors/<device_id>              charge utile JSON
//   sentinel/table/sensors/<device_id>/<grandeur>   valeur nue (21.4)

import { randomUUID } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import mqtt from "mqtt";

const DEFAULTS = {
  MQTT_URL: "mqtt://mosquitto:1883",
  MQTT_TOPIC: "sentinel/table/sensors/#",
  API_URL: "http://api:3000/api/v1/alerts",
  API_TIMEOUT_MS: "5000",
  // 6 tentatives, delai double a chaque fois : 1 + 2 + 4 + 8 + 16 s, soit une
  // fenetre d environ 31 s. C est ce qu il faut pour absorber le redemarrage
  // complet d un conteneur (l API met une dizaine de secondes a reparler).
  MAX_ATTEMPTS: "6",
  RETRY_BASE_MS: "1000",
  HEALTH_FILE: "/tmp/bridge-health.json",
};

function readConfig() {
  const config = {};
  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    config[key] = process.env[key] ?? fallback;
  }

  // Piege deja rencontre ailleurs dans ce projet (option 12 du fichier
  // AGENTS.md) : un couple identifiant/mot de passe peut sembler complet et ne
  // pas l etre. On verifie donc les DEUX, et on refuse de demarrer plutot que
  // de se connecter anonymement pour se faire rejeter en boucle.
  config.MQTT_USERNAME = process.env.MQTT_USERNAME;
  config.MQTT_PASSWORD = process.env.MQTT_PASSWORD;

  const missing = [];
  if (!config.MQTT_USERNAME) missing.push("MQTT_USERNAME");
  if (!config.MQTT_PASSWORD) missing.push("MQTT_PASSWORD");
  if (missing.length > 0) {
    throw new Error(
      `Variables absentes du .env : ${missing.join(", ")}. Le broker refuse l anonyme.`,
    );
  }

  return config;
}

const config = readConfig();

const stats = {
  startedAt: new Date().toISOString(),
  received: 0,
  forwarded: 0,
  rejected: 0,
  errors: 0,
  lastError: null,
  lastForwardedAt: null,
};

let mqttConnected = false;

function log(level, message, extra = {}) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...extra,
  };
  appendFileSync("/dev/stdout", `${JSON.stringify(line)}\n`);
}

// Etat de sante : lu par le HEALTHCHECK de Docker, qui n a ni HTTP ni CLI
// pour interroger le processus.
function writeHealth() {
  try {
    writeFileSync(
      config.HEALTH_FILE,
      JSON.stringify({
        updated_at: Date.now(),
        connected: mqttConnected,
        ...stats,
      }),
    );
  } catch (cause) {
    log("warn", "Impossible d ecrire le fichier de sante", {
      reason: String(cause),
    });
  }
}

// --- Mise en forme : topics et charges utiles vers une alerte d API ---------

function isValidTimestamp(value) {
  if (typeof value !== "string") return false;
  // L API exige le format RFC 3339 AVEC fuseau : "Z" ou "+02:00".
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

function sanitizeMeasurementName(name) {
  // Noms acceptes par l API : 1 a 64 caracteres.
  return name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
}

function normalizeStates(parsed) {
  const states = {};
  for (const [key, value] of Object.entries(parsed ?? {})) {
    if (key.length === 0) continue;
    const name = sanitizeMeasurementName(key);
    if (typeof value === "boolean") {
      states[name] = value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      states[name] = value === 0 ? false : true;
    } else if (typeof value === "string") {
      states[name] = value.slice(0, 64);
    }
  }
  return states;
}

function normalizeMeasurements(parsed) {
  const measurements = {};
  for (const [key, value] of Object.entries(parsed ?? {})) {
    if (key.length === 0) continue;
    // TOUT ce qui n est pas un nombre fini est rejete : l API le refuserait
    // (et un NaN ferait echouer l ecriture en line protocol).
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    measurements[sanitizeMeasurementName(key)] = value;
  }
  return measurements;
}

function parseTopic(topic) {
  const parts = topic.split("/");
  // sentinel/table/sensors/<device_id>/... -> on garde ce qui suit.
  const index = parts.indexOf("sensors");
  if (index === -1) return null;
  const rest = parts.slice(index + 1);
  const deviceId = (rest[0] ?? "").trim();
  if (deviceId.length === 0 || deviceId.length > 128) return null;
  return {
    deviceId,
    quantity: rest.slice(1).join("_") || null,
  };
}

// Le coeur du pont : cinq formes de trames acceptees, une seule sortie.
function buildAlert(topic, rawPayload) {
  const parsedTopic = parseTopic(topic);
  if (!parsedTopic) {
    return { ok: false, reason: "Topic hors du perimetre attendu." };
  }

  const payloadText = rawPayload.toString("utf8").trim();
  const alert = {
    device_id: parsedTopic.deviceId,
    measurements: {},
    sensor_states: {},
  };

  let parsed = null;
  try {
    parsed = JSON.parse(payloadText);
  } catch {
    parsed = Number(payloadText);
    if (!Number.isFinite(parsed)) parsed = null;
  }

  if (parsed === null) {
    return {
      ok: false,
      reason: "Charge utile ni JSON ni numerique, ignoree (borne).",
    };
  }

  if (typeof parsed === "number") {
    // valeur nue : le nom vient du topic, sinon "value".
    alert.measurements[sanitizeMeasurementName(parsedTopic.quantity ?? "value")] =
      parsed;
  } else if (typeof parsed === "object" && !Array.isArray(parsed)) {
    const structured =
      "measurements" in parsed || "sensor_states" in parsed || "timestamp" in parsed;
    if (structured) {
      Object.assign(alert.measurements, normalizeMeasurements(parsed.measurements));
      Object.assign(alert.sensor_states, normalizeStates(parsed.sensor_states));
      alert.timestamp = parsed.timestamp;
    } else {
      // objet plat : les nombres deviennent des mesures, le reste des etats.
      Object.assign(alert.measurements, normalizeMeasurements(parsed));
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          Object.assign(alert.sensor_states, normalizeStates({ [key]: value }));
        }
      }
    }
  } else {
    return { ok: false, reason: "Charge utile non exploitable (borne)." };
  }

  if (alert.timestamp === undefined || !isValidTimestamp(alert.timestamp)) {
    if (alert.timestamp !== undefined) {
      log("warn", "Horodatage invalide, remplace par l heure de reception", {
        device_id: alert.device_id,
      });
    }
    alert.timestamp = new Date().toISOString();
  }

  if (Object.keys(alert.measurements).length === 0 &&
      Object.keys(alert.sensor_states).length === 0) {
    return { ok: false, reason: "Aucune mesure exploitable dans la trame." };
  }

  return { ok: true, alert };
}

// --- Emission vers l API ----------------------------------------------------

async function postAlert(alert) {
  const attempts = Number(config.MAX_ATTEMPTS);
  const baseDelay = Number(config.RETRY_BASE_MS);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Number(config.API_TIMEOUT_MS),
    );
    try {
      const response = await fetch(config.API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": randomUUID(),
        },
        body: JSON.stringify(alert),
        signal: controller.signal,
      });

      if (response.ok) {
        return { ok: true, status: response.status };
      }

      const body = await response.text().catch(() => "");
      // 4xx : la trame est mauvaise, reessayer ne changera rien.
      if (response.status >= 400 && response.status < 500) {
        return { ok: false, status: response.status, body, retryable: false };
      }
      return { ok: false, status: response.status, body, retryable: true };
    } catch (cause) {
      stats.lastError = String(cause);
      if (attempt === attempts) {
        return { ok: false, status: 0, body: String(cause), retryable: true };
      }
    } finally {
      clearTimeout(timer);
    }

    await new Promise((resolve) =>
      setTimeout(resolve, baseDelay * 2 ** (attempt - 1)),
    );
  }

  return { ok: false, status: 0, body: "epuise", retryable: true };
}

// --- Boucle principale ------------------------------------------------------

let inflight = 0;

async function handleMessage(topic, payload, packet) {
  stats.received += 1;

  const result = buildAlert(topic, payload);
  if (!result.ok) {
    stats.rejected += 1;
    log("warn", "Trame ignoree", { topic, reason: result.reason });
    return;
  }

  inflight += 1;
  try {
    const outcome = await postAlert(result.alert);
    if (outcome.ok) {
      stats.forwarded += 1;
      stats.lastForwardedAt = new Date().toISOString();
      log("info", "Mesure transmise a l API", {
        topic,
        device_id: result.alert.device_id,
        status: outcome.status,
      });
    } else {
      stats.errors += 1;
      log("error", "Echec de transmission", {
        topic,
        status: outcome.status,
        body: String(outcome.body ?? "").slice(0, 300),
        retryable: outcome.retryable,
      });
    }
  } catch (cause) {
    // Filet de securite : une trame ne doit jamais tuer le pont.
    stats.errors += 1;
    log("error", "Erreur inattendue", { topic, reason: String(cause) });
  } finally {
    inflight -= 1;
  }
}

function start() {
  log("info", "Demarrage du pont", {
    broker: config.MQTT_URL,
    topic: config.MQTT_TOPIC,
    api: config.API_URL,
  });

  const client = mqtt.connect(config.MQTT_URL, {
    username: config.MQTT_USERNAME,
    password: config.MQTT_PASSWORD,
    // Le pont est un consommateur fiable : QoS 1, file d attente bornee pour
    // ne pas saturer la memoire si l API tombe.
    queueQoSZero: false,
    reconnectPeriod: 3000,
    connectTimeout: 8000,
    clientId: `sentinel-mqtt-bridge-${process.pid}`,
  });

  client.on("connect", () => {
    mqttConnected = true;
    log("info", "Connecte au broker");
    client.subscribe(config.MQTT_TOPIC, { qos: 1 }, (error) => {
      if (error) {
        log("error", "Abonnement impossible", { reason: String(error) });
        return;
      }
      log("info", "Abonne", { topic: config.MQTT_TOPIC });
    });
  });

  client.on("reconnect", () => {
    log("warn", "Reconnexion au broker en cours");
  });

  client.on("close", () => {
    mqttConnected = false;
    log("warn", "Connexion au broker fermee");
  });

  client.on("error", (error) => {
    stats.errors += 1;
    stats.lastError = String(error);
    log("error", "Erreur broker", { reason: String(error) });
  });

  client.on("message", (topic, payload, packet) => {
    void handleMessage(topic, payload, packet);
  });

  // Rapport periodique : c est ce qui rend un incident visible dans les logs
  // sans deviner. Toutes les 5 minutes.
  const report = setInterval(() => {
    log("info", "Etat du pont", {
      received: stats.received,
      forwarded: stats.forwarded,
      rejected: stats.rejected,
      errors: stats.errors,
      inflight,
      mqtt_connected: mqttConnected,
    });
  }, 5 * 60 * 1000);

  const health = setInterval(writeHealth, 5000);
  writeHealth();

  const shutdown = (signal) => {
    log("info", "Arret demande", { signal });
    clearInterval(report);
    clearInterval(health);
    client.end(true, () => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

try {
  start();
} catch (cause) {
  log("error", "Arret immediat", { reason: String(cause) });
  process.exit(1);
}
