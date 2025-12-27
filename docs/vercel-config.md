# Vercel Deployment Config (`vercel.json`)

This project deploys on Vercel using the configuration in `vercel.json`.

- **Install step:** `installCommand` runs `npm install` to install dependencies.
- **Build step:** `buildCommand` runs `npm run build` to produce the production build.
- **Framework:** `framework` is set to `vite` so Vercel applies Vite-specific optimizations.
- **Output directory:** `outputDirectory` is `dist`, which is where Vite outputs built assets.
- **API routing:** `rewrites` route requests to `/api/:path*` to the matching serverless functions under the `api/` folder (for example `api/events.js`, `api/event-details.js`). This preserves backend endpoints like `/api/events` alongside the frontend app.

On deployment, Vercel installs dependencies, builds the app, serves the contents of `dist`, and handles `/api/*` requests via serverless functions defined in `api/`.
