const DASHBOARD_LABELS: Record<string, string> = {
  temperature_c: "Température",
  humidity_pct: "Humidité",
  gas_raw: "Gaz (valeur brute)",
  motion: "Mouvement",
};

export function getDashboardLabel(name: string): string {
  return DASHBOARD_LABELS[name] ?? name;
}
