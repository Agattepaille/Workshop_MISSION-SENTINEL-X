import { readFile } from "node:fs/promises";

const datasetPath = new URL("../test/fixtures/alerts.json", import.meta.url);
const alerts = JSON.parse(await readFile(datasetPath, "utf8"));
const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);
const endpoint = `${baseUrl}/api/v1/alerts`;

async function sendDataset() {
  for (const [index, alert] of alerts.entries()) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(alert),
    });
    const responseBody = await response.json();

    if (!response.ok) {
      throw new Error(
        `Alert ${index + 1} rejected (${response.status}): ${JSON.stringify(responseBody)}`,
      );
    }

    console.log(
      `Alert ${index + 1}/${alerts.length} saved with id ${responseBody.data.id} (${alert.device_id})`,
    );
  }
}

sendDataset().catch((error) => {
  console.error(`Could not send the alert dataset to ${endpoint}:`, error);
  process.exitCode = 1;
});
