import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getWikipediaSummary,
  parsePoint,
  qidFromEntityUrl,
  runSparql,
  searchWikidata,
  slugify,
  toDate,
  toYear,
  wait,
} from "./wikimedia.js";

const ROOT = process.cwd();
const DRAFT_DIR = join(ROOT, "deepdives-drafts");
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || true];
  })
);
const EVENT_LIMIT = Number(args["event-limit"] || 10);

const input = args.qid || args.title;
if (!input) {
  throw new Error("Usage: npm run deepdives:generate -- --qid=Q361 or --title=\"World War I\"");
}

const found = args.qid
  ? { id: args.qid, label: String(args.title || args.qid) }
  : await searchWikidata(String(args.title));

if (!found?.id) {
  throw new Error(`Could not find Wikidata entity for ${input}`);
}

const qid = found.id;
const title = String(args.title || found.label || qid);
const outputId = slugify(String(args.id || title));

if (outputId === "wwii-events" || qid === "Q362") {
  throw new Error("Refusing to generate or overwrite the protected World War II deep dive.");
}

const query = `
SELECT DISTINCT ?event ?eventLabel ?date ?coord ?article ?image ?sitelinks WHERE {
  VALUES ?parent { wd:${qid} }
  ?event wdt:P361|wdt:P1344 ?parent.
  ?event wdt:P580|wdt:P585 ?date.
  ?event wikibase:sitelinks ?sitelinks.
  OPTIONAL { ?event wdt:P625 ?coord. }
  OPTIONAL { ?event wdt:P18 ?image. }
  OPTIONAL {
    ?article schema:about ?event;
      schema:isPartOf <https://en.wikipedia.org/>.
  }
  FILTER(?event != ?parent)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT ${Math.max(EVENT_LIMIT * 3, 20)}
`;

await mkdir(DRAFT_DIR, { recursive: true });
const rows = await runSparql(query);
const seen = new Set();
const candidates = [];

for (const row of rows) {
  const eventQid = qidFromEntityUrl(row.event);
  const year = toYear(row.date);
  if (!eventQid || seen.has(eventQid) || !year || year < 1914) continue;
  seen.add(eventQid);
  candidates.push(row);
  if (candidates.length >= EVENT_LIMIT) break;
}

const events = [];
for (const row of candidates.sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
  const eventQid = qidFromEntityUrl(row.event);
  const point = parsePoint(row.coord);
  const year = toYear(row.date);

  let summary = {
    extract: "",
    pageUrl: row.article || "",
    image: row.image || "",
  };

  if (row.article) {
    await wait(1500);
    try {
      summary = await getWikipediaSummary(row.article);
    } catch (err) {
      console.warn(`Could not load summary for ${row.eventLabel}: ${err.message}`);
    }
  }

  const eventTitle = row.eventLabel;
  const body = summary.extract || `Draft note for ${eventTitle}. Review and expand this slide before uploading.`;

  events.push({
    id: slugify(eventTitle),
    year,
    date: toDate(row.date),
    title: eventTitle,
    sub: `Part of ${title}`,
    view: {
      center: point ? [point.lat, point.lng] : [50, 15],
      zoom: point ? 5 : 3,
    },
    markers: point
      ? [
          {
            label: eventTitle,
            latlng: [point.lat, point.lng],
            type: "major",
          },
        ]
      : [],
    regions: [],
    slides: [
      {
        title: eventTitle,
        img: summary.image || row.image || "",
        cap: summary.pageUrl ? `Source: ${summary.pageUrl}` : "",
        body,
      },
      {
        title: "Why It Matters",
        body: "Generated draft. Use this slide to explain causes, consequences, and how this event moved the conflict forward.",
        stats: [
          { val: String(year), lbl: "Year" },
          { val: eventQid, lbl: "Wikidata" },
          ...(summary.pageUrl ? [{ val: "Wikipedia", lbl: summary.pageUrl, full: true }] : []),
        ],
      },
    ],
  });
}

if (!events.length) {
  let summary = {
    extract: `Generated draft for ${title}. Review and expand this conflict before uploading.`,
    pageUrl: "",
    image: "",
  };

  await wait(1000);
  try {
    summary = await getWikipediaSummary(title);
  } catch (err) {
    console.warn(`Could not load summary for ${title}: ${err.message}`);
  }

  events.push({
    id: outputId,
    year: toYear(summary.extract) || 1914,
    date: "Review date",
    title,
    sub: "Generated overview draft",
    view: {
      center: [50, 15],
      zoom: 3,
    },
    markers: [],
    regions: [],
    slides: [
      {
        title,
        img: summary.image || "",
        cap: summary.pageUrl ? `Source: ${summary.pageUrl}` : "",
        body: summary.extract || `Generated draft for ${title}. Review and expand this conflict before uploading.`,
      },
      {
        title: "Why It Matters",
        body: "Generated draft. Add causes, turning points, consequences, and links to the wider Terra Historia timeline.",
        stats: [
          { val: qid, lbl: "Wikidata" },
          ...(summary.pageUrl ? [{ val: "Wikipedia", lbl: summary.pageUrl, full: true }] : []),
        ],
      },
    ],
  });
}
const outputPath = join(DRAFT_DIR, `${outputId}.generated.json`);
await writeFile(outputPath, `${JSON.stringify(events, null, 2)}\n`, "utf8");

console.log(`Wrote ${events.length} draft events to ${outputPath}`);
console.log("Review this file before uploading it to S3.");



