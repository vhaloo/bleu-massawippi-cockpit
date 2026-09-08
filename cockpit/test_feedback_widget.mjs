import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseHTML } from "linkedom";
import { buildFeedbackWidget } from "./feedback-widget.mjs";
const { document, window } = parseHTML("<!doctype html><html><head></head><body></body></html>");
let submits = 0, submittedForm, focused;
window.HTMLElement.prototype.focus = function () { focused = this; };
const options = {
  document,
  formMarkup: '<form data-feedback-form="cockpit"><label>Votre idée<textarea></textarea></label><button type="submit">Envoyer</button></form>',
  onSubmit: form => { submits++; submittedForm = form; }
};
const { launch, panel } = buildFeedbackWidget(options);
assert.equal(panel.hidden, true); assert.equal(launch.getAttribute("aria-expanded"), "false");
assert.equal(launch.getAttribute("aria-controls"), panel.id); assert(launch.title.includes("tout le cockpit"));
assert.equal(buildFeedbackWidget(options).launch, launch); assert.equal(document.querySelectorAll("#cockpit-feedback-launch").length, 1);
launch.click(); assert.equal(panel.hidden, false); assert(panel.classList.contains("open")); assert.equal(focused, panel.querySelector("textarea"));
const input = panel.querySelector("textarea"); input.value = "Une recommandation non envoyée";
panel.querySelector("[data-feedback-close]").click(); assert(panel.hidden); assert.equal(focused, launch); assert.equal(input.value, "Une recommandation non envoyée");
launch.click(); const escape = new window.Event("keydown", { bubbles: true, cancelable: true }); escape.key = "Escape"; input.dispatchEvent(escape);
assert(panel.hidden); assert.equal(launch.getAttribute("aria-expanded"), "false"); assert.equal(focused, launch); assert.equal(submits, 0);
launch.click(); const form = panel.querySelector("form"); form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
assert.equal(submits, 1); assert.equal(submittedForm, form); assert.equal(form.dataset.feedbackForm, "cockpit");
const ui = await fs.readFile(new URL("./cockpit-ui.js", import.meta.url), "utf8");
assert(ui.includes('formMarkup: feedbackFormMarkup("cockpit"), onSubmit: submitFeedbackForm'));
for (const file of ["feedback-widget.mjs", "editorial-cycle-guard.mjs"]) {
  const worker = await fs.readFile(new URL("./sw.js", import.meta.url), "utf8");
  const deploy = await fs.readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  assert(worker.includes(file)); assert(deploy.includes(`cp cockpit/${file} public/`));
}
console.log("✓ Boîte à idées : ouverture, clavier, fermeture, texte préservé, un seul formulaire et circuit existant.");
