import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseHTML } from "linkedom";
import { fixtureHTML, fixtures } from "./workspace-test-fixture.mjs";

// Execute the shipped adapter, replacing only its external service imports.
// The real router and DOM mount remain under test; no Firebase connection exists.
const source = await fs.readFile(new URL("./workspace-adapter.js", import.meta.url), "utf8");
const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
async function adapter({ failMount = false } = {}) {
  const adapted = source.replace(/(["'])(\.\/[^"']+)\1/g, (_match, _quote, specifier) => {
    const file = specifier.split("?")[0];
    const stubs = {
      "./firebase-client.js": "export async function fetchPublicationHistoryPage(){return {items:[],hasMore:false}}",
      "./editor-studio.js": "export function openPublicationStudio(){}"
    };
    if (failMount && file === "./workspace-v2.js") return JSON.stringify(moduleUrl('throw new Error("Échec de chargement simulé");'));
    if (stubs[file]) return JSON.stringify(moduleUrl(stubs[file]));
    assert(["./calendar-export-tools.js", "./workspace-model.mjs", "./workspace-v2.js"].includes(file), `Import inattendu : ${file}`);
    return JSON.stringify(new URL(specifier, import.meta.url).href);
  });
  return import(moduleUrl(adapted));
}
const normal = await adapter();
const cases = [
  { label: "connexion communications sans paramètre", role: "admin", suffix: "", hash: "#/accueil" },
  { label: "connexion direction sans paramètre", role: "director", suffix: "", hash: "#/accueil" },
  { label: "application installée", suffix: "?source=application", hash: "#/accueil" },
  { label: "ancien lien direct", suffix: "#test-first", hash: "#/publications/test-first" },
  { label: "lien V2 existant", suffix: "?interface=v2#/publications/test-first", hash: "#/publications/test-first" },
  { label: "ancien calendrier", suffix: "#calendrier", hash: "#/publications?vue=calendrier" },
  { label: "dossier conservé", suffix: "#/projets", hash: "#/projets" },
  { label: "retour classique et reconnexion explicites", suffix: "?interface=classic#test-first", classic: true },
  { label: "aucune ouverture avant authentification", suffix: "", signedOut: true },
  { label: "secours classique si le module V2 échoue", suffix: "#test-first", failMount: true }
];
for (const item of cases) {
  const {document,window} = parseHTML(`<html><head></head><body>${fixtureHTML}</body></html>`);
  Object.defineProperty(window.HTMLSelectElement.prototype,"value",{configurable:true,get(){return this.getAttribute("data-test-value")||"";},set(value){this.setAttribute("data-test-value",value);}});
  const url = new URL(`http://localhost/cockpit/${item.suffix}`), savedState = { retained: "navigation" }, changes = [];
  const history = { state: savedState, replaceState(state, _title, href) { assert.equal(state,savedState); url.href=href; changes.push(href); }, pushState(_state,_title,href){url.href=new URL(href,url).href;} };
  window.location=url;window.history=history;window.scrollTo=()=>{};window.scrollY=0;
  Object.assign(globalThis,{document,window,history,location:url,posts:structuredClone(fixtures),MutationObserver:window.MutationObserver,CustomEvent:window.CustomEvent});
  const profile=item.signedOut?null:{uid:"local-only",role:item.role||"admin"};
  const state={basePosts:fixtures,workflows:new Map(fixtures.map(p=>[p.id,{stage:"content_approved"}])),decisions:new Map(),mediaByEvent:new Map(),mediaDecisions:new Map()};
  const initialCopy=JSON.stringify(globalThis.posts), controls=[...document.querySelectorAll("button,input,textarea")], notices=[];
  const current=item.failMount?await adapter({failMount:true}):normal;
  current.setupInterfaceSwitch(profile);
  const oldWarn=console.warn;if(item.failMount)console.warn=()=>{};
  let workspace;
  try {workspace=await current.setupWorkspaceV2(profile,{state,enhanceCards(){},toast:message=>notices.push(message),mediaPreview(){return "";}});} finally {console.warn=oldWarn;}
  if(item.signedOut||item.classic||item.failMount){
    assert.equal(document.querySelector("#workspace-v2"),null);
    if(item.failMount){assert.equal(url.searchParams.get("interface"),"classic");assert.equal(url.hash,"#test-first");assert.equal(notices.length,1);assert.match(document.querySelector("#cockpit-interface-switch").textContent,/Version 2/);}
    else {assert.equal(changes.length,0);assert.equal(notices.length,0);}
  } else {
    assert.equal(document.documentElement.dataset.workspace,"v2");assert.equal(url.hash,item.hash);assert.equal(url.searchParams.get("interface"),"v2");
    assert.equal(url.searchParams.get("source"),item.suffix.includes("source=application")?"application":null);
    const link=document.querySelector(".v2-classic-link");assert.equal(new URL(link.href).searchParams.get("interface"),"classic");
    assert.equal(document.querySelector("#workspace-v2").dataset.space,item.hash.includes("publications")?"publications":item.hash.includes("projets")?"projets":"accueil");
  }
  assert.equal(JSON.stringify(globalThis.posts),initialCopy);assert(controls.every(node=>node.isConnected));
  workspace?.destroy();assert(controls.every(node=>node.isConnected));
  console.log(`✓ ${item.label}`);
}
console.log(`✓ ${cases.length} démarrages de l’adaptateur réel, sans écriture ni connexion Firebase.`);
