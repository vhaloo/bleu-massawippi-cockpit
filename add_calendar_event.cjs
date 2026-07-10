const fs = require('node:fs');

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');
const marker = 'data-calendar-event="weekly-coordination"';
if (html.includes(marker)) {
  console.log(JSON.stringify({ updated: file, alreadyIntegrated: true }, null, 2));
  process.exit(0);
}

const anchor = ' <div class="note"><strong>Règle de décision :</strong> la direction garde un droit de regard sur les faits, le contexte, la sécurité, les partenariats et les sujets sensibles; la création peut être ambitieuse tant qu’elle reste vérifiable, respectueuse et révisable.</div>';
if (!html.includes(anchor)) throw new Error('Bloc de collaboration introuvable.');

const calendarCard = ` <article class="panel calendar-card" ${marker} data-calendar-weekday="1" data-calendar-hour="10" data-calendar-duration="60">
  <h3>Ajouter le point de coordination à mon agenda</h3>
  <p>Le prochain point hebdomadaire est proposé le lundi matin autour de 10 h. L’horaire reste modifiable dans l’agenda partagé; ce bouton crée un rappel dans le calendrier choisi sur votre appareil.</p>
  <div class="calendar-actions"><button type="button" data-add-calendar>Ajouter à mon agenda</button><span data-calendar-feedback aria-live="polite"></span></div>
 </article>`;
html = html.replace(anchor, calendarCard + anchor);
fs.writeFileSync(file, html, 'utf8');
console.log(JSON.stringify({ updated: file, calendarEvent: 'weekly-coordination', weekday: 1, hour: 10 }, null, 2));
