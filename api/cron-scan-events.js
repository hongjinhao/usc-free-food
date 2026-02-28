import { fetchEngageEvents } from "../utils/engageClient.js";
import { scanEventsInBatches } from "../utils/eventScanner.js";
import {
  upsertEventsToDb,
  markStaleEvents,
  deleteOldStaleEvents,
} from "../utils/eventRepository.js";

function verifyAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function sendSuccessResponse(res, scannedEvents, deletedCount) {
  const freeFoodCount = scannedEvents.filter((e) => e.hasFreeFood).length;

  return res.status(200).json({
    success: true,
    totalEvents: scannedEvents.length,
    freeFoodEvents: freeFoodCount,
    staleEventsDeleted: deletedCount,
    timestamp: new Date().toISOString(),
  });
}

function sendErrorResponse(res, error) {
  console.error("Cron job error:", error);
  return res.status(500).json({ error: error.message });
}

/**
 * Cron entrypoint: validates secret, fetches events, scans descriptions for free food, and upserts into Supabase.
 * @param req Incoming request (expects Authorization: Bearer CRON_SECRET)
 * @param res Outgoing response used for cron logs and status
 */
export default async function handler(req, res) {
  if (!verifyAuth(req, res)) return;

  try {
    const events = await fetchEngageEvents();
    const scannedEvents = await scanEventsInBatches(events);

    await upsertEventsToDb(scannedEvents);

    const activeEventIds = scannedEvents.map((e) => e.id);
    await markStaleEvents(activeEventIds);

    const deletedCount = await deleteOldStaleEvents();

    return sendSuccessResponse(res, scannedEvents, deletedCount);
  } catch (error) {
    return sendErrorResponse(res, error);
  }
}
