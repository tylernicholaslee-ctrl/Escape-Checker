# Escape Route Check

A small emergency-route planning web app that compares saved routes with current NIFC/WFIGS fire incidents and user-added hazards.

## Project structure

```text
.
├── api/
│   ├── fires.js        # Vercel Function: proxies the NIFC/WFIGS incident feed
│   └── healthz.js      # Vercel Function: health check
├── public/
│   ├── assets/
│   │   ├── app.js      # Browser application
│   │   └── styles.css  # Application styles
│   ├── favicon.svg
│   ├── index.html
│   └── robots.txt
├── scripts/
│   ├── check.mjs       # Dependency-free smoke checks
│   └── dev.mjs         # Dependency-free local development server
├── package.json
└── vercel.json
```

The project intentionally has **no runtime npm dependencies and no frontend build step**. Vercel serves `public/` as static assets and deploys each file in `api/` as a Vercel Function.

## Run locally

Requirements: Node.js 20 or newer.

```sh
npm run dev
```

Open `http://127.0.0.1:3000`.

To use a different port:

```sh
PORT=4000 npm run dev
```

Run the repository smoke checks with:

```sh
npm run check
```

## Deploy to Vercel

### Git deployment

1. Push this directory to GitHub, GitLab, or Bitbucket.
2. Import the repository into Vercel.
3. Keep the repository root as the Vercel project root.
4. Deploy. No environment variables, custom build command, or separate API service are required.

### Vercel CLI

```sh
npx vercel
npx vercel --prod
```

The deployed routes are:

- `/` — application
- `/api/healthz` — health check
- `/api/fires` — current NIFC/WFIGS incidents

## Architecture notes

- The browser stores saved routes, custom hazards, and reminder settings in `localStorage`; they are not synced to a database.
- Browser geolocation stays in the browser and is not sent to the API.
- The fire function is server-side so the browser does not depend on the upstream ArcGIS service allowing cross-origin requests.
- The map uses MapLibre GL JS from unpkg and OpenFreeMap's Liberty map style.
- Route geometry is manually drawn and does not provide road-snapped or turn-by-turn navigation.

## What changed from the original repository

The original Replit workspace contained a React iframe wrapper, a separate Express server, generated API client packages, an unused database package, a mockup sandbox, and Replit-specific configuration. Those layers were not used by the actual application and made a single Vercel deployment unnecessarily complex.

This version keeps the working browser app, promotes it to the site root, replaces the Express process with native Vercel Functions, removes unused workspace packages, and adds a dependency-free local server plus smoke checks.
