/**
 * App.jsx - Main Application Component
 *
 * This file contains the root component for the USC Free Food Finder application.
 * It manages the core functionality including:
 * - fetching event details from the database
 * - Displaying events in a searchable, filterable interface
 * - UI with event cards and detailed views
 */

import React, { useState, useEffect } from "react";
import {
  Calendar,
  MapPin,
  Users,
  Pizza,
  ExternalLink,
  X,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client (using public anon key)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOnlyFreeFood, setShowOnlyFreeFood] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  /**
   * Loads events from supabase on mount and update components
   * Updates: events state, error state, lastUpdated timestamp
   * Only fetch active events (not stale)
   */
  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "active")
        .order("order_index", { ascending: true });

      if (error) throw error;

      // Transform database format to match our component expectations
      const transformedEvents = data.map((event) => ({
        id: event.id,
        title: event.title,
        dates: event.dates,
        location: event.location,
        imageUrl: event.image_url,
        organizer: event.organizer,
        category: event.category,
        detailUrl: event.detail_url,
        attendees: event.attendees,
        description: event.description,
        hasFreeFood: event.has_free_food,
        scanned: event.scanned,
        lastScannedAt: event.last_scanned_at,
        status: event.status,
      }));

      setEvents(transformedEvents); // store all events in events
      // Get the most recent scan time
      if (data.length > 0 && data[0].last_scanned_at) {
        setLastUpdated(new Date(data[0].last_scanned_at));
      }
    } catch (error) {
      console.error("Failed to load events:", error);
      setError("Failed to load events. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles event card clicks to open the detail modal
   * Used by: EventCard onClick handler
   * Updates: selectedEvent state, triggers scanEventForFreeFood() for details
   */
  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };

  /**
   * Closes the event detail modal
   * Used by: Modal close button, modal background click
   * Updates: clears selectedEvent and eventDetails state
   */
  const closeModal = () => {
    setSelectedEvent(null);
  };

  const filteredEvents = events.filter((event) => {
    const matchesFreeFood = !showOnlyFreeFood || event.hasFreeFood;
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFreeFood && matchesSearch;
  });

  const freeFoodCount = events.filter((e) => e.hasFreeFood && e.scanned).length;
  const totalScanned = events.filter((e) => e.scanned).length;

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
                <p className="text-red-100 text-sm">
                  Never miss free food on campus again
                </p>
              </div>
            </div>
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
        {/* Search and Filter Controls */}
        {!loading && events.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
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
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  showOnlyFreeFood
                    ? "bg-red-700 text-white shadow-lg"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
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
                Showing {filteredEvents.length} event
                {filteredEvents.length !== 1 ? "s" : ""}
              </span>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <Pizza className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-xl text-gray-600">No events found</p>
                <p className="text-gray-500 mt-2">
                  {showOnlyFreeFood && totalScanned === 0
                    ? "Scan events first to find free food"
                    : "Try adjusting your filters"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((event) => (
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900 pr-8">
                  {selectedEvent.title}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {selectedEvent.imageUrl && (
                <img
                  src={selectedEvent.imageUrl}
                  alt={selectedEvent.title}
                  className="w-full h-64 object-cover rounded-lg mb-4"
                />
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
                  <span className="font-semibold text-yellow-900">
                    This event has FREE FOOD!
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Description
                </h3>
                {selectedEvent.description ? (
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {selectedEvent.description}
                  </p>
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
        <p>
          Data from{" "}
          <a
            href="https://engage.usc.edu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-700 hover:underline"
          >
            USC Engage
          </a>
        </p>
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
        <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
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
