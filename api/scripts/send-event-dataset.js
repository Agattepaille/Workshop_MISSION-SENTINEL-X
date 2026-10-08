import { readFile } from "node:fs/promises";

const datasetPath = new URL("../test/fixtures/events.json", import.meta.url);
const fixtureEvents = JSON.parse(await readFile(datasetPath, "utf8"));
const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);
const eventsEndpoint = `${baseUrl}/api/v1/events`;
const latestEventEndpoint = `${eventsEndpoint}/latest`;

function createRunEvents(dataset) {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    throw new Error("The event fixture must contain at least one event.");
  }

  const timestamps = dataset.map((event) => Date.parse(event.timestamp));
  if (
    timestamps.some((timestamp) => !Number.isFinite(timestamp)) ||
    timestamps.some(
      (timestamp, index) => index > 0 && timestamp <= timestamps[index - 1],
    )
  ) {
    throw new Error("Fixture event timestamps must be valid and ascending.");
  }

  const fixtureEnd = timestamps.at(-1);
  const runEnd = Date.now();
  return dataset.map((event, index) => ({
    ...event,
    timestamp: new Date(runEnd + timestamps[index] - fixtureEnd).toISOString(),
  }));
}

async function readResponse(response, description) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${description} returned a non-JSON response.`);
  }

  if (!response.ok) {
    throw new Error(
      `${description} failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function sendDataset() {
  const events = createRunEvents(fixtureEvents);

  for (const [index, event] of events.entries()) {
    const response = await fetch(eventsEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    const responseBody = await readResponse(response, `Event ${index + 1}`);
    const savedEvent = responseBody.data;
    if (!savedEvent || typeof savedEvent.id !== "string") {
      throw new Error(`Event ${index + 1} returned an invalid response.`);
    }

    console.log(
      `Event ${index + 1}/${events.length} saved with id ${savedEvent.id} (${event.source_id} at ${savedEvent.timestamp})`,
    );
  }

  const latestResponse = await fetch(latestEventEndpoint);
  const latestBody = await readResponse(latestResponse, "Latest event query");
  if (!latestBody.data || typeof latestBody.data.id !== "string") {
    throw new Error("The API did not return a latest persisted event.");
  }

  console.log(
    `Latest persisted event: ${latestBody.data.id} (${latestBody.data.source_id} at ${latestBody.data.timestamp})`,
  );
}

sendDataset().catch((error) => {
  console.error(
    `Could not send the event dataset to ${eventsEndpoint}:`,
    error,
  );
  process.exitCode = 1;
});
