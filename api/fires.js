const INCIDENTS_URL =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query";

const UPSTREAM_TIMEOUT_MS = 8_000;

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      resultRecordCount: "1000",
      f: "json",
    });

    const response = await fetch(`${INCIDENTS_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return json(
        { error: "The live fire data source is unavailable." },
        { status: 502 },
      );
    }

    const payload = await response.json();

    if (payload?.error) {
      return json(
        { error: "The live fire data source returned an error." },
        { status: 502 },
      );
    }

    return json({
      source: "NIFC/WFIGS",
      fetchedAt: new Date().toISOString(),
      features: Array.isArray(payload?.features) ? payload.features : [],
    });
  } catch (error) {
    console.error("Failed to fetch live fire data", error);
    return json(
      { error: "Unable to reach the live fire data source." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
