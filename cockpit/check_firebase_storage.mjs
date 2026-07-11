import process from "node:process";
import { GoogleAuth } from "google-auth-library";

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) {
  console.error("GOOGLE_CLOUD_PROJECT est requis.");
  process.exit(2);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
  process.exit(2);
}

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
const token = (await client.getAccessToken()).token;
const headers = { Authorization: `Bearer ${token}` };

async function readJson(url) {
  const response = await fetch(url, { headers });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 1000) }; }
  return { status: response.status, ok: response.ok, body };
}

function safeError(response) {
  return String(response.body.error?.message || "indisponible")
    .replace(/\s*Help Token:\s*[^\s]+/gi, "")
    .trim();
}

const billing = await readJson(`https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`);
const service = await readJson(`https://serviceusage.googleapis.com/v1/projects/${projectId}/services/firebasestorage.googleapis.com`);
const bucket = await readJson(`https://firebasestorage.googleapis.com/v1alpha/projects/${projectId}/defaultBucket`);
const result = {
  projectId,
  billing: billing.ok
    ? { enabled: billing.body.billingEnabled === true, account: billing.body.billingAccountName || null }
    : { enabled: null, status: billing.status, error: safeError(billing) },
  storageApi: service.ok
    ? { state: service.body.state || null }
    : { state: null, status: service.status, error: safeError(service) },
  defaultBucket: bucket.ok
    ? { name: bucket.body.name || bucket.body.bucket || null, location: bucket.body.location || null }
    : { name: null, status: bucket.status, error: safeError(bucket) }
};
console.log(JSON.stringify(result, null, 2));
