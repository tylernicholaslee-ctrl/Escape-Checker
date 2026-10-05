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
│   ├── build.mjs       # Copies public/ to dist/ for Vercel
│   ├── check.mjs       # JSON, syntax, asset, and API smoke checks
│   └── dev.mjs         # Dependency-free local development server
├── package.json
└── vercel.json
```

The project has no runtime npm dependencies. `npm run build` creates the deployable static frontend in `dist/`, while files in `api/` deploy as Vercel Functions.

## Run locally

Use a modern Node.js version. Vercel is pinned to Node.js 24.x in `package.json`.

```sh
npm run dev
```

Open `http://127.0.0.1:3000`.

To use a different port:

```sh
PORT=4000 npm run dev
```

Run the repository checks and production build with:

```sh
npm run check
npm run build
```

## Deploy to Vercel

### Git deployment

1. Extract the ZIP.
2. Push the **contents of the extracted folder** to GitHub, GitLab, or Bitbucket so `package.json`, `vercel.json`, `api/`, and `public/` are at the repository root.
3. Import that repository into Vercel.
4. Keep the repository root as the Vercel project root.
5. Deploy. The build command and output directory are already defined in `vercel.json`.

No environment variables or separate backend service are required.

### Vercel CLI

From the extracted project directory:

```sh
npx vercel
npx vercel --prod
```

The deployed routes are:

- `/` — application
- `/api/healthz` — health check
- `/api/fires` — current NIFC/WFIGS incidents

## Vercel configuration

`vercel.json` is intentionally minimal:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

Both `vercel.json` and `package.json` are parsed by `npm run check` before deployment.

## Architecture notes

- The browser stores saved routes, custom hazards, and reminder settings in `localStorage`; they are not synced to a database.
- Browser geolocation stays in the browser and is not sent to the API.
- The fire function is server-side so the browser does not depend on the upstream ArcGIS service allowing cross-origin requests.
- The map uses MapLibre GL JS from unpkg and OpenFreeMap's Liberty map style.
- Route geometry is manually drawn and does not provide road-snapped or turn-by-turn navigation.

## What changed from the original repository

The original Replit workspace contained a React iframe wrapper, a separate Express server, generated API client packages, an unused database package, a mockup sandbox, and Replit-specific configuration. Those layers were not used by the actual application and made a single Vercel deployment unnecessarily complex.

This version keeps the working browser app, replaces the Express process with native Vercel Functions, removes unused workspace packages, and uses an explicit `public/` → `dist/` production build for predictable Vercel deployment.
