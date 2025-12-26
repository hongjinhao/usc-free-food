/**
 * App.jsx - Main Application Component
 * 
 * This file contains the root component for the USC Free Food Finder application.
 * It manages the core functionality including:
 * - Fetching and filtering free food events from the API
 * - Displaying events in a searchable, filterable interface
 * - Managing user interactions (search, filters, event details modal)
 * - Handling event categorization and free food detection
 * - Responsive UI with event cards and detailed views
 */

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Pizza, ExternalLink, X, RefreshCw, AlertCircle } from 'lucide-react';

// API configuration - works both locally and in production
const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';

const fetchEngageEvents = async () => {
  const url = `${API_BASE}/api/events`;

  try {
    console.log('Fetching events from:', url);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Raw API response:', data);
    console.log('Number of items:', data.length);

    // Filter out separator items
    const actualEvents = data.filter(item => {
      return item.p1 && item.p3 && item.listingSeparator !== 'true';
    });

    console.log('Filtered to actual events:', actualEvents.length);

    const parsedEvents = actualEvents.map(item => {
      // Search for free food keywords
      const searchText = [
        item.p3 || '',  // title
        item.p4 || '',  // dates/description  
        item.p22 || '', // tags
        item.p12 || '', // price range
      ].join(' ').toLowerCase();

      const freeFootKeywords = [
        'free food', 'free pizza', 'free lunch', 'free dinner',
        'free breakfast', 'free snacks', 'refreshments',
        'food provided', 'snacks provided', 'pizza provided',
        'complimentary food', 'complimentary meal',
        'food will be served', 'free boba', 'free drinks',
        'free cookies', 'free ice cream', 'catering provided'
      ];

      const hasFreeFood = freeFootKeywords.some(k => searchText.includes(k));

      return {
        id: item.p1,
        title: item.p3,
        dates: item.p4?.replace(/<[^>]*>/g, '').trim() || '',
        location: item.p6 || 'Location TBA',
        imageUrl: item.p11 ? `https://engage.usc.edu${item.p11}` : null,
        organizer: item.p9 || 'Unknown',
        category: item.p22?.replace(/<[^>]*>/g, '').trim() || '',
        detailUrl: `https://engage.usc.edu${item.p18}`,
        attendees: item.p10 || '0',
        hasFreeFood,
      };
    });

    console.log('Parsed events:', parsedEvents);
    console.log('Events with free food:', parsedEvents.filter(e => e.hasFreeFood).length);

    return parsedEvents;
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
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

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEngageEvents();
      setEvents(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load events:', error);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesFreeFood = !showOnlyFreeFood || event.hasFreeFood;
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFreeFood && matchesSearch;
  });

  const freeFootCount = events.filter(e => e.hasFreeFood).length;

  const fetchEventDetails = async (eventId) => {
    setLoadingDetails(true);
    try {
      const url = `${API_BASE}/api/event-details?id=${eventId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch details');
      }

      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const eventDetailsCard = doc.querySelector('#event_details .card-block');

      let description = 'No description available';
      let hasFreeFood = false;

      if (eventDetailsCard) {
        const clone = eventDetailsCard.cloneNode(true);
        clone.querySelector('.card-block__title')?.remove();
        clone.querySelector('.card-border')?.remove();

        description = clone.textContent.trim();

        const descLower = description.toLowerCase();
        const freeFootKeywords = [
          'free food', 'free pizza', 'free lunch', 'free dinner',
          'free breakfast', 'free snacks', 'refreshments',
          'food provided', 'snacks provided', 'pizza provided',
          'complimentary food', 'complimentary meal',
          'food will be served', 'free boba', 'free drinks',
        ];
        hasFreeFood = freeFootKeywords.some(k => descLower.includes(k));
      }

      setEventDetails({ description, hasFreeFood });
    } catch (error) {
      console.error('Error fetching details:', error);
      setEventDetails({ description: 'Could not load description', hasFreeFood: false });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setEventDetails(null);
    fetchEventDetails(event.id);
  };

  const closeModal = () => {
    setSelectedEvent(null);
    setEventDetails(null);
  };

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
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${showOnlyFreeFood
                ? 'bg-red-700 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
              <span className="flex items-center gap-2">
                <Pizza className="w-5 h-5" />
                Free Food Only ({freeFootCount})
              </span>
            </button>
          </div>
        </div>

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
                <p className="text-gray-500 mt-2">Try adjusting your filters</p>
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

              {(selectedEvent.hasFreeFood || eventDetails?.hasFreeFood) && (
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

        {event.hasFreeFood && (
          <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full font-bold text-sm shadow-lg flex items-center gap-1">
            <Pizza className="w-4 h-4" />
            FREE FOOD
          </div>
        )}
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