import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
const script = fs.readFileSync(new URL('./theme.js', import.meta.url), 'utf8');
function boot(saved, blocked = false) {
  const { document, window } = parseHTML('<html><head></head><body></body></html>');
  const storage = new Map(saved ? [['bleu-massawippi-theme', saved]] : []);
  const listeners = [];
  const events = new Map();
  const media = { matches: true, addEventListener: (_, fn) => listeners.push(fn) };
  const context = vm.createContext({ document, matchMedia: () => media, addEventListener(name, fn) { events.set(name, [...(events.get(name) || []), fn]); }, localStorage: { getItem: k => { if (blocked) throw Error('disabled'); return storage.get(k); }, setItem: (k,v) => { if (blocked) throw Error('disabled'); storage.set(k,v); } } });
  vm.runInContext(script, context);
  return { document, window, context, storage, listeners, emit(name) { events.get(name)?.forEach(fn => fn()); } };
}
const first = boot();
assert.equal(first.document.documentElement.dataset.theme, 'dark');
vm.runInContext('setTheme("paper", true)', first.context);
assert.equal(first.storage.get('bleu-massawippi-theme'), 'paper');
assert.equal(first.document.documentElement.style.colorScheme, 'light');
const checked = [...first.document.querySelectorAll('input')].filter(input => input.checked);
assert.equal(checked.length, 1);
assert.equal(checked[0].value, 'paper');
assert.match(first.document.querySelector('[data-theme-toggle]').getAttribute('aria-label'), /Crème–terracotta/);
const restored = boot('paper');
assert.equal(restored.document.documentElement.dataset.theme, 'paper');
restored.listeners.forEach(fn => fn({ matches: true }));
assert.equal(restored.document.documentElement.dataset.theme, 'paper');
vm.runInContext('setTheme("unknown", true)', restored.context);
assert.equal(restored.document.documentElement.dataset.theme, 'paper');
const privateMode = boot(null, true);
vm.runInContext('setTheme("paper", true)', privateMode.context);
assert.equal(privateMode.document.documentElement.dataset.theme, 'paper');
assert.equal(boot('light').document.documentElement.dataset.theme, 'light');
// Late authentication and session renewal must move the original control,
// preserving its listener and the chosen theme without creating another button.
const renewal = boot('paper');
const themeButton = renewal.document.querySelector('[data-theme-toggle]');
const picker = renewal.document.querySelector('#cockpit-theme-picker');
let opened = 0;
picker.showModal = () => { opened++; picker.open = true; };
picker.close = () => { picker.open = false; };
picker.querySelectorAll('input').forEach(input => { input.focus = () => {}; });
function session() {
  renewal.document.body.insertAdjacentHTML('afterbegin', '<div id="cockpit-session"><span id="cockpit-session-label">Profil de test</span><div class="cockpit-session-actions"><a id="cockpit-interface-switch">Version</a><button id="cockpit-logout">Sortir</button></div></div>');
  return renewal.document.querySelector('#cockpit-session');
}
const initialSession = session();
renewal.emit('cockpit:session-ready');
assert.equal(themeButton.parentElement, initialSession.querySelector('.cockpit-session-actions'));
assert.equal(themeButton.nextElementSibling.id, 'cockpit-interface-switch');
renewal.emit('cockpit:content-ready'); renewal.emit('cockpit:session-ready');
assert.equal(renewal.document.querySelectorAll('[data-theme-toggle]').length, 1);
themeButton.click(); assert.equal(opened, 1);
renewal.emit('cockpit:session-ended'); initialSession.remove();
assert.equal(picker.open, false);
assert.equal(themeButton.parentElement, renewal.document.body);
assert(!themeButton.classList.contains('in-session'));
const secondSession = session(); renewal.emit('cockpit:session-ready');
assert.equal(themeButton.parentElement, secondSession.querySelector('.cockpit-session-actions'));
assert.equal(renewal.document.documentElement.dataset.theme, 'paper');
themeButton.click(); assert.equal(opened, 2);
assert.equal(renewal.document.querySelectorAll('#cockpit-theme-picker').length, 1);
console.log('Barre : connexion tardive, événements répétés, fin de session et reconnexion sans doublon ni perte du sélecteur.');
console.log('Thèmes : préférence conservée, trois choix exclusifs, stockage indisponible et thème système vérifiés.');
