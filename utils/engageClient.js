import { parse } from "node-html-parser";
import { checkFreeFood, getMatchedKeywords } from "./freeFoodKeywords.js";
import {
  extractAriaLabelsAsCategory,
  parseEngageSingleDate,
  cleanEventDOM,
  extractNodeText,
  processDescriptionText,
} from "./htmlParser.js";

export const ENGAGE_API_BASE = "https://engage.usc.edu";

const NUM_OF_EVENTS = 700;
const EVENTS_LIST_API_URL = `${ENGAGE_API_BASE}/mobile_ws/v17/mobile_events_list?range=0&limit=${NUM_OF_EVENTS}&filter4_contains=OR&filter4_notcontains=OR&order=undefined&search_word=`;
const EVENT_DETAILS_URL_TEMPLATE = `${ENGAGE_API_BASE}/rsvp_boot?id=`;

export const HOUSING_ONLY_MARKERS = [
  "This event is open to USC Housing Residents only. Residential Education operates its programs in accordance with USC's Notice of Non-Discrimination.",
  "usc housing residents",
  "housing residents only",
  "RA",
];

export const HOUSING_CATEGORIES = [
  "RA Floor Program",
  "Res College Cup",
  "Residential College or Community Event",
];

function isValidEventItem(item) {
  return (
    item.p0 === "false" &&
    item.p1 &&
    item.p3 &&
    item.listingSeparator !== "true"
  );
}

function mapEventItem(item) {
  const dateInfo = parseEngageSingleDate(item.p4);
  return {
    id: item.p1,
    title: item.p3,
    dates: dateInfo.display,
    location: item.p6 || "Location TBA",
    imageUrl: item.p11 ? `${ENGAGE_API_BASE}${item.p11}` : null,
    organizer: item.p9 || "Unknown",
    category: extractAriaLabelsAsCategory(item.p22),
    detailUrl: `${ENGAGE_API_BASE}${item.p18}`,
    attendees: item.p10 || "0",
  };
}

/**
 * Fetches the full list of USC Engage events from the mobile API.
 * Returns: Promise<Array of parsed event objects>
 */
export async function fetchEngageEvents() {
  try {
    const response = await fetch(EVENTS_LIST_API_URL);

    if (!response.ok) {
      throw new Error(`USC event list API returned status ${response.status}`);
    }

    const data = await response.json();
    const actualEvents = data.filter(isValidEventItem);

    return actualEvents.map(mapEventItem);
  } catch (error) {
    console.error("Error fetching from events list API:", error);
    throw new Error(
      `Failed to fetch events from events list API: ${error.message}`,
    );
  }
}

// Matches the standalone word "RA" or "RAs" (case-insensitive), not substrings like "grass" or "drama"
const RA_WORD_REGEX = /\bras?\b/i;

/**
 * Returns true if the event description contains a housing-only marker.
 */
export function isHousingOnlyEvent(description) {
  const normalizedDescription = description.toLowerCase();
  return HOUSING_ONLY_MARKERS.some((marker) => {
    if (marker === "RA") {
      return RA_WORD_REGEX.test(description);
    }
    return normalizedDescription.includes(marker.toLowerCase());
  });
}

/**
 * Returns true if the event's category matches a known housing-only category.
 */
export function isHousingCategory(category) {
  if (!category) return false;
  return HOUSING_CATEGORIES.some((cat) => category.includes(cat));
}

/**
 * Fetches the detail page for a single event and extracts its description,
 * free food flag, and housing-only flag.
 */
export async function scanEventDetails(eventId) {
  const url = `${EVENT_DETAILS_URL_TEMPLATE}${eventId}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Failed to fetch details");
    }

    const html = await response.text();
    const root = parse(html);
    const eventDetailsCard = root.querySelector("#event_details .card-block");

    if (!eventDetailsCard) {
      return {
        description: "No description available",
        hasFreeFood: false,
        isHousingOnly: false,
      };
    }

    cleanEventDOM(eventDetailsCard);
    const rawText = extractNodeText(eventDetailsCard);
    const description = processDescriptionText(rawText);

    const isHousingOnly = isHousingOnlyEvent(description);
    const hasFreeFood = checkFreeFood(description);

    if (process.env.NODE_ENV === "development") {
      const matches = getMatchedKeywords(description);
      console.debug(`[Event ${eventId}] Matches:`, matches);
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
