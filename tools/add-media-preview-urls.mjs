import fs from "node:fs";
import path from "node:path";

const [mappingPath] = process.argv.slice(2);
if (!mappingPath || !fs.existsSync(mappingPath)) {
  throw new Error("Usage: node tools/add-media-preview-urls.mjs mapping.json");
}

const root = path.resolve(import.meta.dirname, "..");
const mappings = JSON.parse(fs.readFileSync(mappingPath, "utf8"));
const manifestNames = [
  "historical_media_manifest.json",
  "nature_media_manifest.json",
  "editorial_media_manifest.json"
];
const changed = [];

for (const entry of mappings) {
  let applied = false;
  for (const manifestName of manifestNames) {
    const manifestPath = path.join(root, "cockpit", manifestName);
    const original = fs.readFileSync(manifestPath, "utf8");
    const lines = original.split(/\r?\n/);
    const compactNeedle = `"id":"${entry.id}"`;
    const prettyNeedle = `"id": "${entry.id}"`;
    const index = lines.findIndex((line) => line.includes(compactNeedle) || line.includes(prettyNeedle));
    if (index < 0) continue;

    if (lines[index].includes(`"previewUrl"`)) {
      applied = true;
      break;
    }

    if (lines[index].includes(compactNeedle)) {
      lines[index] = lines[index].replace(
        /(\"fileName\":\"[^\"]+\",)/,
        `$1\"previewUrl\":${JSON.stringify(entry.previewUrl)},`
      );
    } else {
      const fileNameIndex = lines.findIndex((line, lineIndex) => lineIndex > index && lineIndex <= index + 8 && line.includes(`"fileName":`));
      if (fileNameIndex < 0) throw new Error(`fileName introuvable pour ${entry.id}`);
      const indent = lines[fileNameIndex].match(/^\s*/)?.[0] || "";
      lines.splice(fileNameIndex + 1, 0, `${indent}"previewUrl": ${JSON.stringify(entry.previewUrl)},`);
    }

    const next = lines.join(original.includes("\r\n") ? "\r\n" : "\n");
    JSON.parse(next);
    fs.writeFileSync(manifestPath, next, "utf8");
    changed.push({ id: entry.id, manifest: manifestName, previewUrl: entry.previewUrl });
    applied = true;
    break;
  }
  if (!applied) throw new Error(`Média introuvable dans les manifestes : ${entry.id}`);
}

console.log(JSON.stringify({ changed }, null, 2));
