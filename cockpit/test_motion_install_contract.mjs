import assert from "node:assert/strict";
import fs from "node:fs";

const motion = fs.readFileSync(new URL("./motion.js", import.meta.url), "utf8");
const viewMode = fs.readFileSync(new URL("./view-mode.css", import.meta.url), "utf8");

for (const token of [
  "bleu-massawippi-motion",
  "prefers-reduced-motion: reduce",
  "root.dataset.motion",
  "cockpit-motion-toggle",
  "cockpit-water-level",
  "cockpit-voice-meter",
  "[data-dictate][aria-pressed=\"true\"]",
  "html[data-motion=\"off\"]"
]) assert.ok(motion.includes(token), `La couche de mouvement doit conserver ${token}.`);

assert.match(motion, /localStorage\.setItem\(MOTION_KEY, next\)/, "La préférence de mouvement doit rester locale à l’appareil.");
assert.match(motion, /button\.disabled = systemReduced/, "La préférence système de réduction doit toujours primer.");
assert.match(motion, /cockpit:session-ended/, "Le widget ne doit pas rester visible après la déconnexion.");
assert.match(motion, /function buildInstallShortcut\(\)/, "Un raccourci d’installation permanent doit exister.");
assert.match(motion, /id = "cockpit-install-shortcut"/, "Le raccourci d’installation doit avoir un identifiant stable.");
assert.match(motion, /buildInstallShortcut\(\);/, "Le raccourci doit être ajouté après l’ouverture de la session.");
assert.doesNotMatch(motion.match(/function buildInstallShortcut\(\)[\s\S]*?\n}/)?.[0] || "", /INSTALL_DISMISS_KEY/, "Masquer le conseil ne doit pas masquer le raccourci permanent.");
assert.match(viewMode, /#context-collapsible\[open\] > \.context-body > \*\s*\{\s*display:\s*block !important;/,
  "Le contexte ouvert doit révéler son contenu en Vue essentielle.");
assert.match(motion, /#cockpit-motion-toggle \{[^}]*left:150px;[^}]*bottom:15px;[^}]*z-index:30;/,
  "Le widget de mouvement doit rester séparé de la boîte à idées sur ordinateur.");
assert.match(motion, /#cockpit-motion-toggle \{ left:8px; bottom:62px;/,
  "Le widget de mouvement doit rester au-dessus de la barre d’actions mobile.");

console.log("✓ mouvements discrets, arrêt global et raccourci d’installation couverts");
