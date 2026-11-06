import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { mountAccountMenu } from './account-menu.mjs';
const themeSource = fs.readFileSync(new URL('./theme.js', import.meta.url), 'utf8');
for (const role of ['admin', 'director']) {
  const { document, window } = parseHTML('<html><head></head><body><div id="cockpit-session"><span id="cockpit-session-label">Connecté</span><div class="cockpit-session-actions"><button id="cockpit-logout">Se déconnecter</button><a id="cockpit-interface-switch" href="?interface=classic">Classique</a><div id="cockpit-view-mode-toggle"><button>Vue complète</button></div></div></div><button id="cockpit-motion-toggle"><span data-motion-label>Animations</span></button><button id="cockpit-health-launch">Diagnostic</button><button id="cockpit-install-shortcut">Installer</button><section id="vm-panel-decision"><div data-vm-attention-controls><button data-vm-attention-toggle>Notifications</button></div></section><div id="workspace-v2"><button data-v2-help>Aide</button></div></body></html>');
  const events = new Map(), storage = new Map();
  const ctx = vm.createContext({ document, matchMedia: () => ({matches:false,addEventListener(){}}), addEventListener(name,fn){events.set(name,[...(events.get(name)||[]),fn]);}, localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)} });
  vm.runInContext(themeSource,ctx);
  const picker = document.querySelector('#cockpit-theme-picker');
  picker.showModal = () => { picker.open=true; };
  picker.close = () => { picker.open=false; picker.dispatchEvent(new window.Event('close')); };
  const originals = [...document.querySelectorAll('button,fieldset,[data-vm-attention-controls]')];
  let logouts=0, alerts=0, motion=0;
  document.querySelector('#cockpit-logout').addEventListener('click',()=>logouts++);
  document.querySelector('[data-vm-attention-toggle]').addEventListener('click',()=>alerts++);
  document.querySelector('#cockpit-motion-toggle').addEventListener('click',()=>motion++);
  const api=mountAccountMenu({document,window,profile:{uid:role,role,displayLabel:role==='admin'?'Valentin Test':'Annie Test'}});
  assert(api); const popup=document.querySelector('#cockpit-account-popup');
  assert.equal(popup.hidden,true); assert.equal(document.querySelectorAll('#cockpit-account-trigger').length,1);
  assert.equal(mountAccountMenu({document,window,profile:{uid:role}}),null);
  for(let i=0;i<3;i++)api.refresh();
  assert.equal(document.querySelectorAll('#cockpit-motion-toggle').length,1);
  assert(document.querySelector('#cockpit-logout').closest('[data-account-logout-slot]'));
  assert(document.querySelector('#cockpit-interface-switch').closest('[data-account-slot="interface"]'));
  document.querySelector('#cockpit-account-trigger').click();assert.equal(popup.hidden,false);
  document.querySelector('[data-theme-toggle]').click();assert.equal(popup.hidden,true);assert.equal(picker.open,true);
  vm.runInContext('setTheme("paper", true)',ctx);
  assert.equal(storage.get('bleu-massawippi-theme'),'paper');
  assert.match(document.querySelector('[data-theme-toggle]').textContent,/Paramètres et préférences/);
  document.querySelector('[data-vm-attention-toggle]').click();document.querySelector('#cockpit-motion-toggle').click();assert.equal(alerts,1);assert.equal(motion,1);
  document.querySelector('[data-account-tab="notifications"]').click();assert.equal(document.querySelector('[data-account-panel="notifications"]').hidden,false);
  picker.close();document.querySelector('#cockpit-account-trigger').click();document.querySelector('[data-theme-toggle]').click();assert.equal(document.querySelector('[data-account-panel="appearance"]').hidden,false);
  // Late controls are adopted once, retaining their original event path.
  const install=document.querySelector('#cockpit-install-shortcut');install.remove();document.body.append(install);api.refresh();assert(install.closest('[data-account-slot="install"]'));
  document.querySelector('#cockpit-logout').click();assert.equal(logouts,1);
  api.destroy();api.destroy();
  assert.equal(document.querySelector('[data-account-menu]'),null);assert.equal(document.querySelector('#cockpit-theme-picker').parentElement,document.body);
  assert(originals.every(node=>node.isConnected),'Tous les contrôles d’origine survivent au démontage.');
  assert.equal(document.querySelector('#cockpit-motion-toggle').parentElement,document.body);
  // Production ordering: the theme listener runs before the adapter teardown.
  const second=mountAccountMenu({document,window,profile:{uid:role,role,displayLabel:'Nouvelle session'}});
  events.get('cockpit:session-ended')?.forEach(fn=>fn());
  second.destroy({sessionEnded:true});document.querySelector('#cockpit-session').remove();
  assert.equal(document.querySelector('[data-theme-toggle]').parentElement,document.body);
  assert.equal(document.querySelector('#cockpit-theme-picker').parentElement,document.body);
  assert.equal(document.querySelector('[data-theme-toggle]').hasAttribute('data-account-settings'),false);
  console.log(`✓ ${role} : commandes réelles, thème conservé, onglets, montage idempotent et restauration.`);
}
// Safe delayed theme load: the menu exists before the theme script arrives.
{
  const {document,window}=parseHTML('<html><head></head><body><div id="cockpit-session"><div class="cockpit-session-actions"><button id="cockpit-logout">Sortir</button></div></div></body></html>');
  const api=mountAccountMenu({document,window,profile:{uid:'late',displayLabel:'<img src=x onerror=alert(1)>',role:'director'}});
  assert.equal(document.querySelector('.account-trigger img'),null);api.destroy();
}
console.log('✓ Nom traité comme texte; aucun service, droit ou donnée métier modifié.');
