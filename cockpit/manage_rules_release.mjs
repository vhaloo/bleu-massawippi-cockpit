/** Controlled rule release via an existing Firebase CLI login; never prints tokens. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const value = name => process.argv.find(arg => arg.startsWith(name + "="))?.slice(name.length + 1);
const project = "bleu-massawippi-cockpit-5d860";
const cliHome = value("--cli-home");
const backupRoot = value("--backup-dir");
if (!cliHome || !backupRoot) throw new Error("--cli-home et --backup-dir sont obligatoires.");
const cliPackage = JSON.parse(await fs.readFile(path.join(cliHome,"package.json"),"utf8"));
if (cliPackage.name !== "firebase-tools" || cliPackage.version !== "15.23.0") throw new Error("Firebase CLI 15.23.0 requis.");
const auth = require(path.join(cliHome,"lib","auth.js"));
const account = auth.getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) throw new Error("Aucune session Firebase CLI existante.");
const credentials = await auth.getAccessToken(account.tokens.refresh_token, account.tokens.scope.split(" "));
const headers = {Authorization: "Bearer " + credentials.access_token, "Content-Type":"application/json"};
const base = "https://firebaserules.googleapis.com/v1";
const releaseName = "projects/" + project + "/releases/cloud.firestore";
const digest = text => createHash("sha256").update(text).digest("hex");
async function request(resource, options = {}) {
  const response = await fetch(base + "/" + resource, {headers,...options});
  if (!response.ok) throw new Error("API Rules HTTP " + response.status + " pour " + resource);
  return response.json();
}
const current = await request(releaseName);
const prior = await request(current.rulesetName);
const oldContent = prior.source?.files?.find(file => file.name === "firestore.rules")?.content;
if (typeof oldContent !== "string") throw new Error("Impossible de sauvegarder les règles publiées.");
await fs.mkdir(backupRoot,{recursive:true});
const stamp = new Date().toISOString().replace(/[:.]/g,"-");
const backupPath = path.join(backupRoot, "firestore-rules-before-" + stamp + ".json");
await fs.writeFile(backupPath, JSON.stringify({project,release:current,source:prior.source,sha256:digest(oldContent),savedAt:new Date().toISOString()},null,2),{flag:"wx"});
const local = await fs.readFile(new URL("./firestore.rules",import.meta.url),"utf8");
const info = {project,account:account.user.email,backupPath,previousRuleset:current.rulesetName,previousSha256:digest(oldContent),localSha256:digest(local),compiled:false,published:false};
if (process.argv.includes("--compile") || process.argv.includes("--apply")) {
  const candidate = await request("projects/" + project + "/rulesets", {method:"POST",body:JSON.stringify({source:{files:[{name:"firestore.rules",content:local}]}})});
  info.compiled = true; info.candidateRuleset = candidate.name;
  if (process.argv.includes("--apply")) {
    const beforeApply = await request(releaseName);
    if (beforeApply.rulesetName !== current.rulesetName) throw new Error("Les règles ont changé pendant la préparation. Publication annulée.");
    await request(releaseName,{method:"PATCH",body:JSON.stringify({release:{name:releaseName,rulesetName:candidate.name},updateMask:"rulesetName"})});
    const verified = await request(releaseName);
    if (verified.rulesetName !== candidate.name) throw new Error("La nouvelle release n’est pas confirmée.");
    const reread = await request(verified.rulesetName);
    if (digest(reread.source.files.find(f=>f.name==="firestore.rules").content) !== digest(local)) throw new Error("Le contenu distant diffère du fichier validé.");
    info.published = true;
  }
}
console.log(JSON.stringify(info,null,2));
