// api/event-details.js
// Vercel Serverless Function to proxy USC Engage event details page
// Invocation: Every HTTP request to /api/event-details triggers this function (prod, preview, or local via `vercel dev`/proxied `npm run dev`);
//             it runs once per request and then terminates, so state does not persist between calls.
// API_BASE (client-side): The frontend defines `API_BASE` in `src/App.jsx`.
//   - Dev (`import.meta.env.DEV`): `http://localhost:3000` (Vercel dev server)
//   - Prod/Preview: '' (same-origin), so requests hit `${origin}/api/...` directly
// Example client call: `${API_BASE}/api/event-details?id=<eventId>`
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Missing event id parameter' });
    }

    try {
        const url = `https://engage.usc.edu/rsvp_boot?id=${id}`;

        console.log('[Proxy] Fetching event details for id:', id);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!response.ok) {
            throw new Error(`USC API returned ${response.status}`);
        }

        const html = await response.text();

        console.log('[Proxy] Successfully fetched details for event', id);

        // Return the HTML
        return res.status(200).send(html);

    } catch (error) {
        console.error('[Proxy] Error:', error);
        return res.status(500).json({
            error: 'Failed to fetch event details',
            message: error.message
        });
    }
}