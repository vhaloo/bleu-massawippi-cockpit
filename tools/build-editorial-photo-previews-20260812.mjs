import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const root = path.resolve(import.meta.dirname, "..");
const jobs = [
  {
    source: "C:/Users/Vhaloo/Association pour la protection du lac Massawippi inc/Communication site - Documents/Photos/Photos drone pêle mêle/DJI_0361.JPG",
    output: "cockpit/media-previews/2026-08-25/alt-20260723-rive-naturelle-photo-reelle-DJI_0361-preview.webp",
    position: "centre",
  },
  {
    source: "C:/Users/Vhaloo/Association pour la protection du lac Massawippi inc/Communication site - Documents/Photos/2025/Drone_Baie_Bacon_et_plage_03062025/Ima9.JPG",
    output: "cockpit/media-previews/2026-08-18/s3d7-cinq-reflexes-photo-reelle-Ima9-preview.webp",
    position: "west",
  },
  {
    source: "C:/Users/Vhaloo/Association pour la protection du lac Massawippi inc/Communication site - Documents/Photos/Photos drone pêle mêle/DJI_0020.JPG",
    output: "cockpit/media-previews/2026-08-26/alt-20260724-bassin-versant-photo-reelle-DJI_0020-preview.webp",
    position: "centre",
  },
];

for (const job of jobs) {
  const output = path.join(root, job.output);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(job.source)
    .rotate()
    .resize(720, 900, { fit: "cover", position: job.position, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(output);
  const metadata = await sharp(output).metadata();
  console.log(`${job.output}: ${metadata.width}x${metadata.height}`);
}
