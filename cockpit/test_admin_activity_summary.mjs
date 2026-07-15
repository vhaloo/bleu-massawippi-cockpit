import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseHTML } from "linkedom";

const root = path.dirname(fileURLToPath(import.meta.url));
const ui = fs.readFileSync(path.join(root, "cockpit-ui.js"), "utf8");
const lazy = fs.readFileSync(path.join(root, "admin-lazy-data.js"), "utf8");
const summary = fs.readFileSync(path.join(root, "admin-activity-summary.js"), "utf8");
const firebase = fs.readFileSync(path.join(root, "firebase-client.js"), "utf8");
const health = fs.readFileSync(path.join(root, "client-health-ui.js"), "utf8");

const activityPosition = ui.indexOf('id=\\"cockpit-director-activity\\"');
const taskPosition = ui.indexOf('id=\\"cockpit-task-heading\\"');
const logPosition = ui.indexOf("Journal de modifications");
assert.ok(activityPosition >= 0 && activityPosition < taskPosition && taskPosition < logPosition, "Le résumé doit précéder À accomplir et le journal.");
assert.match(ui, /if \(profile\.role === "admin"\) \{[\s\S]*buildAdminSidebar\(\)/, "Le panneau doit rester réservé au rôle admin.");
assert.match(lazy, /setAdminActivityLogs\(logs\)/, "Le résumé doit réutiliser le journal déjà reçu.");
assert.doesNotMatch(summary, /onSnapshot|getDocs|getDoc|setDoc|addDoc|updateDoc|setInterval|recordDirectorActivity/, "Le résumé ne doit créer ni lecture, écriture, écoute ou surveillance périodique.");
assert.doesNotMatch(firebase, /userActivityDaily|EXPLICIT_LOGIN_MARKER_KEY|recordDirectorActivityPulse/, "Aucune nouvelle télémétrie cachée ne doit être introduite dans Firebase.");
assert.match(summary, /Une consultation sans action n’est volontairement pas mesurée/, "La limite de mesure doit être explicite dans la vue admin.");
assert.match(health, /profile\?\.role !== "admin"/, "Santé Firebase doit refuser tout rôle autre qu’admin.");
assert.match(ui, /if \(profile\.role === "admin"\) \{[\s\S]{0,500}buildHealthWidget\(profile\)/, "Santé Firebase doit être créée exclusivement dans la branche admin.");

const { window } = parseHTML('<!doctype html><html><body><section id="cockpit-director-activity"></section></body></html>');
globalThis.window = window;
globalThis.document = window.document;
const moduleUrl = `${pathToFileURL(path.join(root, "admin-activity-summary.js")).href}?test=${Date.now()}`;
const activity = await import(moduleUrl);
const now = Date.now();
const stamp = (millis) => ({ toDate: () => new Date(millis) });
activity.setAdminActivityLogs([
  { userLabel:"Annie Goyet", action:"commentaire ajouté", sectionId:"s1d1", createdAt:stamp(now - 15 * 60000) },
  { userLabel:"Annie Goyet", action:"visuel approuvé", sectionId:"s1d2", createdAt:stamp(now - 90 * 60000) },
  { userLabel:"Valentin Wittwe", action:"publication programmée", sectionId:"s1d3", createdAt:stamp(now - 30 * 60000) },
  { userLabel:"Annie Goyet", action:"ancienne décision", sectionId:"s0", createdAt:stamp(now - 60 * 3600000) }
]);
const rendered = window.document.querySelector("#cockpit-director-activity").textContent.replace(/\s+/g, " ");
assert.match(rendered, /2actions sur 48 h/, "Seules les deux actions récentes de la Direction doivent être comptées.");
assert.match(rendered, /1commentaires et consignes/, "La catégorie commentaires doit être calculée.");
assert.ok(window.document.querySelectorAll(".cockpit-activity-action-bar").length === 48, "Le graphique doit couvrir 48 heures.");

console.log("✓ activité Direction : résumé admin, 48 h et coût nul vérifiés");
