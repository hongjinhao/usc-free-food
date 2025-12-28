/**
 * App.jsx - Main Application Component
 * 
 * This file contains the root component for the USC Free Food Finder application.
 * It manages the core functionality including:
 * - Fetching and filtering from the 2 APIs (event list and event details)
 * - Displaying events in a searchable, filterable interface
 * - UI with event cards and detailed views
 */

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Pizza, ExternalLink, X, RefreshCw, AlertCircle, Scan } from 'lucide-react';

// API configuration for the Vercel Backend Proxy
const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';

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
 * Fetches events from the USC Engage API via `/api/events`.
 * Used by: loadEvents()
 * Returns: Promise<Array of parsed event objects>
 * Notes: Async function; resolves with normalized event data for the UI.
 */
const fetchEngageEvents = async () => {
  const url = `${API_BASE}/api/events`;

  try {
    console.log('Fetching events from:', url);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Filter out separator items
    // separator items are rows like "Ongoing" or the dates 
    // they are not actual events. 
    const actualEvents = data.filter(item => {
      return item.p0 === 'false' && item.p1 && item.p3 && item.listingSeparator !== 'true';
    });
    // Parse events WITHOUT checking for free food in initial load
    const parsedEvents = actualEvents.map(item => {
      const dateInfo = parseEngageSingleDate(item.p4)
      return {
        id: item.p1,
        title: item.p3,
        // dates: item.p4?.replace(/<[^>]*>/g, "").trim() || "",
        dates: dateInfo.display,
        location: item.p6 || "Location TBA",
        imageUrl: item.p11 ? `https://engage.usc.edu${item.p11}` : null,
        organizer: item.p9 || "Unknown",
        // category: item.p22?.replace(/<[^>]*>/g, '').trim() || '',
        category: extractAriaLabelsAsCategory(item.p22),
        detailUrl: `https://engage.usc.edu${item.p18}`,
        attendees: item.p10 || "0",
        hasFreeFood: false, // Initially false
        scanned: false, // Track if we've checked this event
      };
    });

    return parsedEvents;
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
};

/**
 * Fetches event details HTML via `/api/event-details?id=...` and scans for free-food keywords.
 * Param: eventId (string)
 * Parses the HTML, strips some nodes and searches for keywords
 * Side effects: none (pure; does not mutate React state)
 * Used by: handleEventClick(), scanAllEvents() and scanSingleEvent()
 * Returns: Promise<{ description: string, hasFreeFood: boolean }>
 */
const scanEventForFreeFood = async (eventId) => {
  try {
    const url = `${API_BASE}/api/event-details?id=${eventId}`;
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
      clone.querySelector(".card-block__title")?.remove();
      clone.querySelector(".card-border")?.remove();
      // 5) Extract human-readable text for keyword scanning

      // Remove "Copy Link" button block
      clone.querySelectorAll('a[aria-label*="Copy link"]').forEach((el) => {
        el.closest("div")?.remove();
      });

      clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));

      clone.querySelectorAll("p, div, li, h1, h2, h3, h4").forEach((el) => {
        el.insertAdjacentText("beforebegin", "\n");
        el.insertAdjacentText("afterend", "\n");
      });

      // Safety: remove any remaining buttons
      clone.querySelectorAll("a.btn, button").forEach((el) => el.remove());

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
        "free food",
        "free pizza",
        "free lunch",
        "free dinner",
        "free breakfast",
        "free snacks",
        "free refreshments",
        "free drinks",
        "free beverages",
        "free coffee",
        "free tea",
        "free boba",
        "free bubble tea",
        "free cookies",
        "free dessert",
        "free ice cream",
        "free gelato",
        "free pastries",
        "free donuts",
        "free bagels",
        "free cupcakes",
        "free brownies",
        "free sandwiches",
        "free subs",
        "free burritos",
        "free tacos",
        "free wings",
        "free bbq",
        "free ramen",
        "free sushi",

        // "Provided/served" phrasing
        "food provided",
        "snacks provided",
        "drinks provided",
        "refreshments provided",
        "meal provided",
        "lunch provided",
        "dinner provided",
        "breakfast provided",
        "food will be served",
        "refreshments will be served",
        "snacks will be served",
        "drinks will be served",
        "pizza provided",

        // Complimentary/catering
        "complimentary food",
        "complimentary meal",
        "complimentary refreshments",
        "catering provided",
        "catered",

        // Light food terms often used in events
        "light refreshments",
        "appetizers",
        "hors d'oeuvres",
        "treats",
        "bites",
        "munchies",

        // Broader terms (may increase recall; watch false positives)
        "confections",
        "cereals",
        "food",
        "boba",
        "vegan",
        "snacks",
        "drinks",
      ];
      const matched = freeFoodKeywords.filter((k) => descLower.includes(k));
      hasFreeFood = matched.length > 0;
      console.debug("[scanEventForFreeFood] Keyword matches:", matched);
    }

    return { description, hasFreeFood };
  } catch (error) {
    console.error('Error scanning event:', error);
    return { description: 'Could not load description', hasFreeFood: false };
  }
};

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOnlyFreeFood, setShowOnlyFreeFood] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDetails, setEventDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);

  useEffect(() => {
    loadEvents();
  }, []);

  /**
   * Loads events and updates component state
   * Used by: useEffect on mount, Refresh button click
   * Updates: events state, loading state, error state, lastUpdated timestamp
   */
  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEngageEvents();
      // console.log(data)
      setEvents(data); // store all events in events
      setLastUpdated(new Date()); // last updated timestamp
      setScannedCount(0); // reset count
      setScanProgress(0); // reset progress bar
    } catch (error) {
      console.error('Failed to load events:', error);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Scan all events in batches
  const scanAllEvents = async () => {
    setScanning(true);
    setScanProgress(0);
    setScannedCount(0);

    const unscannedEvents = events.filter(e => !e.scanned);
    const total = unscannedEvents.length;
    const batchSize = 5;
    let processed = 0;

    for (let i = 0; i < unscannedEvents.length; i += batchSize) {
      const batch = unscannedEvents.slice(i, i + batchSize);

      // Process batch in parallel
      const results = await Promise.all(
        batch.map(event => scanEventForFreeFood(event.id))
      );

      // Update events with scan results
      setEvents(prevEvents => {
        const newEvents = [...prevEvents];
        batch.forEach((event, idx) => {
          const eventIndex = newEvents.findIndex(e => e.id === event.id);
          if (eventIndex !== -1) {
            newEvents[eventIndex] = {
              ...newEvents[eventIndex],
              hasFreeFood: results[idx].hasFreeFood,
              scanned: true,
            };
          }
        });
        return newEvents;
      });

      processed += batch.length;
      setScanProgress((processed / total) * 100);
      setScannedCount(processed);

      // Small delay between batches to avoid overwhelming the server
      if (i + batchSize < unscannedEvents.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setScanning(false);
  };

  // Scan single event when clicked
  const scanSingleEvent = async (event) => {
    if (event.scanned) return;

    const result = await scanEventForFreeFood(event.id);

    setEvents(prevEvents => {
      const newEvents = [...prevEvents];
      const eventIndex = newEvents.findIndex(e => e.id === event.id);
      if (eventIndex !== -1) {
        newEvents[eventIndex] = {
          ...newEvents[eventIndex],
          hasFreeFood: result.hasFreeFood,
          scanned: true,
        };
      }
      return newEvents;
    });

    setScannedCount(prev => prev + 1);

    return result;
  };

  /**
   * Handles event card clicks to open the detail modal
   * Used by: EventCard onClick handler
   * Updates: selectedEvent state, triggers scanEventForFreeFood() for details
   */
  const handleEventClick = async (event) => {
    setSelectedEvent(event);
    setLoadingDetails(true);

    let details;
    if (event.scanned) {
      // If already scanned, just fetch details again for display? TODO
      details = await scanEventForFreeFood(event.id);
    } else {
      // If not scanned, scan it now
      details = await scanSingleEvent(event);
    }

    setEventDetails(details);
    setLoadingDetails(false);
  };

  /**
   * Closes the event detail modal
   * Used by: Modal close button, modal background click
   * Updates: clears selectedEvent and eventDetails state
   */
  const closeModal = () => {
    setSelectedEvent(null);
    setEventDetails(null);
  };

  const filteredEvents = events.filter(event => {
    const matchesFreeFood = !showOnlyFreeFood || event.hasFreeFood;
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFreeFood && matchesSearch;
  });

  const freeFoodCount = events.filter(e => e.hasFreeFood && e.scanned).length;
  const totalScanned = events.filter(e => e.scanned).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-yellow-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-700 to-red-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pizza className="w-10 h-10" />
              <div>
                <h1 className="text-3xl font-bold">USC Free Food Finder</h1>
                <p className="text-red-100 text-sm">Never miss free food on campus again</p>
              </div>
            </div>
            <button
              onClick={loadEvents}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Error State */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Error loading events</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Scan Controls */}
        {!loading && events.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={scanAllEvents}
                  disabled={scanning || totalScanned === events.length}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Scan className={`w-5 h-5 ${scanning ? 'animate-pulse' : ''}`} />
                  {scanning ? 'Scanning...' : totalScanned === events.length ? 'All Scanned' : 'Scan All Events'}
                </button>
                <div className="text-sm text-gray-600">
                  Scanned: {totalScanned} / {events.length} events
                  {freeFoodCount > 0 && ` • ${freeFoodCount} with free food`}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            {scanning && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-green-600 h-full transition-all duration-300 ease-out"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Scanning... {Math.round(scanProgress)}% complete
                </p>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />

              {/* Filter Toggle */}
              <button
                onClick={() => setShowOnlyFreeFood(!showOnlyFreeFood)}
                disabled={totalScanned === 0}
                className={`px-6 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${showOnlyFreeFood
                  ? 'bg-red-700 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Pizza className="w-5 h-5" />
                  Free Food Only ({freeFoodCount})
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-12 h-12 border-4 border-red-700 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading events...</p>
          </div>
        )}

        {/* Events Grid */}
        {!loading && !error && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-gray-600">
                Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
              </span>
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>

            {filteredEvents.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <Pizza className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-xl text-gray-600">No events found</p>
                <p className="text-gray-500 mt-2">
                  {showOnlyFreeFood && totalScanned === 0
                    ? 'Scan events first to find free food'
                    : 'Try adjusting your filters'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onClick={() => handleEventClick(event)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={closeModal}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900 pr-8">{selectedEvent.title}</h2>
                <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {selectedEvent.imageUrl && (
                <img src={selectedEvent.imageUrl} alt={selectedEvent.title} className="w-full h-64 object-cover rounded-lg mb-4" />
              )}

              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-2 text-gray-700">
                  <Calendar className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>{selectedEvent.dates}</span>
                </div>
                <div className="flex items-start gap-2 text-gray-700">
                  <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>{selectedEvent.location}</span>
                </div>
                <div className="flex items-start gap-2 text-gray-700">
                  <Users className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>{selectedEvent.organizer}</span>
                </div>
              </div>

              {selectedEvent.scanned && selectedEvent.hasFreeFood && (
                <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-3 mb-4 flex items-center gap-2">
                  <Pizza className="w-5 h-5 text-yellow-700" />
                  <span className="font-semibold text-yellow-900">This event has FREE FOOD!</span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                {loadingDetails ? (
                  <div className="text-gray-500">Loading description...</div>
                ) : eventDetails ? (
                  <p className="text-gray-700 whitespace-pre-wrap">{eventDetails.description}</p>
                ) : (
                  <p className="text-gray-500">No description available</p>
                )}
              </div>

              <a
                href={selectedEvent.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-red-700 text-white px-6 py-3 rounded-lg hover:bg-red-800 transition-colors"
              >
                View on USC Engage
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-100 mt-12 py-6 text-center text-gray-600 text-sm">
        <p>Data from <a href="https://engage.usc.edu" target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline">USC Engage</a></p>
        {lastUpdated && (
          <p className="mt-1">Last updated: {lastUpdated.toLocaleString()}</p>
        )}
      </footer>
    </div>
  );
}

/**
 * EventCard Component
 * Displays a single event as a clickable card
 * Props: event (event object), onClick (handler for opening detail modal)
 * Features: Image, title, dates, location, organizer, category, free food badge
 */
function EventCard({ event, onClick }) {
  return (
    <div
      onClick={onClick}
      className="block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-1 cursor-pointer"
    >
      <div className="relative h-48 bg-gradient-to-br from-red-100 to-yellow-100">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Calendar className="w-16 h-16 text-red-300" />
          </div>
        )}

        {/* Badge Logic */}
        {!event.scanned ? (
          <div className="absolute top-2 right-2 bg-gray-400 text-white px-3 py-1 rounded-full font-bold text-sm shadow-lg">
            NOT SCANNED
          </div>
        ) : event.hasFreeFood ? (
          <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full font-bold text-sm shadow-lg flex items-center gap-1">
            <Pizza className="w-4 h-4" />
            FREE FOOD
          </div>
        ) : null}
      </div>

      <div className="p-4">
        <h3 className="font-bold text-lg text-black-900 mb-2 line-clamp-2">
          {event.title}
        </h3>
      
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{event.dates}</span>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-1">{event.location}</span>
          </div>

          {event.organizer && (
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-1">{event.organizer}</span>
            </div>
          )}
        </div>

        {event.category && (
          <div className="mt-3">
            <span className="inline-block bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
              {event.category}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;