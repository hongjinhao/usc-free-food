// api/events.js
// Vercel Serverless Function to proxy USC Engage events API
// Invocation: Every HTTP request to /api/events triggers a fresh serverless invocation (prod, preview, or local via `vercel dev`/`npm run dev` when proxied);
//             there is no long-lived process, so each call runs independently and then terminates.
// API_BASE (client-side): The frontend defines `API_BASE` in `src/App.jsx`.
//   - Dev (`import.meta.env.DEV`): `http://localhost:3000` (Vercel dev server)
//   - Prod/Preview: '' (same-origin), so requests hit `${origin}/api/...` directly
// Example client call: `${API_BASE}/api/events`
export default async function handler(req, res) {
    console.log('Function running on:', process.cwd());

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const url = 'https://engage.usc.edu/mobile_ws/v17/mobile_events_list?range=0&limit=50&filter4_contains=OR&filter4_notcontains=OR&order=undefined&search_word=';

        console.log('[Proxy] Fetching from USC Engage...');

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!response.ok) {
            throw new Error(`USC API returned ${response.status}`);
        }

        const data = await response.json();

        console.log('[Proxy] Successfully fetched', data.length, 'items from API');

        // Return the data
        return res.status(200).json(data);

    } catch (error) {
        console.error('[Proxy] Error:', error);
        return res.status(500).json({
            error: 'Failed to fetch events',
            message: error.message
        });
    }
}