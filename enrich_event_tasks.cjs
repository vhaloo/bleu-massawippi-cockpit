const fs = require("node:fs");

const sourcePath = require("node:path").join(__dirname, "index.html");
const source = fs.readFileSync(sourcePath, "utf8");
const match = source.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/);
if (!match) throw new Error("Le tableau des publications est introuvable.");

const posts = JSON.parse(match[1]);
const marker = "event-task-owners-2026-07-10";

function buildAnnieTasks(post) {
  const text = [post.title, post.t, post.role, post.source, post.visual, post.task].join(" ").toLocaleLowerCase("fr-CA");
  const tasks = [];
  if (/(donnée|indicateur|bilan|vigilance|sécurité|analyse|disque|résultat|science|actualité|contamination)/.test(text)) {
    tasks.push("Confirmer le contexte, la source primaire et les limites de l’information avant toute programmation.");
  }
  if (/(bénévolat|portrait|témoignage|voix du lac|souvenir|mémoire|archive|consentement|personne reconnaissable|citation)/.test(text)) {
    tasks.push("Confirmer les droits, les consentements et le contexte de toute personne, image, archive ou citation identifiable.");
  }
  if (/(partenaire|subvention|soutien|zeffy|financement|contact|entreprise|don|administration)/.test(text)) {
    tasks.push("Assurer le relais institutionnel et confirmer les informations à transmettre aux partenaires, bailleurs ou parties prenantes.");
  }
  if (/(quebec\.ca|transports canada|embarcation|mise à l’eau|mise à l'eau|nautique|nettoyage)/.test(text)) {
    tasks.push("Valider que le conseil et le lien officiel sont à jour et adaptés au contexte local avant diffusion.");
  }
  if (post.t === "Patrimoine") {
    tasks.push("Valider la date, le crédit et le contexte historique avant de présenter l’image comme un fait établi.");
  }
  return [...new Set(tasks)];
}

function buildValentinTasks(post) {
  const format = post.format || "format prévu";
  return [
    `Produire le ${format.toLocaleLowerCase("fr-CA")} avec un visuel autorisé, un texte alternatif et une mise en page lisible sur mobile.`,
    String(post.task || "Vérifier la source, les droits et les éléments nécessaires avant diffusion.").trim(),
    "Finaliser la légende FR / EN, programmer seulement après les validations requises, puis suivre les premiers commentaires et les indicateurs utiles."
  ];
}

for (const post of posts) {
  post.tasksValentin = buildValentinTasks(post);
  post.tasksAnnie = buildAnnieTasks(post);
  post.taskOwnersVersion = marker;
}

const replacement = `var posts=${JSON.stringify(posts)};\nvar meta=`;
const updated = source.replace(/var posts=\[[\s\S]*?\];\s*var meta=/, replacement);
if (updated !== source) fs.writeFileSync(sourcePath, updated, "utf8");
console.log(JSON.stringify({ updated: updated !== source ? sourcePath : false, posts: posts.length, withAnnieTasks: posts.filter((post) => post.tasksAnnie.length).length, marker }));
