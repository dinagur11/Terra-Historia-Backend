import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runSparql, searchWikidata, slugify, wait } from "./wikimedia.js";

const ROOT = process.cwd();
const DRAFT_DIR = join(ROOT, "deepdives-drafts");
const OUTPUT_PATH = join(DRAFT_DIR, "candidate-wars-1914-2026.json");

const START_YEAR = Number(process.env.DEEPDIVE_START_YEAR || 1914);
const END_YEAR = Number(process.env.DEEPDIVE_END_YEAR || 2026);
const MIN_SITELINKS = Number(process.env.DEEPDIVE_MIN_SITELINKS || 8);
const PER_TARGET_LIMIT = Number(process.env.DEEPDIVE_PER_TARGET_LIMIT || 80);

const TARGET_ENTITIES = [
  { qid: "Q30", title: "United States" },
  { qid: "Q801", title: "Israel" },
  { qid: "Q145", title: "United Kingdom" },
  { qid: "Q142", title: "France" },
  { qid: "Q183", title: "Germany" },
  { qid: "Q36", title: "Poland" },
  { qid: "Q159", title: "Russia" },
  { qid: "Q212", title: "Ukraine" },
  { qid: "Q38", title: "Italy" },
  { qid: "Q29", title: "Spain" },
  { qid: "Q33", title: "Finland" },
  { qid: "Q34", title: "Sweden" },
  { qid: "Q35", title: "Denmark" },
  { qid: "Q20", title: "Norway" },
  { qid: "Q41", title: "Greece" },
  { qid: "Q43", title: "Turkey" },
  { qid: "Q28", title: "Hungary" },
  { qid: "Q218", title: "Romania" },
  { qid: "Q219", title: "Bulgaria" },
  { qid: "Q40", title: "Austria" },
  { qid: "Q55", title: "Netherlands" },
  { qid: "Q31", title: "Belgium" },
  { qid: "Q224", title: "Croatia" },
  { qid: "Q225", title: "Bosnia and Herzegovina" },
  { qid: "Q236", title: "Montenegro" },
  { qid: "Q214", title: "Slovakia" },
  { qid: "Q213", title: "Czech Republic" },
  { qid: "Q37", title: "Lithuania" },
  { qid: "Q211", title: "Latvia" },
  { qid: "Q191", title: "Estonia" },
  { qid: "Q45", title: "Portugal" },
  { qid: "Q27", title: "Ireland" },
];

const MANUAL_SCOPE_BY_TITLE = new Map([
  ["World War I", ["United States", "United Kingdom", "France", "Germany", "Italy", "Russia"]],
  ["World War II", ["United States", "United Kingdom", "France", "Germany", "Italy", "Poland", "Russia"]],
  ["Russian Civil War", ["Russia", "United States", "United Kingdom", "France"]],
  ["Irish War of Independence", ["Ireland", "United Kingdom"]],
  ["Spanish Civil War", ["Spain"]],
  ["Winter War", ["Finland", "Russia"]],
  ["Continuation War", ["Finland", "Russia", "Germany"]],
  ["Greek Civil War", ["Greece", "United Kingdom", "United States"]],
  ["1948 Palestine war", ["Israel"]],
  ["Suez Crisis", ["Israel", "United Kingdom", "France"]],
  ["Six-Day War", ["Israel"]],
  ["War of Attrition", ["Israel"]],
  ["Yom Kippur War", ["Israel"]],
  ["1982 Lebanon War", ["Israel"]],
  ["South Lebanon conflict", ["Israel"]],
  ["First Intifada", ["Israel"]],
  ["Second Intifada", ["Israel"]],
  ["2006 Lebanon War", ["Israel"]],
  ["Gaza War (2008-2009)", ["Israel"]],
  ["2014 Gaza War", ["Israel"]],
  ["Israel-Hamas war", ["Israel"]],
  ["Korean War", ["United States", "United Kingdom", "France", "Greece", "Turkey", "Belgium", "Netherlands"]],
  ["Vietnam War", ["United States"]],
  ["Gulf War", ["United States", "United Kingdom", "France"]],
  ["Yugoslav Wars", ["Croatia", "Bosnia and Herzegovina", "Slovenia", "Serbia", "Montenegro"]],
  ["Bosnian War", ["Bosnia and Herzegovina", "Croatia"]],
  ["Kosovo War", ["United States", "United Kingdom", "France", "Germany", "Italy"]],
  ["War in Afghanistan (2001-2021)", ["United States", "United Kingdom", "Germany", "France", "Italy"]],
  ["Iraq War", ["United States", "United Kingdom", "Poland"]],
  ["Russo-Ukrainian War", ["Russia", "Ukraine"]],
  ["War in Donbas", ["Russia", "Ukraine"]],
  ["Russian invasion of Ukraine", ["Russia", "Ukraine"]],
]);
const MUST_INCLUDE = [
  "World War I",
  "Russian Civil War",
  "Irish War of Independence",
  "Finnish Civil War",
  "Spanish Civil War",
  "Winter War",
  "Continuation War",
  "World War II",
  "Greek Civil War",
  "1948 Palestine war",
  "Suez Crisis",
  "Six-Day War",
  "War of Attrition",
  "Yom Kippur War",
  "1982 Lebanon War",
  "South Lebanon conflict",
  "First Intifada",
  "Second Intifada",
  "2006 Lebanon War",
  "Gaza War (2008-2009)",
  "2014 Gaza War",
  "Israel-Hamas war",
  "Korean War",
  "Vietnam War",
  "Gulf War",
  "Yugoslav Wars",
  "Bosnian War",
  "Kosovo War",
  "War in Afghanistan (2001-2021)",
  "Iraq War",
  "Russo-Ukrainian War",
  "War in Donbas",
  "Russian invasion of Ukraine",
];

await mkdir(DRAFT_DIR, { recursive: true });

const NOISY_TITLE_PATTERN = /^(battle|operation|bombing|evacuation|campaign|offensive|siege|raid|invasion of|attack on|liberation of)\b|\b(battle|offensive|campaign|airstrike|airstrikes|missile strike|missile strikes|drone incursion|railway station attack|border protests|trade war|naming dispute|milk war|lobster war|cod wars|whisky war|greenland crisis)\b/i;

function isUsefulWarCandidate(war) {
  if (war.found === false) return true;
  if (!war.title || NOISY_TITLE_PATTERN.test(war.title)) return false;
  if (war.startYear && (war.startYear < START_YEAR || war.startYear > END_YEAR)) return false;
  return Array.isArray(war.targetScope) && war.targetScope.length > 0;
}
const byQid = new Map();

function qidFromUrl(url) {
  return String(url || "").split("/").pop();
}

function yearFromDate(value) {
  const match = String(value || "").match(/^-?\d{1,6}/);
  return match ? Number(match[0]) : null;
}

function targetQuery(targetQid) {
  return `
SELECT DISTINCT ?war ?warLabel ?description ?start ?end ?article ?image ?sitelinks WHERE {
  ?war wdt:P31/wdt:P279* wd:Q198.
  ?war wikibase:sitelinks ?sitelinks.
  ?war wdt:P710|wdt:P1923 wd:${targetQid}.

  OPTIONAL { ?war wdt:P580 ?start. }
  OPTIONAL { ?war wdt:P585 ?start. }
  OPTIONAL { ?war wdt:P582 ?end. }
  OPTIONAL { ?war wdt:P18 ?image. }
  OPTIONAL {
    ?article schema:about ?war;
      schema:isPartOf <https://en.wikipedia.org/>.
  }
  OPTIONAL { ?war schema:description ?description FILTER(LANG(?description) = "en") }

  BIND(YEAR(COALESCE(?start, ?end)) AS ?startYear)
  BIND(YEAR(COALESCE(?end, ?start)) AS ?endYear)
  FILTER(?startYear >= ${START_YEAR} && ?startYear <= ${END_YEAR})
  FILTER(?sitelinks >= ${MIN_SITELINKS})

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks) ?warLabel
LIMIT ${PER_TARGET_LIMIT}
`;
}

function mergeCandidate(candidate) {
  if (!candidate.qid) return;
  const existing = byQid.get(candidate.qid);
  if (!existing) {
    byQid.set(candidate.qid, candidate);
    return;
  }

  byQid.set(candidate.qid, {
    ...existing,
    ...Object.fromEntries(
      Object.entries(candidate).filter(([, value]) => value !== "" && value != null)
    ),
    targetScope: [...new Set([...(existing.targetScope || []), ...(candidate.targetScope || [])])].sort(),
    foundBy: [...new Set([...(existing.foundBy || []), ...(candidate.foundBy || [])])],
    sitelinks: Math.max(Number(existing.sitelinks || 0), Number(candidate.sitelinks || 0)),
  });
}

function normalizeRow(row, targetTitle) {
  const qid = qidFromUrl(row.war);
  const startYear = yearFromDate(row.start);
  const endYear = yearFromDate(row.end) || startYear;

  return {
    qid,
    id: slugify(row.warLabel),
    title: row.warLabel,
    wikidataLabel: row.warLabel,
    description: row.description || "",
    start: row.start || "",
    end: row.end || "",
    startYear,
    endYear,
    targetScope: [targetTitle],
    article: row.article || "",
    image: row.image || "",
    sitelinks: Number(row.sitelinks || 0),
    found: true,
    foundBy: ["participant-query"],
  };
}

console.log("Discovering conflicts from Wikidata one target at a time...");
for (const target of TARGET_ENTITIES) {
  await wait(350);
  try {
    const rows = await runSparql(targetQuery(target.qid));
    for (const row of rows) mergeCandidate(normalizeRow(row, target.title));
    console.log(`${target.title}: ${rows.length}`);
  } catch (err) {
    console.warn(`${target.title}: skipped after query error: ${err.message}`);
  }
}

console.log("Enriching must-include conflicts...");
for (const title of MUST_INCLUDE) {
  await wait(300);
  const result = await searchWikidata(title);
  if (!result?.id) {
    mergeCandidate({
      qid: `missing:${slugify(title)}`,
      id: slugify(title),
      title,
      wikidataLabel: "",
      description: "",
      found: false,
      targetScope: MANUAL_SCOPE_BY_TITLE.get(title) || [],
      foundBy: ["must-include"],
    });
    continue;
  }

  mergeCandidate({
    qid: result.id,
    id: slugify(title),
    title,
    wikidataLabel: result.label || title,
    description: result.description || "",
    found: true,
    targetScope: MANUAL_SCOPE_BY_TITLE.get(title) || [],
    sitelinks: 0,
    foundBy: ["must-include"],
  });
}

const wars = [...byQid.values()].filter(isUsefulWarCandidate).sort((a, b) => {
  const yearA = a.startYear ?? 9999;
  const yearB = b.startYear ?? 9999;
  if (yearA !== yearB) return yearA - yearB;
  return String(a.title).localeCompare(String(b.title));
});

await writeFile(OUTPUT_PATH, `${JSON.stringify(wars, null, 2)}\n`, "utf8");

console.log(`Wrote ${wars.length} candidate wars to ${OUTPUT_PATH}`);
console.log(wars.map((war) => `${war.qid || "????"} ${war.startYear || "????"} ${war.title}`).join("\n"));



