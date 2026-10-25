(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s) };
  var KEY = "escape-route-check.v2";
  var KM_PER_MI = 1.609344;
  var W = 680,
    H = 660,
    LAT0 = 20;
  var state = load();
  var draft = [];
  var draftStops = [];
  var draftMeta = null;
  var routing = false;
  var routeRequestId = 0;
  var mode = "route";
  var selectedId = null;
  var lastDeleted = null;
  var toastTimer = null;
  var liveHazards = [];
  var liveFetchedAt = null;
  var maplibre = null;
  var reminderWasDue = false;

  function fresh() {
    return {
      routes: [],
      hazards: [],
      settings: {
        every: "monthly",
        last: null,
        buffer: 3.219
      }
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.routes && s.hazards && s.settings) {
          s.hazards = s.hazards.filter(function (h) {
            return !h.sample;
          });
          s.routes = s.routes.filter(function (r) {
            return r.name !== "Example: canyon home to Burbank";
          });
          if (["never", "daily", "weekly", "monthly"].indexOf(s.settings.every) === -1) {
            var legacyInterval = Number(s.settings.every);
            s.settings.every = legacyInterval === 0 ? "never" :
              legacyInterval === 1 ? "daily" :
                legacyInterval === 7 ? "weekly" : "monthly";
          }
          return s;
        }
      }
    } catch (e) {}
    return fresh();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function esc(t) {
    var d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
  }

  function mi(km) {
    return (km / KM_PER_MI).toFixed(1) + " mi";
  }

  function uid() {
    return "id" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }
  /* ---------- geometry ---------- */
  function proj(p, refLat) {
    var lat = Number.isFinite(refLat) ? refLat : p[0];
    return [
      p[1] * 111.32 * Math.cos(lat * Math.PI / 180),
      p[0] * 110.57
    ];
  }

  function ptSeg(p, a, b) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var l2 = dx * dx + dy * dy;
    var t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  function minDist(pts, h) {
    var refLat = h.lat;
    var c = proj(
      [h.lat, h.lon], refLat);
    var P = pts.map(function (p) {
      return proj(p, refLat);
    });
    var m = Infinity;
    for (var i = 0; i < P.length - 1; i++) {
      m = Math.min(m, ptSeg(c, P[i], P[i + 1]));
    }
    return m;
  }

  function lengthKm(pts) {
    var s = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var refLat = (pts[i][0] + pts[i + 1][0]) / 2;
      var a = proj(pts[i], refLat);
      var b = proj(pts[i + 1], refLat);
      s += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return s;
  }

  function routeLengthKm(r) {
    if (Number.isFinite(r.distanceKm) && r.distanceKm > 0) {
      return r.distanceKm;
    }
    return lengthKm(r.pts || []);
  }

  function closestHazard(pts) {
    var worst = null;
    if (pts.length < 2) {
      return null;
    }
    state.hazards.concat(liveHazards).forEach(function (h) {
      var clr = minDist(pts, h) - h.r;
      if (!worst || clr < worst.clr) {
        worst = {
          h: h,
          clr: clr
        };
      }
    });
    return worst;
  }

  function analyze(pts) {
    var buf = state.settings.buffer;
    var worst = closestHazard(pts);
    if (pts.length < 2) {
      return null;
    }
    if (!worst) {
      return {
        status: "clear",
        text: "No hazards are marked on the map."
      };
    }
    if (worst.clr < 0) {
      return {
        status: "danger",
        text: "Passes through " + worst.h.name + ". Choose another way out."
      };
    }
    if (worst.clr <= buf) {
      return {
        status: "warn",
        text: "Comes within " + mi(worst.clr) + " of " + worst.h.name +
          ". Have a backup route ready."
      };
    }
    return {
      status: "clear",
      text: "No marked hazard within " + mi(buf) + " of this route."
    };
  }

  function safestRoute(routes) {
    var statusRank = {
      danger: 0,
      warn: 1,
      clear: 2
    };
    var best = null;
    routes.forEach(function (route, index) {
      var coordinates = route.geometry && route.geometry.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        return;
      }
      var pts = coordinates.map(function (point) {
        return [Number(point[1]), Number(point[0])];
      }).filter(function (point) {
        return Number.isFinite(point[0]) && Number.isFinite(point[1]);
      });
      if (pts.length < 2) {
        return;
      }
      var analysis = analyze(pts);
      var hazard = closestHazard(pts);
      var clearance = hazard ? hazard.clr : Infinity;
      if (!best ||
        statusRank[analysis.status] > statusRank[best.analysis.status] ||
        (analysis.status === best.analysis.status && clearance > best.clearance)) {
        best = {
          route: route,
          pts: pts,
          analysis: analysis,
          clearance: clearance,
          index: index
        };
      }
    });
    return best;
  }
  var LABEL = {
    danger: "Danger",
    warn: "Warning",
    clear: "Clear"
  };

  function chip(a) {
    return ('<span class="chip ' + a.status + '">' + LABEL[a.status] + "</span>");
  }
  /* ---------- map ---------- */
  var cv = $("#map");
  var ctx = cv.getContext("2d");
  var KX = 111.32 * Math.cos(LAT0 * Math.PI / 180);
  var KY = 110.57;
  var MIN_K = 0.003;
  var MAX_K = 0.3;
  var DEF_VIEW = {
    lat: 20,
    lon: 0,
    k: 0.3
  };
  var view = {
    lat: DEF_VIEW.lat,
    lon: DEF_VIEW.lon,
    k: DEF_VIEW.k
  };
  var me = null;

  function clampK(k) {
    return Math.max(MIN_K, Math.min(MAX_K, k));
  }

  function syncView() {
    if (maplibre) {
      var c = maplibre.getCenter();
      view.lat = c.lat;
      view.lon = c.lng;
    }
  }

  function toXY(lat, lon) {
    if (maplibre && cv.clientWidth && cv.clientHeight) {
      var q = maplibre.project([
        lon,
        lat
      ]);
      return [
        q.x * W / cv.clientWidth,
        q.y * H / cv.clientHeight
      ];
    }
    return [
      W / 2 + (lon - view.lon) * KX / view.k,
      H / 2 - (lat - view.lat) * KY / view.k
    ];
  }

  function toLL(x, y) {
    if (maplibre && cv.clientWidth && cv.clientHeight) {
      var q = maplibre.unproject([
        x * cv.clientWidth / W,
        y * cv.clientHeight / H
      ]);
      return [
        q.lat,
        q.lng
      ];
    }
    return [
      view.lat - (y - H / 2) * view.k / KY,
      view.lon + (x - W / 2) * view.k / KX
    ];
  }

  function radiusPx(h) {
    if (maplibre && cv.clientWidth) {
      var c = maplibre.project([
        h.lon,
        h.lat
      ]);
      var lonScale = 111.32 * Math.cos(h.lat * Math.PI / 180);
      if (Math.abs(lonScale) < 1e-6) {
        lonScale = 1e-6;
      }
      var e = maplibre.project([
        h.lon + h.r / lonScale,
        h.lat
      ]);
      return Math.max(2, Math.abs(e.x - c.x) * W / cv.clientWidth);
    }
    return h.r / view.k;
  }

  function css(n) {
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  }

  function statusColor(s) {
    if (s === "danger") {
      return css("--danger");
    }
    if (s === "warn") {
      return css("--warn");
    }
    return css("--ok");
  }

  function inView(q, m) {
    return (q[0] > -m && q[0] < W + m && q[1] > -m && q[1] < H + m);
  }

  function drawLine(pts, color, width, dots) {
    if (!pts || !pts.length) {
      return;
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach(function (p, i) {
      var q = toXY(p[0], p[1]);
      if (i) {
        ctx.lineTo(q[0], q[1]);
      } else {
        ctx.moveTo(q[0], q[1]);
      }
    });
    ctx.stroke();
    if (dots) {
      pts.forEach(function (p, i) {
        var q = toXY(p[0], p[1]);
        ctx.fillStyle = css("--surface");
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (i === pts.length - 1 && pts.length > 1) {
          ctx.rect(q[0] - 8, q[1] - 8, 16, 16);
        } else {
          ctx.arc(q[0], q[1], 8, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
      });
    }
  }

  function drawEndpointMarkers(points) {
    points.forEach(function (point, index) {
      var q = toXY(point[0], point[1]);
      var isStart = index === 0;
      var isEnd = index === points.length - 1 && points.length > 1;
      ctx.fillStyle = css("--surface");
      ctx.strokeStyle = css("--route");
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (isEnd) {
        ctx.rect(q[0] - 9, q[1] - 9, 18, 18);
      } else {
        ctx.arc(q[0], q[1], 9, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = css("--route");
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (isStart) {
        ctx.fillText("S", q[0], q[1]);
      } else if (isEnd) {
        ctx.fillText("E", q[0], q[1]);
      }
    });
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  function draw() {
    syncView();
    ctx.clearRect(0, 0, W, H);
    if (!maplibre) {
      ctx.fillStyle = css("--land");
      ctx.fillRect(0, 0, W, H);
      var pxPerDegLon = KX / view.k;
      var steps = [
        0.001,
        0.0025,
        0.005,
        0.01,
        0.025,
        0.05,
        0.1,
        0.25,
        0.5,
        1
      ];
      var step = 1;
      for (var si = 0; si < steps.length; si++) {
        if (steps[si] * pxPerDegLon >= 90) {
          step = steps[si];
          break;
        }
      }
      var dec = (String(step).split(".")[1] || "").length;
      var tl = toLL(0, 0);
      var br = toLL(W, H);
      ctx.strokeStyle = css("--grid");
      ctx.lineWidth = 1;
      ctx.fillStyle = css("--muted");
      ctx.font = "12px sans-serif";
      for (var i = Math.ceil(tl[1] / step); i * step <= br[1]; i++) {
        var lo = i * step;
        var x = toXY(view.lat, lo)[0];
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.fillText(lo.toFixed(dec), x + 3, 14);
      }
      for (var j = Math.ceil(br[0] / step); j * step <= tl[0]; j++) {
        var la = j * step;
        var y = toXY(la, view.lon)[1];
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.fillText(la.toFixed(dec), 4, y - 4);
      }
    }
    /* hazards */
    state.hazards.concat(liveHazards).forEach(function (h) {
      var q = toXY(h.lat, h.lon);
      var r = radiusPx(h);
      var rb = radiusPx({
        lat: h.lat,
        lon: h.lon,
        r: h.r + state.settings.buffer
      });
      if (q[0] + rb < 0 || q[0] - rb > W || q[1] + rb < 0 || q[1] - rb > H) {
        return;
      }
      ctx.setLineDash([
        8,
        6
      ]);
      ctx.strokeStyle = css("--warn");
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(q[0], q[1], rb, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = css("--danger");
      ctx.globalAlpha = .28;
      ctx.beginPath();
      ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = css("--danger");
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
      ctx.stroke();
      var labelX = q[0] - Math.min(r * 0.6, 80);
      var labelY = q[1] + 4;
      ctx.font = "bold 13px sans-serif";
      ctx.textBaseline = "middle";
      // white outline keeps dark labels readable
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#FFFFFF";
      ctx.strokeText(h.name, labelX, labelY);
      // main text
      ctx.fillStyle = "#0A0A0A";
      ctx.fillText(h.name, labelX, labelY);
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(h.name, q[0] - Math.min(r * .6, 80), q[1] + 4);
    });
    /* saved routes */
    state.routes.forEach(function (r) {
      var a = analyze(r.pts);
      var sel = r.id === selectedId;
      if (sel) {
        drawLine(r.pts, css("--surface"), 13, false);
      }
      drawLine(r.pts, statusColor(a ? a.status : "clear"), sel ? 8 : 4, false);
      if (sel) {
        var q = toXY(r.pts[0][0], r.pts[0][1]);
        ctx.fillStyle = css("--ink");
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(r.name, q[0] + 10, q[1] + 22);
      }
    });
    /* current road route */
    if (draft.length > 1) {
      drawLine(draft, css("--surface"), 12, false);
      drawLine(draft, css("--route"), 7, false);
    }
    if (draftStops.length) {
      drawEndpointMarkers(draftStops);
    }
    /* my location */
    if (me) {
      var m = toXY(me.lat, me.lon);
      if (inView(m, 20)) {
        ctx.fillStyle = css("--me");
        ctx.globalAlpha = .22;
        ctx.beginPath();
        ctx.arc(m[0], m[1], 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = css("--me");
        ctx.strokeStyle = css("--surface");
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(m[0], m[1], 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (!maplibre) {
      var opts = [
        0.05,
        0.1,
        0.25,
        0.5,
        1,
        2,
        5,
        10,
        20,
        50
      ];
      var best = opts[0];
      opts.forEach(function (o) {
        if (o * KM_PER_MI / view.k <= 150) {
          best = o;
        }
      });
      var len = best * KM_PER_MI / view.k;
      ctx.fillStyle = css("--surface");
      ctx.globalAlpha = .85;
      ctx.fillRect(10, H - 52, len + 24, 42);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = css("--ink");
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(22, H - 24);
      ctx.lineTo(22 + len, H - 24);
      ctx.moveTo(22, H - 30);
      ctx.lineTo(22, H - 18);
      ctx.moveTo(22 + len, H - 30);
      ctx.lineTo(22 + len, H - 18);
      ctx.stroke();
      ctx.fillStyle = css("--ink");
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(best + (best === 1 ? " mile" : " miles"), 22, H - 34);
    }
  }
  /* ---------- live fire data ---------- */
  function fireName(a, index) {
    return (a.IncidentName || a.incidentname || a.FireName || a.fire_name || a
      .poly_IncidentName || ("Active fire " + (index + 1)));
  }

  function fireRadiusKm(a) {
    var acres = Number(a.TotalAcres || a.IncidentSize || a.DailyAcres || 0);
    return acres > 0 ? Math.max(.5, Math.sqrt(acres * .004046 / Math.PI)) : 2;
  }

  function loadLiveFires() {
    var status = $("#fireStatus");
    if (status) {
      status.textContent = "Refreshing current fire incidents…";
    }
    fetch("/api/fires", {
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) {
        throw new Error("fire feed unavailable");
      }
      return r.json();
    }).then(function (payload) {
      var features = Array.isArray(payload.features) ? payload.features : [];
      liveHazards = features.map(function (f, i) {
        var a = f.attributes || {};
        var g = f.geometry || {};
        var lat = Number(g.y);
        var lon = Number(g.x);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return null;
        }
        return {
          id: "live-" + (a.IncidentID || i),
          name: fireName(a, i),
          lat: lat,
          lon: lon,
          r: fireRadiusKm(a),
          live: true,
          sample: false
        };
      }).filter(Boolean);
      liveFetchedAt = payload.fetchedAt ? new Date(payload.fetchedAt) : new Date();
      if (status) {
        status.textContent = liveHazards.length + " current fire incident" + (liveHazards
            .length === 1 ? "" : "s") + " loaded from NIFC/WFIGS at " + liveFetchedAt
          .toLocaleTimeString(
            [], {
              hour: "numeric",
              minute: "2-digit"
            }) + ".";
      }
      if (draftStops.length >= 2 && !routing && draftMeta) {
        requestRoadRoute();
      }
      renderAll();
    }).catch(function () {
      if (status) {
        status.textContent =
          "Live fire data could not be refreshed. Tap “Refresh live fires” to try again.";
      }
    });
  }
  /* ---------- MapLibre ---------- */
  function initRoadMap() {
    if (maplibre || !$("#maplibre")) {
      return;
    }
    if (!window.maplibregl) {
      $("#maplibre").style.display = "none";
      cv.style.pointerEvents = "auto";
      $("#mapMsg").textContent =
        "The road map could not load. You can still use the coordinate map below.";
      return;
    }
    try {
      maplibre = new window.maplibregl.Map({
        container: "maplibre",
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [
          0,
          20
        ],
        zoom: 1.5,
        attributionControl: true,
        dragPan: true,
        scrollZoom: true,
        doubleClickZoom: true,
        touchZoomRotate: true,
        keyboard: true
      });
    } catch (e) {
      maplibre = null;
      $("#maplibre").style.display = "none";
      cv.style.pointerEvents = "auto";
      $("#mapMsg").textContent =
        "The road map could not load. You can still use the coordinate map below.";
      return;
    }
    cv.style.pointerEvents = "none";
    maplibre.addControl(new window.maplibregl.NavigationControl(), "top-right");
    maplibre.addControl(new window.maplibregl.ScaleControl({
      maxWidth: 120,
      unit: "imperial"
    }), "bottom-left");
    maplibre.on("load", function () {
      maplibre.resize();
      syncView();
      draw();
      loadLiveFires();
      if (!me) {
        locate(false);
      }
    });
    maplibre.on("move", function () {
      syncView();
      draw();
    });
    maplibre.on("resize", draw);
    maplibre.on("click", function (e) {
      var target = e.originalEvent && e.originalEvent.target;
      if (target && target.closest && target.closest(".maplibregl-ctrl")) {
        return;
      }
      addPoint([
        e.lngLat.lat,
        e.lngLat.lng
      ]);
    });
  }

  function pointFromEvent(e) {
    var r = cv.getBoundingClientRect();
    return toLL(
      (e.clientX - r.left) * W / r.width,
      (e.clientY - r.top) * H / r.height);
  }
  /* ---------- road routing ---------- */
  function resetDraft() {
    routeRequestId++;
    draft = [];
    draftStops = [];
    draftMeta = null;
    routing = false;
  }

  function requestRoadRoute() {
    if (draftStops.length < 2) {
      return;
    }
    var requestId =
      ++routeRequestId;
    var previousDraft = draft.slice();
    var previousMeta = draftMeta;
    var requestedStops = draftStops.slice();
    routing = true;
    draftMeta = null;
    $("#mapMsg").textContent = "Finding the roads between your selected points…";
    renderAll();
    fetch("/api/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        points: requestedStops
      })
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error(payload.error || "Unable to calculate route.");
        }
        return payload;
      });
    }).then(function (payload) {
      if (requestId !== routeRequestId) {
        return;
      }
      var candidates = [payload].concat(Array.isArray(payload.alternatives) ?
        payload.alternatives : []);
      var selectedRoute = safestRoute(candidates);
      if (!selectedRoute) {
        throw new Error("Invalid route geometry.");
      }
      draft = selectedRoute.pts;
      draftMeta = selectedRoute.route;
      draftMeta.alternativeIndex = selectedRoute.index;
      draftMeta.alternativeCount = candidates.length;
      routing = false;
      if (selectedRoute.index > 0 && selectedRoute.analysis.status === "clear") {
        $("#mapMsg").textContent =
          "A safer alternate road route was selected to avoid the marked hazard buffer.";
      } else if (selectedRoute.index > 0) {
        $("#mapMsg").textContent =
          "A safer available alternate was selected, but it is still near a marked hazard. Review the warning and consider changing your route points.";
      } else if (selectedRoute.analysis.status !== "clear") {
        $("#mapMsg").textContent =
          "No available alternate clears the marked hazard buffer. Showing the safest route returned; review the warning or change your route points.";
      } else {
        $("#mapMsg").textContent =
          "Road route highlighted. Review it against nearby hazards before saving.";
      }
      fitTo(draft);
      renderAll();
    }).catch(function (error) {
      if (requestId !== routeRequestId) {
        return;
      }
      routing = false;
      draftStops = requestedStops.slice(0, -1);
      draft = previousDraft;
      draftMeta = previousMeta;
      $("#mapMsg").textContent = (error && error.message) ||
        "I couldn't find a drivable road route to that point. Try a destination closer to a mapped road.";
      renderAll();
    });
  }
  /* ---------- map clicks ---------- */
  function addPoint(ll) {
    if (mode === "route") {
      if (routing) {
        $("#mapMsg").textContent = "The road route is still being calculated.";
        return;
      }
      var point = [+ll[0].toFixed(5), +ll[1].toFixed(5)];
      draftStops.push(point);
      selectedId = null;
      if (draftStops.length === 1) {
        draft = [
          point
        ];
        draftMeta = null;
        $("#mapMsg").textContent = "Start selected. Now tap your destination.";
        renderAll();
      } else {
        requestRoadRoute();
      }
      return;
    }
    var r = parseFloat($("#hazR").value);
    if (!(r > 0)) {
      $("#mapMsg").textContent = "Enter a hazard radius greater than 0.";
      return;
    }
    var n = state.hazards.filter(function (h) {
      return !h.sample;
    }).length + 1;
    state.hazards.push({
      id: uid(),
      name: "My hazard " + n,
      lat: +ll[0].toFixed(5),
      lon: +ll[1].toFixed(5),
      r: r * KM_PER_MI
    });
    save();
    $("#mapMsg").textContent = "Hazard added. Every saved route was re-checked.";
    renderAll();
  }
  /* ---------- pan by dragging ---------- */
  var drag = null;
  cv.addEventListener("pointerdown", function (e) {
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (x) {}
    drag = {
      x: e.clientX,
      y: e.clientY,
      lat: view.lat,
      lon: view.lon,
      moved: false
    };
  });
  cv.addEventListener("pointermove", function (e) {
    if (!drag) {
      return;
    }
    var r = cv.getBoundingClientRect();
    var s = W / r.width;
    var dx = (e.clientX - drag.x) * s;
    var dy = (e.clientY - drag.y) * s;
    if (!drag.moved && Math.hypot(dx, dy) < 8) {
      return;
    }
    drag.moved = true;
    view.lon = drag.lon - dx * view.k / KX;
    view.lat = drag.lat + dy * view.k / KY;
    draw();
  });
  cv.addEventListener("pointerup", function (e) {
    if (!drag) {
      return;
    }
    var d = drag;
    drag = null;
    if (!d.moved) {
      addPoint(pointFromEvent(e));
    }
  });
  cv.addEventListener("pointercancel", function () {
    drag = null;
  });
  cv.addEventListener("keydown", function (e) {
    var stepPx = 80 * view.k;
    var used = true;
    if (e.key === "ArrowLeft") {
      view.lon -= stepPx / KX;
    } else if (e.key === "ArrowRight") {
      view.lon += stepPx / KX;
    } else if (e.key === "ArrowUp") {
      view.lat += stepPx / KY;
    } else if (e.key === "ArrowDown") {
      view.lat -= stepPx / KY;
    } else if (e.key === "+" || e.key === "=") {
      view.k = clampK(view.k / 2);
    } else if (e.key === "-") {
      view.k = clampK(view.k * 2);
    } else {
      used = false;
    }
    if (used) {
      e.preventDefault();
      draw();
    }
  });
  /* ---------- zoom / location ---------- */
  $("#zoomIn").addEventListener("click", function () {
    if (maplibre) {
      maplibre.zoomIn();
    } else {
      view.k = clampK(view.k / 2);
      draw();
    }
  });
  $("#zoomOut").addEventListener("click", function () {
    if (maplibre) {
      maplibre.zoomOut();
    } else {
      view.k = clampK(view.k * 2);
      draw();
    }
  });

  function fitTo(pts) {
    var la = pts.map(function (p) {
      return p[0];
    });
    var lo = pts.map(function (p) {
      return p[1];
    });
    var a = Math.min.apply(null, la);
    var b = Math.max.apply(null, la);
    var c = Math.min.apply(null, lo);
    var d = Math.max.apply(null, lo);
    if (maplibre) {
      maplibre.fitBounds(
        [
          [c, a],
          [d, b]
        ], {
          padding: 70,
          maxZoom: 15,
          duration: 350
        });
    } else {
      view.lat = (a + b) / 2;
      view.lon = (c + d) / 2;
      view.k = clampK(Math.max(
        (d - c) * KX / W,
        (b - a) * KY / H) * 1.5 || MIN_K);
    }
  }

  function locate(manual) {
    var msg = $("#mapMsg");
    if (!navigator.geolocation) {
      if (manual) {
        msg.textContent =
          "This browser can't share your location. Pick an area or enter coordinates instead.";
      }
      return;
    }
    if (manual) {
      msg.textContent = "Finding your location…";
    }
    navigator.geolocation.getCurrentPosition(function (p) {
      me = {
        lat: p.coords.latitude,
        lon: p.coords.longitude
      };
      if (maplibre) {
        maplibre.flyTo({
          center: [
            me.lon,
            me.lat
          ],
          zoom: 12,
          duration: 500
        });
      } else {
        view.lat = me.lat;
        view.lon = me.lon;
        view.k = 0.008;
      }
      msg.textContent = "Zoomed to your location. It stays on this device.";
      draw();
    }, function () {
      msg.textContent = manual ?
        "Couldn't get your location. Allow location access in your browser, pick an area, or enter coordinates." :
        "";
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    });
  }
  $("#locate").addEventListener("click", function () {
    locate(true);
  });
  /* ---------- coordinate input ---------- */
  function readCoord() {
    var m = $("#coord").value.split(/[ ,]+/).filter(Boolean).map(Number);
    var msg = $("#mapMsg");
    if (m.length !== 2 || m.some(isNaN) || Math.abs(m[0]) > 90 || Math.abs(m[1]) > 180) {
      msg.textContent = "Enter two numbers separated by a comma, like 34.09, -118.60.";
      return null;
    }
    return m;
  }
  $("#addCoord").addEventListener("click", function () {
    var m = readCoord();
    if (!m) {
      return;
    }
    var q = toXY(m[0], m[1]);
    if (!inView(q, -20)) {
      view.lat = m[0];
      view.lon = m[1];
    }
    addPoint(m);
    $("#coord").value = "";
  });
  $("#centerCoord").addEventListener("click", function () {
    var m = readCoord();
    if (!m) {
      return;
    }
    if (maplibre) {
      maplibre.flyTo({
        center: [
          m[1],
          m[0]
        ],
        zoom: 12,
        duration: 500
      });
    } else {
      view.lat = m[0];
      view.lon = m[1];
      if (view.k > 0.05) {
        view.k = 0.02;
      }
    }
    $("#mapMsg").textContent = "Map centered on " + m[0] + ", " + m[1] + ".";
    draw();
  });
  /* ---------- mode ---------- */
  function setMode(m) {
    mode = m;
    $("#modeRoute").setAttribute("aria-pressed", m === "route");
    $("#modeHazard").setAttribute("aria-pressed", m === "hazard");
    $("#modeRouteBox").hidden = m !== "route";
    $("#modeHazardBox").hidden = m !== "hazard";
    $("#mapMsg").textContent = "";
  }
  $("#modeRoute").addEventListener("click", function () {
    setMode("route");
  });
  $("#modeHazard").addEventListener("click", function () {
    setMode("hazard");
  });
  /* ---------- undo ---------- */
  $("#undo").addEventListener("click", function () {
    if (!draftStops.length || routing) {
      return;
    }
    routeRequestId++;
    routing = false;
    draftStops.pop();
    draftMeta = null;
    if (draftStops.length >= 2) {
      draft = draftStops.slice();
      requestRoadRoute();
    } else {
      draft = draftStops.slice();
      $("#mapMsg").textContent = draftStops.length ?
        "Destination removed. Tap a new destination." :
        "Route cleared. Tap the map to choose a new start.";
      renderAll();
    }
  });
  /* ---------- clear ---------- */
  $("#clear").addEventListener("click", function () {
    if (!draftStops.length && !routing) {
      return;
    }
    resetDraft();
    selectedId = null;
    $("#routeName").value = "";
    $("#mapMsg").textContent = "Route cleared. Tap the map to choose a new start.";
    renderAll();
  });
  /* ---------- save route ---------- */
  $("#saveRoute").addEventListener("click", function () {
    var msg = $("#mapMsg");
    if (draftStops.length < 2 || routing || !draftMeta) {
      msg.textContent =
        "Choose a start and destination, then wait for the road route to finish.";
      return;
    }
    var name = $("#routeName").value.trim() || ("Route " + (state.routes.length + 1));
    var id = uid();
    state.routes.push({
      id: id,
      name: name,
      pts: draft.slice(),
      stops: draftStops.slice(),
      distanceKm: Number(draftMeta.distanceMeters) / 1000,
      roads: Array.isArray(draftMeta.roads) ? draftMeta.roads.slice() : [],
      routed: true
    });
    if (!state.settings.last) {
      state.settings.last = new Date().toISOString();
    }
    save();
    resetDraft();
    $("#routeName").value = "";
    msg.textContent = "";
    selectedId = id;
    renderAll();
    showTab("routes");
  });
  /* ---------- delete with undo ---------- */
  function toast(text) {
    $("#toastText").textContent = text;
    $("#toast").classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      $("#toast").classList.remove("on");
      lastDeleted = null;
    }, 7000);
  }

  function removeRoute(id) {
    var i = state.routes.findIndex(function (r) {
      return r.id === id;
    });
    if (i < 0) {
      return;
    }
    lastDeleted = {
      type: "routes",
      item: state.routes[i],
      idx: i
    };
    state.routes.splice(i, 1);
    if (selectedId === id) {
      selectedId = null;
    }
    save();
    renderAll();
    toast("Route deleted.");
  }

  function removeHazard(id) {
    var i = state.hazards.findIndex(function (h) {
      return h.id === id;
    });
    if (i < 0) {
      return;
    }
    lastDeleted = {
      type: "hazards",
      item: state.hazards[i],
      idx: i
    };
    state.hazards.splice(i, 1);
    save();
    renderAll();
    toast("Hazard removed.");
  }
  $("#toastUndo").addEventListener("click", function () {
    if (lastDeleted) {
      state[lastDeleted.type].splice(lastDeleted.idx, 0, lastDeleted.item);
      lastDeleted = null;
      save();
      renderAll();
    }
    $("#toast").classList.remove("on");
  });
  /* ---------- renders ---------- */
  function renderDraft() {
    var a = draftMeta && draft.length > 1 ? analyze(draft) : null;
    if (!draftStops.length) {
      $("#draftInfo").textContent = "Tap the map to choose your starting point.";
    } else if (draftStops.length === 1) {
      $("#draftInfo").textContent = "Start selected. Tap your destination.";
    } else if (routing) {
      $("#draftInfo").textContent = "Finding the drivable roads between your selected points…";
    } else if (draftMeta) {
      var distance = mi(Number(draftMeta.distanceMeters || 0) / 1000);
      var roads = (draftMeta.roads || []).slice(0, 4).join(", ");
      var rerouted = draftMeta.alternativeIndex > 0 ? " · safer alternate selected" : "";
      $("#draftInfo").textContent = "Road route · " + distance + rerouted + (roads ? " · via " +
        roads : "") + ". Add another point to extend the route, or save it.";
    } else {
      $("#draftInfo").textContent = "Choose another point to calculate the road route.";
    }
    $("#draftResult").innerHTML = a ? '<div class="card">' + chip(a) + " " + esc(a.text) +
      "</div>" : "";
    $("#undo").disabled = draftStops.length === 0 || routing;
    $("#clear").disabled = draftStops.length === 0 && !routing;
    $("#saveRoute").disabled = draftStops.length < 2 || routing || !draftMeta;
  }

  function renderHome() {
    var n = state.routes.length;
    var box = $("#homeStatus");
    if (!n) {
      box.innerHTML = '<strong>No routes saved yet.</strong>' + '<p class="muted">' +
        "Choose a start and destination. The app follows mapped roads and checks the route against hazards." +
        "</p>";
    } else {
      var c = {
        danger: 0,
        warn: 0,
        clear: 0
      };
      state.routes.forEach(function (r) {
        var a = analyze(r.pts);
        if (a) {
          c[a.status]++;
        }
      });
      var chips = ["danger", "warn", "clear"].filter(function (k) {
        return c[k];
      }).map(function (k) {
        return ('<span class="chip ' + k + '">' + c[k] + " " + LABEL[k] + "</span>");
      }).join("");
      box.innerHTML = "<strong>" + n + (n === 1 ? " route saved" : " routes saved") +
        "</strong>" + "<p>" + chips + "</p>";
    }
    $("#homeRoutes").hidden = !n;
  }

  function renderRoutes() {
    var box = $("#routeList");
    if (!state.routes.length) {
      box.innerHTML = '<div class="card">' + "<strong>No routes saved yet.</strong>" +
        '<p class="muted">' +
        "Choose a start and destination. The app will follow mapped roads and check the route against known hazards." +
        "</p>" + "</div>";
    } else {
      box.innerHTML = state.routes.map(function (r) {
        var a = analyze(r.pts);
        var roads = Array.isArray(r.roads) && r.roads.length ? " · via " + esc(r.roads.slice(
          0, 3).join(", ")) : "";
        return ('<div class="card route-card' + (r.id === selectedId ? " sel" : "") + '">' +
          "<h3>" + esc(r.name) + "</h3>" + '<p class="muted">' + mi(routeLengthKm(r)) +
          roads + "</p>" + "<p>" + chip(a) + " " + esc(a.text) + "</p>" +
          '<div class="row">' + '<button data-view="' + r.id + '">See on map</button>' +
          '<button class="danger" data-del="' + r.id + '">Delete route</button>' +
          "</div>" + "</div>");
      }).join("");
    }
  }

  function renderMapLists() {
    $("#mapRoutes").innerHTML = state.routes.map(function (r) {
      return ("<li>" + "<span>" + esc(r.name) + (r.id === selectedId ?
          ' <span class="muted">· highlighted</span>' : "") + "</span>" +
        '<button class="danger" data-del="' + r.id + '">Delete</button>' + "</li>");
    }).join("") || '<li class="muted">No saved routes.</li>';
    $("#hazList").innerHTML = state.hazards.concat(liveHazards).map(function (h) {
      if (h.live) {
        return ("<li>" + "<span>" + esc(h.name) + ' <span class="muted">' +
          "· live NIFC/WFIGS · radius " + mi(h.r) + "</span>" + "</span>" +
          '<span class="muted">Live</span>' + "</li>");
      }
      return ("<li>" + "<span>" + esc(h.name) + ' <span class="muted">' + "· radius " + mi(h
          .r) + "</span>" + "</span>" + '<button class="danger" data-hdel="' + h.id +
        '">Remove</button>' + "</li>");
    }).join("") || '<li class="muted">No hazards on the map.</li>';
  }

  function reminderState() {
    var interval = state.settings.every;
    if (interval === "never" || !state.routes.length) {
      return null;
    }
    var last = state.settings.last ? new Date(state.settings.last) : null;
    var next = last ? new Date(last) : new Date();
    if (last) {
      if (interval === "daily") {
        next.setDate(next.getDate() + 1);
      } else if (interval === "weekly") {
        next.setDate(next.getDate() + 7);
      } else {
        var day = next.getDate();
        next.setDate(1);
        next.setMonth(next.getMonth() + 1);
        var lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(day, lastDayOfMonth));
      }
    }
    return {
      due: next <= new Date(),
      next: next,
      last: last
    };
  }

  function renderBanners() {
    var rs = reminderState();
    var html = rs && rs.due ? '<div class="banner" role="alert">' +
      "<strong>Time to re-check your routes.</strong> " +
      "Look at each status, then tap the button." + '<div class="row" style="margin-top:8px">' +
      '<button class="primary" data-done="1">' + "I re-checked my routes" + "</button>" +
      "</div>" + "</div>" : "";
    document.querySelectorAll(".dueBanner").forEach(function (el) {
      el.innerHTML = html;
    });
  }

  function renderAlerts() {
    $("#every").value = String(state.settings.every);
    var opts = [
      1.609,
      3.219,
      8.047
    ];
    var best = opts.reduce(function (p, c) {
      return (Math.abs(c - state.settings.buffer) < Math.abs(p - state.settings.buffer)) ? c :
        p;
    });
    $("#buffer").value = String(best);
    var rs = reminderState();
    var t;
    if (state.settings.every === "never") {
      t = "Reminders are off.";
    } else if (!state.routes.length) {
      t = "Save a route to start the reminder.";
    } else {
      t = (rs.due ? "Your routes are due for a re-check now." : "Next reminder: " + rs.next
        .toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric"
        }) + ".") + (rs.last ? " Last re-checked " + rs.last.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric"
      }) + "." : "");
    }
    $("#remStatus").textContent = t;
    var nb = $("#askNotif");
    if (!("Notification" in window)) {
      nb.hidden = true;
    } else if (Notification.permission === "granted") {
      nb.textContent = "Notifications allowed";
      nb.disabled = true;
    } else if (Notification.permission === "denied") {
      nb.textContent = "Notifications blocked in browser";
      nb.disabled = true;
    }
  }

  function checkReminder() {
    var rs = reminderState();
    var due = Boolean(rs && rs.due);
    renderBanners();
    renderAlerts();
    if (due && !reminderWasDue && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("Re-check your escape routes", {
          body: "Open Escape Route Check to see if any route is near a hazard."
        });
      } catch (error) {
        console.error("Could not show the route reminder notification.", error);
      }
    }
    reminderWasDue = due;
  }

  function renderAll() {
    renderHome();
    renderRoutes();
    renderMapLists();
    renderDraft();
    renderBanners();
    renderAlerts();
    draw();
  }
  /* ---------- events ---------- */
  function markReviewed() {
    state.settings.last = new Date().toISOString();
    reminderWasDue = false;
    save();
    renderAll();
  }
  $("#markReviewed").addEventListener("click", markReviewed);
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-done]")) {
      markReviewed();
    }
    var v = e.target.closest("[data-view]");
    var d = e.target.closest("[data-del]");
    var h = e.target.closest("[data-hdel]");
    if (v) {
      selectedId = v.getAttribute("data-view");
      resetDraft();
      var rt = state.routes.filter(function (r) {
        return r.id === selectedId;
      })[0];
      if (rt) {
        fitTo(rt.pts);
      }
      renderAll();
      showTab("map");
    }
    if (d) {
      removeRoute(d.getAttribute("data-del"));
    }
    if (h) {
      removeHazard(h.getAttribute("data-hdel"));
    }
  });
  $("#every").addEventListener("change", function () {
    state.settings.every = this.value;
    if (!state.settings.last && state.routes.length) {
      state.settings.last = new Date().toISOString();
    }
    save();
    checkReminder();
    renderAll();
  });
  $("#buffer").addEventListener("change", function () {
    state.settings.buffer = +this.value;
    save();
    renderAll();
  });
  $("#askNotif").addEventListener("click", function () {
    if (!("Notification" in window)) {
      return;
    }
    Notification.requestPermission().then(renderAlerts).catch(function (error) {
      console.error("Could not request notification permission.", error);
    });
  });
  $("#refreshFires").addEventListener("click", loadLiveFires);
  var triedLoc = false;

  function startDrawing() {
    setMode("route");
    showTab("map");
    if (!triedLoc && !me) {
      triedLoc = true;
      locate(false);
    }
  }
  $("#homeDraw").addEventListener("click", startDrawing);
  $("#routesDraw").addEventListener("click", startDrawing);
  $("#homeRoutes").addEventListener("click", function () {
    showTab("routes");
  });
  var wipeArm = false;
  $("#wipe").addEventListener("click", function () {
    var b = this;
    if (wipeArm) {
      state = fresh();
      resetDraft();
      selectedId = null;
      save();
      wipeArm = false;
      b.textContent = "Erase all routes and hazards";
      renderAll();
    } else {
      wipeArm = true;
      b.textContent = "Tap again to erase everything";
      setTimeout(function () {
        wipeArm = false;
        b.textContent = "Erase all routes and hazards";
      }, 3000);
    }
  });
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  }
  /* ---------- tabs ---------- */
  function showTab(name) {
    ["home", "routes", "map", "alerts"].forEach(function (n) {
      $("#s-" + n).classList.toggle("on", n === name);
    });
    document.querySelectorAll("nav.tabs button").forEach(function (b) {
      if (b.getAttribute("data-tab") === name) {
        b.setAttribute("aria-current", "page");
      } else {
        b.removeAttribute("aria-current");
      }
    });
    window.scrollTo(0, 0);
    if (name === "map") {
      initRoadMap();
      if (maplibre) {
        setTimeout(function () {
          maplibre.resize();
          draw();
        }, 0);
      } else {
        draw();
      }
    }
  }
  document.querySelectorAll("nav.tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      showTab(b.getAttribute("data-tab"));
    });
  });
  /* ---------- start ---------- */
  renderAll();
  loadLiveFires();
  checkReminder();
  setInterval(checkReminder, 60000);
  window.addEventListener("focus", checkReminder);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      checkReminder();
    }
  });
})();