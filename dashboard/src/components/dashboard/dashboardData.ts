import type { Alert } from "../../hooks/useAlerts";

export type EnvironmentalAlert = Pick<Alert, "timestamp" | "measurements">;

export type DashboardLogEntry = Pick<
  Alert,
  "id" | "timestamp" | "device_id" | "measurements" | "sensor_states"
>;
