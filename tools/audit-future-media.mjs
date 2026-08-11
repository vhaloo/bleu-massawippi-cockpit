import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyPlanOverridesToPosts } from "../cockpit/plan-overrides.js";

const START = process.argv.find((arg) => arg.startsWith("--start="))?.slice(8) || "2026-08-12";
const END = process.argv.find((arg) => arg.startsWith("--end="))?.slice(6) || "2026-09-15";
const VERBOSE = process.argv.includes("--verbose");
const MISSING_DETAILS = process.argv.includes("--missing-details");
const PROJECT_ID = "bleu-massawippi-cockpit-5d860";
const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config", "configstore", "firebase-tools.json"), "utf8"));
if (!config.tokens?.access_token || Number(config.tokens.expires_at || 0) < Date.now() + 120_000) {
  throw new Error("Session Firebase CLI expirée; renouveler avec `npx firebase-tools projects:list --json`.");
}

const root = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const postsJson = html.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];
if (!postsJson) throw new Error("Calendrier source illisible.");
const posts = applyPlanOverridesToPosts(JSON.parse(postsJson))
  .filter((post) => post.archivedEditorial !== true && post.dateIso >= START && post.dateIso <= END);
const manifests = ["historical_media_manifest.json", "nature_media_manifest.json", "editorial_media_manifest.json"]
  .flatMap((file) => JSON.parse(fs.readFileSync(path.join(root, "cockpit", file), "utf8")))
  .filter((media) => media.archived !== true && !["archived", "reference"].includes(media.stage));
const localByEvent = Object.groupBy(manifests, (media) => media.eventId);
const localReadyByEvent = Object.groupBy(manifests.filter((media) => media.publicationBlocked !== true), (media) => media.eventId);

function decode(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  return null;
}

const production = [];
for (let offset = 0; offset < posts.length; offset += 10) {
  const batch = posts.slice(offset, offset + 10).map((post) => ({ stringValue: post.id }));
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.tokens.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "mediaLinks" }],
      where: { fieldFilter: { field: { fieldPath: "eventId" }, op: "IN", value: { arrayValue: { values: batch } } } },
      limit: 200
    } })
  });
  if (!response.ok) throw new Error(`Lecture Firestore refusée (${response.status}).`);
  const rows = await response.json();
  production.push(...rows.map((row) => row.document).filter(Boolean).map((document) => ({
    id: document.name.split("/").at(-1),
    eventId: decode(document.fields?.eventId),
    archived: decode(document.fields?.archived) === true,
    publicationBlocked: decode(document.fields?.publicationBlocked) === true,
    stage: decode(document.fields?.stage),
    previewUrl: decode(document.fields?.previewUrl),
    url: decode(document.fields?.url),
    label: decode(document.fields?.label),
    urlPresent: Boolean(decode(document.fields?.url))
  })));
}
const productionPresent = production.filter((media) => !media.archived && !["archived", "reference"].includes(media.stage));
const productionByEvent = Object.groupBy(productionPresent, (media) => media.eventId);
const productionReadyByEvent = Object.groupBy(productionPresent.filter((media) => !media.publicationBlocked), (media) => media.eventId);
const rows = posts.map((post) => ({
  date: post.dateIso,
  eventId: post.id,
  title: post.title,
  localMedia: (localByEvent[post.id] || []).map((media) => media.id),
  localReadyMedia: (localReadyByEvent[post.id] || []).map((media) => media.id),
  productionMedia: (productionByEvent[post.id] || []).map((media) => media.id),
  productionReadyMedia: (productionReadyByEvent[post.id] || []).map((media) => media.id),
  productionPreviewCount: (productionByEvent[post.id] || []).filter((media) => media.previewUrl).length,
  localCovered: Boolean(localByEvent[post.id]?.length),
  localPublishReady: Boolean(localReadyByEvent[post.id]?.length),
  productionCovered: Boolean(productionByEvent[post.id]?.length),
  productionPublishReady: Boolean(productionReadyByEvent[post.id]?.length)
}));

if (VERBOSE) {
  for (const row of rows) {
    row.productionDetails = (productionByEvent[row.eventId] || []).map((media) => ({
      id: media.id,
      label: media.label,
      url: media.url,
      previewUrl: media.previewUrl
    }));
  }
}

const report = {
  start: START,
  end: END,
  posts: posts.length,
  matchingProductionReads: production.length,
  localMissing: rows.filter((row) => !row.localCovered),
  productionMissing: rows.filter((row) => !row.productionCovered),
  localWithoutPublishReadyMedia: rows.filter((row) => row.localCovered && !row.localPublishReady),
  productionWithoutPublishReadyMedia: rows.filter((row) => row.productionCovered && !row.productionPublishReady),
  productionWithoutDedicatedPreview: rows.filter((row) => row.productionCovered && row.productionPreviewCount === 0)
};
if (VERBOSE) report.rows = rows;
if (MISSING_DETAILS) {
  report.missingPreviewDetails = rows
    .filter((row) => row.productionCovered && row.productionPreviewCount === 0)
    .map((row) => ({ date: row.date, eventId: row.eventId, title: row.title, productionDetails: row.productionDetails || (productionByEvent[row.eventId] || []).map((media) => ({
      id: media.id,
      label: media.label,
      url: media.url,
      previewUrl: media.previewUrl
    })) }));
}
console.log(JSON.stringify(report, null, 2));
