<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Escape Route Check</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css">
<link rel="stylesheet" href="/assets/styles.css">
<script src="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js"></script>
</head>
<body>
<header class="top"><h1>Escape Route Check</h1></header>

<div class="wrap">

<!-- HOME -->
<section id="s-home" class="screen on" aria-label="Home">
  <div class="dueBanner"></div>
  <div class="hero">
    <p class="big">Know your way out before you need it.</p>
    <p>Save your escape routes, then see whether any of them passes near a fire or road closure.</p>
  </div>
  <div class="card" id="homeStatus"></div>
  <div class="row">
    <button class="primary big" id="homeDraw">Draw a route</button>
    <button class="big" id="homeRoutes">See my routes</button>
  </div>
  <div class="banner demo" style="margin-top:20px"><strong>Live fire data.</strong> Current fire incidents come from NIFC/WFIGS. Use your location to see the map around you, and always follow official evacuation orders.</div>
</section>

<!-- ROUTES -->
<section id="s-routes" class="screen" aria-label="My routes">
  <div class="dueBanner"></div>
  <h2>My escape routes</h2>
  <div id="routeList"></div>
  <div class="row" style="margin-top:12px">
    <button class="primary" id="routesDraw">Draw a new route</button>
  </div>
</section>

<!-- MAP -->
<section id="s-map" class="screen" aria-label="Map">
  <h2>Build your route</h2>
  <div class="seg" role="group" aria-label="Tap mode">
    <button id="modeRoute" aria-pressed="true">Draw route</button>
    <button id="modeHazard" aria-pressed="false">Mark hazard</button>
  </div>
  <div class="mapctl">
    <button class="primary" id="locate">Use my location</button>
    <button id="zoomIn" aria-label="Zoom in">+</button>
    <button id="zoomOut" aria-label="Zoom out">&minus;</button>
  <button id="refreshFires">Refresh live fires</button>
  </div>
  <div class="mapbox"><div id="maplibre" aria-label="OpenFreeMap showing roads and place names"></div><canvas id="map" width="680" height="660" tabindex="0" role="img" aria-label="Map overlay with your route and fire hazards. Tap the map to add route points; drag to pan."></canvas></div>
  <p id="fireStatus" class="muted" role="status" aria-live="polite">Loading current fire incidents from NIFC/WFIGS…</p>
  <p class="muted">Tap the map to add route points. Drag to pan; use the plus and minus buttons to zoom. Your first point is the start and your last point is the destination.</p>
  <div class="legend">
    <span><i style="background:var(--route)"></i>Route you are drawing</span>
    <span><i style="background:var(--me);border-radius:50%"></i>Your location</span>
    <span><i style="background:var(--danger)"></i>Hazard zone</span>
    <span><i style="border:2px dashed var(--warn);background:transparent"></i>Warning buffer</span>
  </div>
  <div id="modeRouteBox">
    <p id="draftInfo" class="muted" aria-live="polite"></p>
    <div id="draftResult"></div>
    <label for="routeName">Route name</label>
    <input type="text" id="routeName" placeholder="For example, Home to the library" maxlength="60">
    <div class="row" style="margin-top:10px">
      <button id="undo" disabled>Undo point</button>
      <button id="clear" disabled>Clear points</button>
      <button class="primary grow" id="saveRoute" disabled>Save route</button>
    </div>
  </div>
  <div id="modeHazardBox" hidden>
    <p class="muted">Tap the map to mark the center of a hazard, such as a fire or road closure you heard about.</p>
    <label for="hazR">Hazard radius (miles)</label>
    <input type="number" id="hazR" min="0.5" max="30" step="0.5" value="2">
  </div>
  <details>
    <summary>Add a point by coordinates instead</summary>
    <label for="coord">Latitude, longitude</label>
  <div class="row"><input type="text" id="coord" class="grow" placeholder="Latitude, longitude" inputmode="decimal"><button id="addCoord">Add point</button><button id="centerCoord">Center map here</button></div>
  </details>
  <p id="mapMsg" class="muted" role="status" aria-live="polite"></p>
  <h3>Saved routes on the map</h3>
  <ul class="plain" id="mapRoutes"></ul>
  <h3>Hazards on the map</h3>
  <ul class="plain" id="hazList"></ul>
</section>

<!-- REMINDERS -->
<section id="s-alerts" class="screen" aria-label="Reminders and settings">
  <h2>Reminder</h2>
  <div class="card">
    <label for="every">Remind me to re-check my routes</label>
    <select id="every">
      <option value="0">Never</option>
      <option value="7">Every week</option>
      <option value="30">Every month</option>
      <option value="90">Every 3 months</option>
    </select>
    <p id="remStatus" class="muted"></p>
    <div class="row">
      <button class="primary" id="markReviewed">I re-checked my routes</button>
      <button id="askNotif">Allow notifications</button>
    </div>
    <p class="muted">The reminder appears at the top of Home and Routes whenever you open this page. Device notifications only show while the page is open in your browser.</p>
  </div>
  <div class="card">
    <label for="buffer">Warn me when a route is within</label>
    <select id="buffer">
      <option value="1.609">1 mile of a hazard</option>
      <option value="3.219">2 miles of a hazard</option>
      <option value="8.047">5 miles of a hazard</option>
    </select>
  </div>
  <h2 style="margin-top:1.4rem">Your data</h2>
  <div class="card">
    <p class="muted">Routes and hazards are saved in this browser on this device only. Nothing is sent to a server.</p>
    <button class="danger" id="wipe">Erase all routes and hazards</button>
  </div>
</section>

</div>

<div id="toast" role="status"><span id="toastText"></span><button id="toastUndo">Undo</button></div>

<nav class="tabs" aria-label="Screens"><div class="in">
  <button data-tab="home" aria-current="page">Home</button>
  <button data-tab="routes">Routes</button>
  <button data-tab="map">Map</button>
  <button data-tab="alerts">Reminders</button>
</div></nav>

<script src="/assets/app.js"></script>
</body>
</html>
