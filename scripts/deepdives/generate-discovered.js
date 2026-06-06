import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const CANDIDATE_PATH = join(ROOT, "deepdives-drafts", "candidate-wars-1914-2026.json");
const DRAFT_DIR = join(ROOT, "deepdives-drafts");
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || true];
  })
);

const limit = Number(args.limit || 12);
const eventLimit = Number(args["event-limit"] || 10);
const includeExisting = Boolean(args["include-existing"]);
const only = args.only
  ? new Set(String(args.only).split(",").map((value) => value.trim()).filter(Boolean))
  : null;

const protectedIds = new Set([
  "wwii-events",
  "world-war-ii",
  "wwi-events",
  "world-war-i",
  "russian-civil-war",
  "spanish-civil-war",
  "winter-war",
  "continuation-war",
  "israel-wars",
]);

const protectedTitles = new Set([
  "World War I",
  "World War II",
  "Russian Civil War",
  "Spanish Civil War",
  "Winter War",
  "Continuation War",
]);

if (!existsSync(CANDIDATE_PATH)) {
  throw new Error(`Missing ${CANDIDATE_PATH}. Run npm run deepdives:discover first.`);
}

const candidates = JSON.parse(await readFile(CANDIDATE_PATH, "utf8"));
const selected = candidates
  .filter((war) => war.found !== false)
  .filter((war) => Array.isArray(war.targetScope) && war.targetScope.length > 0)
  .filter((war) => war.qid && !String(war.qid).startsWith("missing:"))
  .filter((war) => !only || only.has(war.id) || only.has(war.qid) || only.has(war.title))
  .filter((war) => includeExisting || !existsSync(join(DRAFT_DIR, `${war.id}.json`)))
  .filter((war) => includeExisting || !existsSync(join(DRAFT_DIR, `${war.id}.generated.json`)))
  .filter((war) => !protectedIds.has(war.id))
  .filter((war) => !protectedTitles.has(war.title))
  .slice(0, limit);

if (!selected.length) {
  console.log("No candidates selected for generation.");
  process.exit(0);
}

console.log(`Generating ${selected.length} draft deep dives...`);

for (const war of selected) {
  console.log(`\n=== ${war.title} (${war.qid}) ===`);
  await runNode([
    "scripts/deepdives/generate-deepdive.js",
    `--qid=${war.qid}`,
    `--title=${war.title}`,
    `--id=${war.id}`,
    `--event-limit=${eventLimit}`,
  ]);
}

console.log("\nDone. Review generated *.generated.json files before uploading to S3.");

function runNode(nodeArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, nodeArgs, {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${nodeArgs.join(" ")} exited with ${code}`));
    });
  });
}

