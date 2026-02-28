import { createClient } from "@supabase/supabase-js";

const STALE_THRESHOLD_DAYS = 30;

// Initialize Supabase with SERVICE ROLE key (has write permissions)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function mapToDbEvent(e, index) {
  return {
    id: e.id,
    title: e.title,
    dates: e.dates,
    location: e.location,
    image_url: e.imageUrl,
    organizer: e.organizer,
    category: e.category,
    detail_url: e.detailUrl,
    attendees: e.attendees,
    description: e.description,
    has_free_food: e.hasFreeFood,
    is_housing_only: e.isHousingOnly,
    scanned: true,
    last_scanned_at: e.lastScannedAt,
    updated_at: new Date().toISOString(),
    order_index: index,
    status: "active",
  };
}

/**
 * Upserts all scanned events into the database.
 */
export async function upsertEventsToDb(scannedEvents) {
  const dbEvents = scannedEvents.map(mapToDbEvent);
  const { error } = await supabase
    .from("events")
    .upsert(dbEvents, { onConflict: "id" });

  if (error) throw error;
}

/**
 * Marks all events not in activeEventIds as stale.
 */
export async function markStaleEvents(activeEventIds) {
  try {
    const { error } = await supabase
      .from("events")
      .update({ status: "stale", updated_at: new Date().toISOString() })
      .not("id", "in", `(${activeEventIds.join(",")})`)
      .eq("status", "active");
    if (error) throw error;
  } catch (error) {
    console.log("Error marking stale events:", error);
    throw error;
  }
}

/**
 * Deletes stale events older than STALE_THRESHOLD_DAYS.
 * Returns the number of deleted events.
 */
export async function deleteOldStaleEvents() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - STALE_THRESHOLD_DAYS);

    const { data, error } = await supabase
      .from("events")
      .delete()
      .eq("status", "stale")
      .lt("updated_at", cutoffDate.toISOString());

    if (error) throw error;
    return data?.length || 0;
  } catch (error) {
    console.error("Error deleting old stale events:", error);
    throw error;
  }
}
