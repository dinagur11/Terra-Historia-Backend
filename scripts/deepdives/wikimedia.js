const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_API_URL = "https://en.wikipedia.org/api/rest_v1/page/summary";
const USER_AGENT = "Terra-Historia/1.0 (deep dive draft generator)";

export async function fetchJson(url, options = {}) {
  let lastError;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          "Api-User-Agent": USER_AGENT,
          "User-Agent": USER_AGENT,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        const retryAfter = Number(response.headers.get("retry-after") || 0);
        const error = new Error(`Request failed ${response.status}: ${body.slice(0, 240)}`);
        error.status = response.status;
        error.retryAfter = retryAfter;
        throw error;
      }

      return response.json();
    } catch (err) {
      lastError = err;
      if (attempt < 4) {
        const baseDelay = err.status === 429 ? 4000 : 1000;
        const retryDelay = err.retryAfter ? err.retryAfter * 1000 : baseDelay * attempt;
        await wait(retryDelay);
      }
    }
  }

  throw lastError;
}

export async function runSparql(query) {
  const params = new URLSearchParams({ format: "json", query });
  const data = await fetchJson(WIKIDATA_SPARQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  return data.results.bindings.map(flattenBinding);
}

export async function searchWikidata(search) {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    search,
    language: "en",
    format: "json",
    limit: "1",
  });
  const data = await fetchJson(`${WIKIDATA_API_URL}?${params}`);
  return data.search?.[0] || null;
}

export async function getWikipediaSummary(titleOrUrl) {
  const title = titleOrUrl.includes("/wiki/")
    ? decodeURIComponent(titleOrUrl.split("/wiki/").pop())
    : titleOrUrl;
  const data = await fetchJson(`${WIKIPEDIA_API_URL}/${encodeURIComponent(title)}`);

  return {
    title: data.title,
    extract: data.extract || "",
    pageUrl: data.content_urls?.desktop?.page || "",
    image: data.originalimage?.source || data.thumbnail?.source || "",
  };
}

export function qidFromEntityUrl(entityUrl) {
  return entityUrl?.split("/").pop() || "";
}

export function toYear(value) {
  const match = String(value || "").match(/^-?\d{1,6}/);
  return match ? Number(match[0]) : null;
}

export function toDate(value) {
  const text = String(value || "");
  const match = text.match(/^-?\d{1,6}-\d{2}-\d{2}/);
  return match ? match[0] : text.slice(0, 10);
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parsePoint(value) {
  const match = String(value || "").match(/Point\(([-.\d]+) ([-.\d]+)\)/);
  if (!match) return null;
  const lng = Number(match[1]);
  const lat = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flattenBinding(binding) {
  return Object.fromEntries(
    Object.entries(binding).map(([key, wrapped]) => [key, wrapped.value])
  );
}
