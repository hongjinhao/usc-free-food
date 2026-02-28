# USC Free Food Finder 🍕

A web application that helps USC students discover campus events with free food by automatically scanning and filtering USC Engage events.

🌐 **Live site**: [usc-free-food2.vercel.app](https://usc-free-food2.vercel.app)

![React](https://img.shields.io/badge/React-19.2-blue)
![Vite](https://img.shields.io/badge/Vite-7.3-646CFF)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38B2AC)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Automated Event Scanning**: Daily cron job fetches and analyzes USC Engage events
- **Smart Free Food Detection**: Keyword-based algorithm identifies events with free food
- **Real-time Search & Filtering**: Search by title/location and filter for free food events
- **Responsive Design**: Beautiful UI that works on desktop and mobile
- **Fast Performance**: Cached data in Supabase for instant loading
- **Event Details**: Click any event to see full descriptions and registration links

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS (hosted on Vercel)
- **Backend (Cron job)**: Vercel Serverless Functions, Node.js
- **Database**: Supabase (PostgreSQL)
- **APIs**: USC Engage event list and details endpoints

## Architecture

```
┌─────────────────┐
│   React App     │  (Vite + Tailwind)
└────────┬────────┘
         │
         ↓ (reads from)
┌─────────────────┐
│    Supabase     │  (PostgreSQL)
└────────┬────────┘
         ↑ (writes to)
         │
┌────────┴────────┐
│  Vercel Cron    │  (Daily)
│  Scan Events    │
└────────┬────────┘
         │
         ↓ (fetches from)
┌─────────────────┐
│  USC Engage API │
└─────────────────┘
```

## Project Structure

```
.
├── src/
│   ├── App.jsx                # Main React component
│   ├── main.jsx               # React entry point
│   └── index.css              # Global styles
├── api/
│   ├── cron-scan-events.js    # Vercel cron entrypoint
│   └── test-extraction.js     # Local HTML extraction test script
├── utils/
│   ├── freeFoodKeywords.js    # Free food keyword list and detection
│   ├── htmlParser.js          # DOM cleaning and text extraction
│   ├── engageClient.js        # USC Engage API fetch and event scanning
│   ├── eventScanner.js        # Batch scan orchestration
│   └── eventRepository.js     # Supabase DB operations
├── tests/                     # Unit tests
├── docs/
│   └── overall_project_context.md
├── vercel.json                # Vercel deployment config
├── vite.config.js             # Vite configuration
└── package.json
```

## Getting Started

### Prerequisites

- Node.js and npm
- Supabase account
- Vercel account (for deployment)

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd usc-free-food
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables

Create a `.env` file in the root directory:
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

```

4. Set up Supabase database

Create a table named `events` with the following schema:
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  order_index INTEGER,
  title TEXT NOT NULL,
  dates TEXT,
  location TEXT,
  image_url TEXT,
  organizer TEXT,
  category TEXT,
  detail_url TEXT NOT NULL,
  attendees TEXT,
  description TEXT,
  has_free_food BOOLEAN DEFAULT FALSE,
  scanned BOOLEAN DEFAULT FALSE,
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), 
  status TEXT,
);
```
Also setup necessary security policies to use Supabase

### Development

Test with Vercel dev server:
```bash
vercel dev
```

Deploy to Vercel:
```bash
vercel --prod
```

Manually test cron job: 
```bash
curl -X GET "https://usc-free-food2.vercel.app/api/cron-scan-events" \
  -H "Authorization:Bearer your_secret_cron_key"
```

Make sure to set all environment variables in the Vercel dashboard.

## Free Food Detection

The app uses a simple keyword matching system, looking for phrases like:
- "free food", "free pizza", "free refreshments"
- "complimentary food", "food provided"
- etc... 

See `utils/freeFoodKeywords.js` for the complete list.


## Vercel Config
See `docs/vercel-config.md` for how `vercel.json` configures install, build, output, and `/api/*` rewrites on Vercel.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
