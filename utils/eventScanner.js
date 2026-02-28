import { scanEventDetails, isHousingCategory } from "./engageClient.js";

const BATCH_SIZE = 5;
const DELAY_MS = 200;

/**
 * Scans a single batch of events in parallel.
 * Returns: Promise<Array of enriched event objects>
 */
async function processEventBatch(batch) {
  return Promise.all(
    batch.map(async (event) => {
      const details = await scanEventDetails(event.id);
      const isHousingOnly =
        details.isHousingOnly || isHousingCategory(event.category);
      return {
        ...event,
        description: details.description,
        hasFreeFood: details.hasFreeFood,
        isHousingOnly,
        scanned: true,
        lastScannedAt: new Date().toISOString(),
      };
    }),
  );
}

/**
 * Scans all events in batches with a small delay between each batch.
 * Returns: Promise<Array of enriched event objects>
 */
export async function scanEventsInBatches(events) {
  const scannedEvents = [];
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const results = await processEventBatch(batch);
    scannedEvents.push(...results);

    // Small delay between batches to be polite to the source
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
  return scannedEvents;
}
