import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "publication_editor_cli.mjs"), "utf8");

const checks = [
  ["simulation par défaut", source.includes('mode: "dry-run"') && source.includes("Relancez la même commande avec --apply")],
  ["écriture explicitement gardée", source.includes('booleanOption(args, "apply")') && source.includes("if (!apply)")],
  ["acteur admin actif obligatoire", source.includes('profile.role !== "admin"') && source.includes("profile.active !== true")],
  ["transaction et contrôle de révision", source.includes("db.runTransaction") && source.includes("Conflit de révision")],
  ["archive atomique", source.includes("transaction.set(archiveReference") && source.includes('entityType: "publicationContent"')],
  ["lectures bornées", source.includes('integerOption(args, "limit", 30, 1, 100)') && source.includes('integerOption(args, "limit", 20, 1, 40)')],
  ["aucune commande destructive", !/\.delete\s*\(/.test(source) && !/command\s*===\s*["']delete/.test(source)],
  ["restauration non destructive", source.includes("version restaurée depuis l’outil local") && source.includes("publicationFromScheduleRow")]
];

const failures = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${label}`);
if (failures.length) process.exitCode = 1;
