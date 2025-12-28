import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with SERVICE ROLE key (has write permissions)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);


/** 
 * Function : extractAriaLabelsAsCategory()
 * Cleans the category - item.p22 in the fetchEngageEvents()
*/

function extractAriaLabelsAsCategory(html) {
  if (!html || typeof html !== "string") return "";

  const doc = new DOMParser().parseFromString(html, "text/html");

  const labels = Array.from(doc.querySelectorAll("[aria-label]"))
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
        .trim()
    );

  // de-duplicate (case-insensitive) while preserving order
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
 * Function : decodeHtmlEntities & parseEngageSingleDate
 * Cleans the Date and Time for dates - item.p4 in the fetchEngageEvents()
 */

function decodeHtmlEntities(str) {
  if (!str || typeof str !== "string") return "";
  const txt = document.createElement("textarea");
  txt.innerHTML = str; // decodes &ndash; etc.
  return txt.value;
}

function parseEngageSingleDate(html) {
  if (!html || typeof html !== "string") {
    return { date: null, display: "" };
  }

  // Decode entities first (so &ndash; becomes –)
  const decoded = decodeHtmlEntities(html);

  // Parse the HTML and extract visible text
  const doc = new DOMParser().parseFromString(decoded, "text/html");

  // Join all <p> lines (some responses wrap the same date across multiple <p>)
  const text =
    Array.from(doc.body.querySelectorAll("p"))
      .map((p) => (p.textContent || "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim() || (doc.body.textContent || "").replace(/\s+/g, " ").trim();

  // Remove any trailing dash if API includes it (e.g., "... AM –")
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
    const url = 'https://engage.usc.edu/mobile_ws/v17/mobile_events_list?range=0&limit=100&filter4_contains=OR&filter4_notcontains=OR&order=undefined&search_word=';

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`USC API returned status ${response.status}`);
        }

        const data = await response.json();

        // Filter out separator items
        // separator items are rows like "Ongoing" or the dates 
        // they are not actual events. 
        const actualEvents = data.filter(item => {
            return item.p0 === 'false' && item.p1 && item.p3 && item.listingSeparator !== 'true';
        });

        console.log(`Fetched ${actualEvents.length} events from USC API`);

        return actualEvents.map(item => {
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
        console.error('Error fetching from events list API:', error);
        throw new Error(`Failed to fetch events from events list API: ${error.message}`);
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
    const url = `https://engage.usc.edu/event/${eventId}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch details');
        }

        // 1) Read raw HTML returned by the Engage event details page
        const html = await response.text();

        // 2) Create a DOMParser to convert the HTML string into a document
        const parser = new DOMParser();

        // 3) Parse HTML into a DOM Document so we can query it like real DOM
        const doc = parser.parseFromString(html, 'text/html');

        // 4) Grab the specific card block that contains event details content
        const eventDetailsCard = doc.querySelector('#event_details .card-block');

        let description = '';
        let hasFreeFood = false;

        if (eventDetailsCard) {
            // Clone so we can safely remove UI-only elements before extracting text
            const clone = eventDetailsCard.cloneNode(true);
            // Remove title and decorative border to avoid noisy text
            clone.querySelector('.card-block__title')?.remove();
            clone.querySelector('.card-border')?.remove();
            // 5) Extract human-readable text for keyword scanning
            clone
              .querySelectorAll('a[aria-label*="Copy link"]')
              .forEach((el) => {
                el.closest("div")?.remove();
              });

            clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));

            clone
              .querySelectorAll("p, div, li, h1, h2, h3, h4")
              .forEach((el) => {
                el.insertAdjacentText("beforebegin", "\n");
                el.insertAdjacentText("afterend", "\n");
              });

            // Safety: remove any remaining buttons
            clone
              .querySelectorAll("a.btn, button")
              .forEach((el) => el.remove());

            // Remove empty divs / comments / whitespace-only nodes
            clone.querySelectorAll("div").forEach((div) => {
              if (!div.textContent.trim()) {
                div.remove();
              }
            });

            description = clone.textContent
              .replace(/\u00A0/g, " ")
              .replace(/[ \t]+\n/g, "\n")
              .replace(/\n[ \t]+/g, "\n")
              .replace(/\n{3,}/g, "\n\n")
              .trim();

            // 6) Keyword scan to infer free-food presence
            const descLower = description.toLowerCase();
            const freeFoodKeywords = [
                // Explicit "free" phrases
                'free food', 'free pizza', 'free lunch', 'free dinner', 'free breakfast',
                'free snacks', 'free refreshments', 'free drinks', 'free beverages',
                'free coffee', 'free tea', 'free boba', 'free bubble tea',
                'free cookies', 'free dessert', 'free ice cream', 'free gelato',
                'free pastries', 'free donuts', 'free bagels', 'free cupcakes', 'free brownies',
                'free sandwiches', 'free subs', 'free burritos', 'free tacos', 'free wings',
                'free bbq', 'free ramen', 'free sushi',

                // "Provided/served" phrasing
                'food provided', 'snacks provided', 'drinks provided', 'refreshments provided',
                'meal provided', 'lunch provided', 'dinner provided', 'breakfast provided',
                'food will be served', 'refreshments will be served', 'snacks will be served', 'drinks will be served',
                'pizza provided',

                // Complimentary/catering
                'complimentary food', 'complimentary meal', 'complimentary refreshments',
                'catering provided', 'catered',

                // Light food terms often used in events
                'light refreshments', 'appetizers', "hors d'oeuvres", 'treats', 'bites', 'munchies',

                // Broader terms (may increase recall; watch false positives)
                'confections', 'cereals', 'food', 'boba', 'vegan', 'snacks', 'drinks'
            ];
            const matched = freeFoodKeywords.filter(k => descLower.includes(k));
            hasFreeFood = matched.length > 0;
            console.debug('[scanEventDetails] Keyword matches:', matched);
        }

        return { description, hasFreeFood };
    } catch (error) {
        console.error(`Error scanning event ${eventId}:`, error);
        return { description: 'Error loading description', hasFreeFood: false };
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
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('Starting cron job...');

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
                    return {
                        ...event,
                        description: details.description,
                        hasFreeFood: details.hasFreeFood,
                        scanned: true,
                        lastScannedAt: new Date().toISOString(),
                    };
                })
            );

            scannedEvents.push(...results);

            // Small delay between batches to be polite to the source
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`Scanned ${scannedEvents.length} events`);

        // Step 3: Upsert into Supabase (insert or update)
        const dbEvents = scannedEvents.map(e => ({
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
            scanned: true,
            last_scanned_at: e.lastScannedAt,
            updated_at: new Date().toISOString(),
        }));

        const { data, error } = await supabase
            .from('events')
            .upsert(dbEvents, { onConflict: 'id' });

        if (error) throw error;

        const freeFoodCount = scannedEvents.filter(e => e.hasFreeFood).length;

        console.log('Cron job completed successfully');

        // Return a concise payload for Vercel cron logging
        return res.status(200).json({
            success: true,
            totalEvents: scannedEvents.length,
            freeFoodEvents: freeFoodCount,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Cron job error:', error);
        return res.status(500).json({ error: error.message });
    }
}