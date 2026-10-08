import { Suspense, lazy, useCallback, useMemo, useState, type ReactElement } from "react";
import {
  Activity,
  AlertTriangle,
  Server,
  Thermometer,
  Wind,
} from "lucide-react";

import { useAlerts } from "../hooks/useAlerts";
import CameraPanel, {
  type CameraDetectionSummary,
} from "./dashboard/CameraPanel";
import DashboardControls from "./dashboard/DashboardControls";
import DashboardFooter from "./dashboard/DashboardFooter";
import KpiCard from "./dashboard/KpiCard";
import {
  commandTargets,
  configuredDeviceIds,
} from "../config/deviceCommandTargets";
import { useDeviceCommands } from "../hooks/useDeviceCommands";

const numberFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

const EnvironmentalCharts = lazy(
  () => import("./dashboard/EnvironmentalCharts"),
);

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fr-FR");
}

export default function SentinelDashboard(): ReactElement {
  const [cameraDetection, setCameraDetection] =
    useState<CameraDetectionSummary>({
      serviceStatus: "connecting",
      cameraStatus: "starting",
      count: 0,
      confidence: 0,
    });
  const {
    alerts,
    chartAlerts,
    loadChartHistory,
    loading,
    error,
    connectionStatus,
    deviceStatuses,
    deviceStatusError,
    commandUpdates,
  } = useAlerts(configuredDeviceIds);
  const {
    commands,
    latestCommand,
    submittingActions,
    error: commandError,
    statusError,
    sendCommand,
  } = useDeviceCommands(commandUpdates, connectionStatus);

  const handleDetectionChange = useCallback(
    (summary: CameraDetectionSummary) => setCameraDetection(summary),
    [],
  );

  const latestAlert = alerts[0];
  const latestMeasurementAlert = (name: string) =>
    alerts.find((alert) => typeof alert.measurements[name] === "number");
  const temperatureAlert = latestMeasurementAlert("temperature");
  const humidityAlert = latestMeasurementAlert("humidity");
  const gasAlert = latestMeasurementAlert("gasRaw");
  const temperature = temperatureAlert?.measurements.temperature;
  const humidity = humidityAlert?.measurements.humidity;
  const gasRaw = gasAlert?.measurements.gasRaw;
  const chartHistory = useMemo(
    () =>
      chartAlerts.map(({ timestamp, measurements: alertMeasurements }) => ({
        timestamp,
        measurements: alertMeasurements,
      })),
    [chartAlerts],
  );
  const logEntries = useMemo(
    () =>
      alerts.map(
        ({ id, timestamp, device_id, measurements, sensor_states }) => ({
          id,
          timestamp,
          device_id,
          measurements,
          sensor_states,
        }),
      ),
    [alerts],
  );
  const environmentReadings = [
    typeof temperature === "number"
      ? `${numberFormat.format(temperature)} °C`
      : null,
    typeof humidity === "number"
      ? `${numberFormat.format(humidity)} %`
      : null,
  ].filter((reading): reading is string => reading !== null);
  const environmentReadingTimes = [
    temperatureAlert
      ? `Température : ${formatDateTime(temperatureAlert.timestamp)}`
      : null,
    humidityAlert
      ? `Humidité : ${formatDateTime(humidityAlert.timestamp)}`
      : null,
  ]
    .filter((reading): reading is string => reading !== null)
    .join(" • ");
  const noDataValue = loading
    ? "Chargement…"
    : error
      ? "Indisponible"
      : "Aucune donnée";

  const detectionValue =
    cameraDetection.serviceStatus === "connecting"
      ? "Connexion en cours"
      : cameraDetection.serviceStatus === "disconnected"
        ? "IA déconnectée"
        : cameraDetection.cameraStatus === "starting"
          ? "Caméra en initialisation"
          : cameraDetection.cameraStatus === "unavailable"
            ? "Caméra indisponible"
            : cameraDetection.cameraStatus === "error"
              ? "Erreur de détection"
              : cameraDetection.count > 0
                ? `${cameraDetection.count} intrus détecté${cameraDetection.count > 1 ? "s" : ""}`
                : "Aucun intrus";
  const detectionSubtext =
    cameraDetection.serviceStatus === "connecting"
      ? "Connexion au service de vision"
      : cameraDetection.serviceStatus === "disconnected"
        ? "Vérifiez que le serveur YOLO est démarré"
        : cameraDetection.cameraStatus === "starting"
          ? "Initialisation de la caméra et du modèle"
          : cameraDetection.cameraStatus === "unavailable"
            ? "Vérifiez que la caméra est branchée et activée"
            : cameraDetection.cameraStatus === "error"
              ? "Consultez les logs du serveur IA"
              : cameraDetection.count > 0
                ? `YOLOv8 • Confiance : ${cameraDetection.confidence}%`
                : "YOLOv8 • Surveillance active";
  const detectionAlert =
    cameraDetection.serviceStatus === "connected" &&
    (cameraDetection.count > 0 || cameraDetection.cameraStatus === "error");

  return (
    <div className="dark flex min-h-screen bg-black font-sans text-neutral-300">
      <DashboardControls
        deviceIds={commandTargets}
        deviceStatuses={deviceStatuses}
        commands={commands}
        latestCommand={latestCommand}
        submittingActions={submittingActions}
        error={commandError}
        statusError={[deviceStatusError, statusError]
          .filter((message): message is string => message !== null)
          .join(" ")}
        onSendCommand={sendCommand}
      />

      <main className="flex h-screen flex-1 flex-col overflow-hidden">
        <section className="grid grid-cols-5 border-b border-neutral-800">
          <KpiCard
            title="Statut Système"
            value="Opérationnel"
            subtext="Uptime: 72j • CPU 48% • RAM 63%"
            icon={Server}
            iconColor="text-emerald-500"
          />

          <KpiCard
            title="Température DHT22"
            value={
              environmentReadings.length > 0
                ? environmentReadings.join(" / ")
                : latestAlert
                  ? "Non transmise"
                  : noDataValue
            }
            subtext={environmentReadingTimes || "En attente d’une alerte."}
            icon={Thermometer}
            iconColor="text-cyan-400"
          />

          <KpiCard
            title="Niveau Gaz MQ-2"
            value={
              typeof gasRaw === "number"
                ? `${numberFormat.format(gasRaw)} (brut)`
                : latestAlert
                  ? "Non transmis"
                  : noDataValue
            }
            subtext={
              gasAlert
                ? `Dernière lecture : ${formatDateTime(gasAlert.timestamp)}`
                : latestAlert
                  ? "Non transmis"
                  : "En attente d’une alerte."
            }
            icon={Wind}
            iconColor="text-amber-500"
          />

          <KpiCard
            title="Détection IA"
            value={detectionValue}
            subtext={detectionSubtext}
            icon={Activity}
            iconColor={
              cameraDetection.serviceStatus !== "connected" ||
              cameraDetection.count > 0 ||
              cameraDetection.cameraStatus === "error"
                ? "text-red-500"
                : "text-emerald-500"
            }
            alert={detectionAlert}
          />

          <KpiCard
            title="Dernière alerte"
            value={latestAlert?.device_id ?? noDataValue}
            subtext={
              latestAlert
                ? formatDateTime(latestAlert.timestamp)
                : "Aucune alerte active"
            }
            icon={AlertTriangle}
            iconColor={latestAlert ? "text-red-500" : "text-emerald-500"}
            alert={Boolean(latestAlert)}
          />
        </section>

        <section className="flex flex-1 overflow-hidden">
          <CameraPanel onDetectionChange={handleDetectionChange} />
          <Suspense
            fallback={
              <div
                className="w-[400px] min-w-[400px] overflow-y-auto bg-black p-6 text-sm text-neutral-500"
                role="status"
              >
                Chargement des graphiques…
              </div>
            }
          >
            <EnvironmentalCharts
              history={chartHistory}
              onPeriodChange={loadChartHistory}
              loading={loading}
              error={error}
            />
          </Suspense>
        </section>

        <DashboardFooter
          entries={logEntries}
          connectionStatus={connectionStatus}
          loading={loading}
          error={error}
        />
      </main>
    </div>
  );
}
