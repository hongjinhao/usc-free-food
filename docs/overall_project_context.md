# USC Free Food Finder - Project Context

## Overview

A web application to show all USC Engage events with free food detection capabilities.

## Source Data

### Main Events Page
- **URL**: https://engage.usc.edu/events
- **Description**: Shows an overview of all events with title, picture, date/time, tags, and organizer
- **Access**: Public website, no sign-in required

### Individual Event Details
- **URL Pattern**: `https://engage.usc.edu/resed/rsvp_boot?id={event_id}`
- **Example**: https://engage.usc.edu/resed/rsvp_boot?id=408945
- **Content**: Full event description including accessibility information, accommodations, contact details
- **Access**: Public, no sign-in required

## Requirements

- ✅ Good UI/UX
- ✅ Filter by free food
- ✅ Don't overload USC's endpoints
- ✅ Fast load times
- ✅ Use React and JavaScript

## Technology used

- Libraries/Framework used: React, Vite, Tailwind, Supabase (database), Vercel (frontend, cron job)
- Languages: JS, HTML, CSS

## API Analysis

### Events List API
- **Endpoint**: `https://engage.usc.edu/mobile_ws/v17/mobile_events_list`
- **Parameters**:
  - `range`: Starting point (index of first event shown)
  - `limit`: Total number of events returned
  - `filter4_contains`: OR
  - `filter4_notcontains`: OR
  - `order`: undefined
  - `search_word`: (empty for all events)
- **Response Format**: JSON array of event objects
- **CORS**: Enabled

### Event Details API
- **Endpoint**: `https://engage.usc.edu/resed/rsvp_boot?id={eventId}`
- **Response Format**: Server-generated HTML, CSS, and JavaScript
- **Content**: HTML document containing event description and details
- **CORS**: Enabled

## Implementation Progress

### ✅ Completed Tasks

1. **Backend API Discovery**
   - Identified both list API (JSON) and details page (HTML)
   - CORS policy needs to be bypassed

2. **React Application Setup**
   - Created project with Vite
   - Installed dependencies and libraries
   - Started development server

3. **Backend Proxy (Deprecated)**
   - Initially set up Vercel proxy for CORS
   - Later removed as database now serves as backend proxy

4. **Event Parsing**
   - Built event list parser for overview information
   - Extracts relevant fields from JSON response

5. **Free Food Detection**
   - Implemented keyword-based detection system
   - Added comprehensive keyword list
   - Created parsing logic for HTML descriptions

6. **Frontend Development**
   - Designed and built main UI
   - Added detail fetching on click
   - Integrated registration links
   - Implemented search and filter functionality

7. **Data Cleaning**
   - Used regex and HTML parser
   - Cleaned tags (aria-labels from p22 field)
   - Cleaned date/time (decoded HTML entities from p4 field)

8. **Supabase Integration**
   - Created events table with proper schema
   - Set up security policies
   - Configured environment variables
   - Removed need for separate backend proxy

9. **Cron Job Setup**
   - Configured Vercel cron to run daily
   - Upserts database table with latest events
   - Runs at 8 AM UTC daily

10. **Frontend Database Integration**
    - Updated App.jsx to read from Supabase
    - Added order_index for consistent sorting
    - Configured environment variables

11. **Deployment**
    - Deployed to Vercel
    - Production environment configured

12. **Deal with stale events**
    - add an attribute status in the database
    - mark events as "stale" once they stop being returned in the API
    - delete stale events after 30 days. 
    - update frontend to only display active events

### 🚧 Pending Tasks

- refine database datetime, datatype of attendees (text to int)
- Gather user feedback
- Implement improvements based on feedback
  - filter by date
  - identify what type of food/ highlight keyword matched
- Custom domain name


## Architecture Flow

1. **Daily Cron Job** (8 AM UTC)
   - Vercel cron triggers `/api/cron-scan-events`
   - Validates secret token for security

2. **Event Fetching**
   - Calls USC Engage events list API
   - Fetches up to 100 events

3. **Description Scanning**
   - Processes events in batches of 5
   - Fetches HTML for each event detail page
   - Parses and cleans description
   - Scans for free food keywords

4. **Database Update**
   - Upserts all events to Supabase
   - Stores free food detection results
   - Updates timestamp

5. **Frontend Display**
   - React app reads from Supabase
   - Displays events with search/filter
   - Shows free food badges
   - Provides event details on click

## Key Design Decisions

1. **Database as Proxy**: Instead of proxying USC Engage API calls through Vercel functions, we cache all data in Supabase for faster load times and reduced API calls

2. **Batch Processing**: Process events in batches of 5 with 200ms delays to avoid overwhelming USC's servers

3. **Keyword Detection**: Use keyword matching rather than ML to ensure reliability and transparency

4. **Daily Updates**: Cron job runs once per day to balance freshness with API courtesy

5. **Client-Side Filtering**: All search/filter operations happen in React for instant responsiveness