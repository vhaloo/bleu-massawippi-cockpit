import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";

const cockpitDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(cockpitDir);

function cleanRelativeUrl(value) {
  return decodeURIComponent(String(value || "").split("#", 1)[0].split("?", 1)[0]);
}

function deployedPath(value) {
  const relative = cleanRelativeUrl(value).replace(/^\.\//, "").replace(/^\//, "");
  return path.join(cockpitDir, ...relative.split("/").filter(Boolean));
}

function auditDocument(filePath, { contentDocument = false } = {}) {
  const html = fs.readFileSync(filePath, "utf8");
  const { document } = parseHTML(html);
  const missingFiles = [];
  const missingAnchors = [];
  const invalidExternalUrls = [];
  const externalHosts = new Map();
  const references = [...document.querySelectorAll("[href], [src]")].flatMap((node) =>
    [node.getAttribute("href"), node.getAttribute("src")].filter(Boolean)
  );

  for (const rawValue of references) {
    const value = String(rawValue).trim();
    if (!value || /^(?:data:|mailto:|tel:|javascript:)/i.test(value)) continue;
    if (value.startsWith("#")) {
      const id = decodeURIComponent(value.slice(1));
      if (id && !document.getElementById(id)) missingAnchors.push(value);
      continue;
    }
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value.replaceAll("&amp;", "&"));
        externalHosts.set(url.hostname, (externalHosts.get(url.hostname) || 0) + 1);
      } catch {
        invalidExternalUrls.push(value);
      }
      continue;
    }

    const localPath = contentDocument ? deployedPath(value) : path.join(path.dirname(filePath), cleanRelativeUrl(value));
    const copiedRootSource = contentDocument ? path.join(rootDir, cleanRelativeUrl(value)) : null;
    if (!fs.existsSync(localPath) && !(copiedRootSource && fs.existsSync(copiedRootSource))) {
      missingFiles.push({ value, expected: path.relative(rootDir, localPath) });
    }
  }

  return {
    file: path.relative(rootDir, filePath),
    references: references.length,
    externalHosts: Object.fromEntries([...externalHosts.entries()].sort()),
    missingFiles,
    missingAnchors,
    invalidExternalUrls
  };
}

const reports = [
  auditDocument(path.join(rootDir, "index.html"), { contentDocument: true }),
  auditDocument(path.join(cockpitDir, "index.html"))
];

for (const report of reports) {
  assert.deepEqual(report.missingFiles, [], `${report.file} contient des fichiers locaux introuvables.`);
  assert.deepEqual(report.missingAnchors, [], `${report.file} contient des cibles internes introuvables.`);
  assert.deepEqual(report.invalidExternalUrls, [], `${report.file} contient des URL externes invalides.`);
}

console.log(JSON.stringify({ passed: true, reports }, null, 2));
