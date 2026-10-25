const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
const UPSTREAM_TIMEOUT_MS = 8000;

function json(body, init = {}) {
  const headers = new Headers(init.headers);

  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function parsePoints(points) {
  if (!Array.isArray(points)) {
    return null;
  }

  if (points.length < 2 || points.length > 10) {
    return null;
  }

  const parsed = points.map((point) => {
    if (!Array.isArray(point) || point.length !== 2) {
      return null;
    }

    const lat = Number(point[0]);
    const lon = Number(point[1]);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      return null;
    }

    return [lat, lon];
  });

  if (parsed.some((point) => point === null)) {
    return null;
  }

  return parsed;
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      { error: "Invalid JSON request." },
      { status: 400 },
    );
  }

  const points = parsePoints(body.points);

  if (!points) {
    return json(
      {
        error:
          "Provide between 2 and 10 route points as [latitude, longitude].",
      },
      { status: 400 },
    );
  }

  // OSRM expects longitude,latitude
  const coordinates = points
    .map(([lat, lon]) => `${lon},${lat}`)
    .join(";");

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    UPSTREAM_TIMEOUT_MS,
  );

  try {
    const url =
      `${OSRM_BASE}/${coordinates}` +
      "?overview=full" +
      "&geometries=geojson" +
      "&steps=true" +
      "&alternatives=true";

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Escape-Route-Check/1.0 (https://escape-checker.vercel.app)",
      },
    });

    if (!response.ok) {
      return json(
        { error: "The road routing service is unavailable." },
        { status: 502 },
      );
    }

    const payload = await response.json();

    if (
      payload.code !== "Ok" ||
      !Array.isArray(payload.routes) ||
      !payload.routes.length
    ) {
      return json(
        { error: "No drivable road route was found." },
        { status: 404 },
      );
    }

    const routes = payload.routes.map((route) => {
      const roadNames = [];

      for (const leg of route.legs || []) {
        for (const step of leg.steps || []) {
          const name = step.name && step.name.trim();

          if (name && !roadNames.includes(name)) {
            roadNames.push(name);
          }
        }
      }

      return {
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        geometry: route.geometry,
        roads: roadNames.slice(0, 12),
      };
    });

    return json({
      provider: "OSRM / OpenStreetMap",
      ...routes[0],
      alternatives: routes.slice(1),
    });
  } catch (error) {
    console.error("Road routing failed", error);

    if (error?.name === "AbortError") {
      return json(
        { error: "Road routing timed out." },
        { status: 504 },
      );
    }

    return json(
      { error: "Unable to reach the road routing service." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}