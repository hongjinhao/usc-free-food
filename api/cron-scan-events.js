import { createClient } from "@supabase/supabase-js";
import { parse } from "node-html-parser";
import {
  checkFreeFood,
  getMatchedKeywords,
} from "../utils/freeFoodKeywords.js";

// Initialize Supabase with SERVICE ROLE key (has write permissions)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Cleans the tags (p22) from event details API
 * Used in fetchEngageEvents()
 */
function extractAriaLabelsAsCategory(html) {
  if (!html || typeof html !== "string") return "";

  const root = parse(html);
  const elements = root.querySelectorAll("[aria-label]");

  const labels = elements
    .map((el) => (el.getAttribute("aria-label") || "").trim())
    .filter(Boolean)
    .map((label) =>
      label
        // "Lecture slash Presentation" -> "Lecture / Presentation"
        .replace(/\s+slash\s+/gi, " / ")
        // cleanup spacing around slashes: "A  /  B" -> "A / B"
        .replace(/\s*\/\s*/g, " / ")
        // collapse multiple spaces
        .replace(/\s+/g, " ")
        .trim(),
    );

  // remove duplicates (case-insensitive) while preserving order
  const unique = [];
  const seen = new Set();
  for (const l of labels) {
    const key = l.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(l);
    }
  }

  return unique.join(" / ");
}

/**
 * Cleans the Date and Time (p4) in the event details API response.
 * Used in parseEngageSingleDate()
 */
function decodeHtmlEntities(str) {
  if (!str || typeof str !== "string") return "";

  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

/**
 * Parses date from event list API
 */
function parseEngageSingleDate(html) {
  if (!html || typeof html !== "string") {
    return { date: null, display: "" };
  }

  // Decode entities first (so &ndash; becomes –)
  const decoded = decodeHtmlEntities(html);
  const root = parse(decoded);

  // Join all <p> lines (some responses wrap the same date across multiple <p>)
  const paragraphs = root.querySelectorAll("p");

  const text =
    paragraphs.length > 0
      ? paragraphs
          .map((p) => p.text.trim())
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      : root.text.replace(/\s+/g, " ").trim();

  const cleaned = text.replace(/\s*[–-]\s*$/, "").trim();

  // Parse as Date (browser parses this format well in practice)
  const d = cleaned ? new Date(cleaned) : null;
  const valid = d instanceof Date && !isNaN(d);

  // Nice formatting
  const display = valid
    ? d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : cleaned; // fallback if parsing fails

  return { date: valid ? d : null, display };
}

/**
 * Fetches events directly from the USC Engage API via `/api/events`.
 * No separate vercel backend proxy needed since the database serves as the proxy
 * Used by: handler()
 * Returns: Promise<Array of parsed event objects>
 * Notes: Async function; resolves with normalized event data for the database
 */
async function fetchEngageEvents() {
  const url =
    "https://engage.usc.edu/mobile_ws/v17/mobile_events_list?range=0&limit=700&filter4_contains=OR&filter4_notcontains=OR&order=undefined&search_word=";

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`USC event list API returned status ${response.status}`);
    }

    const data = await response.json();
    // Filter out separator items (not actual events)
    // separator items are rows like "Ongoing" or the dates
    const actualEvents = data.filter((item) => {
      return (
        item.p0 === "false" &&
        item.p1 &&
        item.p3 &&
        item.listingSeparator !== "true"
      );
    });

    console.log(`Fetched ${actualEvents.length} events from USC API`);

    return actualEvents.map((item) => {
      const dateInfo = parseEngageSingleDate(item.p4);
      return {
        id: item.p1,
        title: item.p3,
        dates: dateInfo.display,
        location: item.p6 || "Location TBA",
        imageUrl: item.p11 ? `https://engage.usc.edu${item.p11}` : null,
        organizer: item.p9 || "Unknown",
        category: extractAriaLabelsAsCategory(item.p22),
        detailUrl: `https://engage.usc.edu${item.p18}`,
        attendees: item.p10 || "0",
      };
    });
  } catch (error) {
    console.error("Error fetching from events list API:", error);
    throw new Error(
      `Failed to fetch events from events list API: ${error.message}`,
    );
  }
}

/**
 * Fetches event details HTML directly via `/api/event-details?id=...` and scans for free-food keywords.
 * No backend proxy here too
 * Param: eventId (string)
 * Parses the HTML, strips some nodes and searches for keywords
 * Used by: handler()
 * Returns: Promise<{ description: string, hasFreeFood: boolean }>
 */
async function scanEventDetails(eventId) {
  const url = `https://engage.usc.edu/rsvp_boot?id=${eventId}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Failed to fetch details");
    }

    // 1) Read raw HTML returned by the Engage event details page
    const html = await response.text();

    // 3) Parse HTML into a DOM Document so we can query it like real DOM
    const root = parse(html);
    // 4) Grab the specific card block that contains event details content
    const eventDetailsCard = root.querySelector("#event_details .card-block");

    let description = "No description available";
    let hasFreeFood = false;
    let isHousingOnly = false;

    if (eventDetailsCard) {
      const title = eventDetailsCard.querySelector(".card-block__title");
      const border = eventDetailsCard.querySelector(".card-border");
      if (title) title.remove();
      if (border) border.remove();

      // Remove "Copy Link" buttons and their parent divs
      eventDetailsCard
        .querySelectorAll('a[aria-label*="Copy link"]')
        .forEach((el) => {
          const parent = el.parentNode;
          if (parent) parent.remove();
        });

      // Remove all buttons and links with btn class
      eventDetailsCard
        .querySelectorAll("a.btn, button")
        .forEach((el) => el.remove());

      // Remove image wrappers (flyer images add no text value)
      eventDetailsCard
        .querySelectorAll("img, .text-center")
        .forEach((el) => el.remove());

      // Extract text content by walking the node tree.
      // Text nodes are trimmed; block-level children are joined with "\n"
      // so indentation whitespace in the raw HTML never leaks into the output.
      const BLOCK_TAGS = new Set([
        "div",
        "p",
        "br",
        "li",
        "tr",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ]);
      function extractText(node) {
        if (node.nodeType === 3) {
          // Trim each text node so bare whitespace nodes produce nothing
          return node.rawText
            .replace(/\u00A0/g, " ")
            .replace(/[ \t]+/g, " ")
            .trim();
        }
        const tag = (node.rawTagName || "").toLowerCase();
        // <br> emits a bare newline so consecutive <br><br> produces \n\n
        if (tag === "br") return "\n";
        const isBlock = BLOCK_TAGS.has(tag);
        const parts = (node.childNodes || [])
          .map(extractText)
          .filter((s) => s.length > 0);
        // Top-level block elements are separated by a blank line (\n\n);
        // nested blocks use a single newline
        const sep = isBlock ? "\n\n" : " ";
        const inner = parts.join(sep).trim();
        return inner;
      }

      description = extractText(eventDetailsCard)
        .replace(/[ \t]+/g, " ") // collapse runs of spaces/tabs
        .replace(/[ \t]*\n[ \t]*/g, "\n") // trim spaces around newlines
        .replace(/\n{3,}/g, "\n\n") // collapse 3+ newlines to a blank line
        // Decode HTML entities left over after text extraction
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&ndash;/g, "\u2013")
        .replace(/&mdash;/g, "\u2014")
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        )
        .trim();

      console.log(
        "[scanEventDetails] description peak: ",
        description.substring(0, 100),
      );

      const housingOnlyText =
        "This event is open to USC Housing Residents only. Residential Education operates its programs in accordance with USC's Notice of Non-Discrimination.";
      const housingOnlyMarkers = [
        housingOnlyText,
        "usc housing residents",
        "housing residents only",
      ];
      const normalizedDescription = description.toLowerCase();
      isHousingOnly = housingOnlyMarkers.some((marker) =>
        normalizedDescription.includes(marker.toLowerCase()),
      );

      hasFreeFood = checkFreeFood(description);

      // For debugging in development
      if (process.env.NODE_ENV === "development") {
        const matches = getMatchedKeywords(description);
        console.debug(`[Event ${eventId}] Matches:`, matches);
      }
    }

    return { description, hasFreeFood, isHousingOnly };
  } catch (error) {
    console.error(`Error scanning event ${eventId}:`, error);
    return {
      description: "Error loading description",
      hasFreeFood: false,
      isHousingOnly: false,
    };
  }
}

async function markStaleEvents(activeEventIds) {
  try {
    const { data, error } = await supabase
      .from("events")
      .update({ status: "stale", updated_at: new Date().toISOString() })
      .not("id", "in", `(${activeEventIds.join(",")})`)
      .eq("status", "active");
    if (error) throw error;
    console.log(`Marked events as stale (not in current API response)`);
  } catch (error) {
    console.log("Error marking stale events:", error);
    throw error;
  }
}

/*
 * Delete stale events that are more than 30 days old
 */
async function deleteOldStaleEvents() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    // this approach works because JS automatically handles the date math

    const { data, error } = await supabase
      .from("events")
      .delete()
      .eq("status", "stale")
      .lt("updated_at", thirtyDaysAgo.toISOString());

    if (error) throw error;
    // using optional chaining ?.
    const deletedCount = data?.length || 0;
    console.log(`Deleted ${deletedCount} stale events older than 30 days`);
    return deletedCount;
  } catch (error) {
    console.error("Error deleting old stale events:", error);
    throw error;
  }
}

/**
 * Cron entrypoint: validates secret, fetches events, scans descriptions for free food, and upserts into Supabase.
 * @param req Incoming request (expects Authorization: Bearer CRON_SECRET)
 * @param res Outgoing response used for cron logs and status
 */
export default async function handler(req, res) {
  // Guard against unauthorized cron invocations
  // Verify cron secret (security measure)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("Starting cron job...");

  try {
    // Step 1: Fetch events from event list API
    const events = await fetchEngageEvents();
    console.log(`Fetched ${events.length} events`);

    // Step 2: Scan events in batches to avoid hammering the site
    const batchSize = 5;
    const scannedEvents = [];

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (event) => {
          const details = await scanEventDetails(event.id);
          const isHousingOnly =
            details.isHousingOnly ||
            (event.category &&
              (event.category.includes("RA Floor Program") ||
                event.category.includes("Res College Cup") ||
                event.category.includes(
                  "Residential College or Community Event",
                )));
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

      scannedEvents.push(...results);

      // Small delay between batches to be polite to the source
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`Scanned ${scannedEvents.length} events`);

    // Step 3: Upsert into Supabase (insert or update)
    const dbEvents = scannedEvents.map((e, index) => ({
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
    }));
    const { data, error } = await supabase
      .from("events")
      .upsert(dbEvents, { onConflict: "id" });

    if (error) throw error;

    // Step 4: Mark events not in current API response as stale
    const activeEventIds = scannedEvents.map((e) => e.id);
    await markStaleEvents(activeEventIds);

    // Step 5: Delete events older than 30 days
    const deletedCount = await deleteOldStaleEvents();

    const freeFoodCount = scannedEvents.filter((e) => e.hasFreeFood).length;

    console.log("Cron job completed successfully");

    // Return a concise payload for Vercel cron logging
    return res.status(200).json({
      success: true,
      totalEvents: scannedEvents.length,
      freeFoodEvents: freeFoodCount,
      staleEventsDeleted: deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return res.status(500).json({ error: error.message });
  }
}
