/** Account presentation only. Existing controls retain their own handlers and rights. */
const icons = {
  settings: '<path d="m9 3-1 3-3 1 1 3-1 3 3 1 1 3 3-1 3 1 1-3 3-1-1-3 1-3-3-1-1-3-3 1Z"/><circle cx="12" cy="10" r="3"/>',
  palette: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>',
  bell: '<path d="M6 16h12l-2-3V9a4 4 0 0 0-8 0v4Zm4 3h4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>',
  exit: '<path d="M10 4H5v16h5m-1-8h12m-4-4 4 4-4 4"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.settings}</svg>`;
const controlSelector = '[data-theme-toggle],#cockpit-theme-picker,#cockpit-motion-toggle,#cockpit-install-shortcut,#cockpit-health-launch,#cockpit-view-mode-toggle,[data-vm-attention-controls],#cockpit-logout,#cockpit-interface-switch,#cockpit-philanthropy-link,#cockpit-administration-launch';

export function mountAccountMenu({ document: doc = document, window: win = window, profile, classic = false } = {}) {
  const session = doc.querySelector('#cockpit-session');
  const actions = session?.querySelector('.cockpit-session-actions');
  if (!actions || !profile?.uid) return null;
  const existing = session.querySelector('[data-account-menu]');
  if (existing) return null;
  let disposed = false, queued = false, dialog = null, originalDialog = null;
  const moves = [], listeners = [];
  const on = (target, type, fn, options) => { target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener(type, fn, options)); };
  const move = (node, parent) => {
    if (!node || !parent || node.parentElement === parent) return;
    const marker = doc.createComment('account-menu: original position'); node.before(marker);
    moves.push({ node, marker }); parent.append(node);
  };
  const style = doc.createElement('link'); style.rel = 'stylesheet'; style.href = new URL('./account-menu.css?v=20261112-b116', import.meta.url).href; doc.head.append(style);
  session.classList.add('has-account-menu');
  doc.documentElement.classList.add('cockpit-account-ready');
  const brand = doc.createElement('a'); brand.className = 'account-brand'; brand.href = classic ? '#top' : '#/accueil';
  brand.innerHTML = '<span aria-hidden="true">≈</span><span>Bleu Massawippi<small>Cockpit</small></span>';
  session.prepend(brand);
  const host = doc.createElement('div'); host.className = 'account-menu'; host.dataset.accountMenu = '';
  host.innerHTML = `<button id="cockpit-account-trigger" class="account-trigger" type="button" aria-expanded="false" aria-controls="cockpit-account-popup" aria-haspopup="menu"><span class="account-avatar" data-account-initials aria-hidden="true"></span><span data-account-name></span>${icon('chevron')}</button>
    <div id="cockpit-account-popup" class="account-popup" role="menu" aria-label="Menu du compte" hidden>
      <div class="account-identity" role="presentation"><strong data-account-name></strong><small data-account-role></small></div>
      <div data-account-settings-slot></div>
      <div data-account-administration-slot></div>
      <button type="button" role="menuitem" data-account-help>${icon('help')}<span>Aide et outils</span></button>
      <div class="account-menu-divider" role="separator"></div><div data-account-logout-slot></div>
    </div>`;
  actions.append(host);
  const trigger = host.querySelector('.account-trigger'), popup = host.querySelector('.account-popup');
  const name = String(profile.displayLabel || profile.displayName || 'Mon compte');
  host.querySelectorAll('[data-account-name]').forEach(node => { node.textContent = name; });
  host.querySelector('[data-account-initials]').textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => [...word][0]).join('').toLocaleUpperCase('fr-CA');
  host.querySelector('[data-account-role]').textContent = profile.role === 'director' ? 'Direction générale' : profile.role === 'admin' ? 'Direction des communications' : 'Compte connecté';
  const items = () => [...popup.querySelectorAll('[role="menuitem"]')].filter(node => !node.disabled && !node.hidden);
  const close = (focus = false) => { popup.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (focus && trigger.isConnected) trigger.focus({ preventScroll: true }); };
  const open = (last = false) => { popup.hidden = false; trigger.setAttribute('aria-expanded', 'true'); (last ? items().at(-1) : items()[0])?.focus(); };
  on(trigger, 'click', () => popup.hidden ? open() : close());
  on(popup, 'click', event => { if(event.target.closest('#cockpit-administration-launch')) close(); });
  on(trigger, 'keydown', event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(event.key === 'ArrowUp'); } });
  on(popup, 'keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') { close(true); return; }
    const list = items(), index = list.indexOf(doc.activeElement);
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); list[event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + list.length) % list.length]?.focus();
  });
  on(doc, 'pointerdown', event => { if (!host.contains(event.target)) close(); });
  on(doc, 'focusin', event => { if (!host.contains(event.target)) close(); });
  on(popup, 'click', event => {
    if (event.target.closest('[data-theme-toggle]')) selectPanel('appearance');
    if (event.target.closest('[data-theme-toggle],#cockpit-logout')) close();
  }, true);

  function selectPanel(id, focus = false) {
    if (!dialog) return;
    dialog.querySelectorAll('[data-account-tab]').forEach(tab => {
      const active = tab.dataset.accountTab === id; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    dialog.querySelectorAll('[data-account-panel]').forEach(panel => { panel.hidden = panel.dataset.accountPanel !== id; });
  }
  function prepareDialog(picker) {
    dialog = picker;
    originalDialog = { children: [...picker.childNodes], title: picker.querySelector('h2')?.textContent, intro: picker.querySelector('p')?.textContent, footerLabel: picker.querySelector('form button')?.textContent };
    const title = picker.querySelector('h2'), intro = picker.querySelector('p'), themes = picker.querySelector('fieldset'), footer = picker.querySelector('form');
    if (!title || !themes || !footer) return;
    picker.classList.add('account-settings');
    title.textContent = 'Paramètres et préférences';
    if (intro) intro.textContent = 'Votre espace de travail, à votre façon.';
    footer.querySelector('button').textContent = 'Fermer';
    const header = doc.createElement('header'); header.className = 'account-settings-heading';
    const text = doc.createElement('div'); text.append(title); if (intro) text.append(intro); header.append(text);
    const dismiss = doc.createElement('button'); dismiss.type = 'button'; dismiss.className = 'account-close'; dismiss.setAttribute('aria-label', 'Fermer les paramètres'); dismiss.innerHTML = icon('close'); header.append(dismiss);
    const body = doc.createElement('div'); body.className = 'account-settings-body';
    body.innerHTML = `<nav class="account-settings-tabs" role="tablist" aria-label="Catégories des paramètres">
      ${[['appearance', 'palette', 'Apparence'], ['notifications', 'bell', 'Notifications'], ['tools', 'help', 'Aide et outils']].map(([id, image, label]) => `<button type="button" id="account-tab-${id}" role="tab" aria-controls="account-panel-${id}" aria-selected="${id === 'appearance'}" tabindex="${id === 'appearance' ? 0 : -1}" data-account-tab="${id}">${icon(image)}<span>${label}</span></button>`).join('')}</nav>
      <section id="account-panel-appearance" role="tabpanel" aria-labelledby="account-tab-appearance" data-account-panel="appearance" tabindex="0">
        <div data-account-slot="themes"></div><section class="account-setting-block" data-account-block="motion"><h3>Animations</h3><p>Des mouvements discrets, ou une interface sans animation. Le réglage d’accessibilité de l’appareil est toujours respecté.</p><div data-account-slot="motion"></div></section>
        <section class="account-setting-block" data-account-block="view" ${classic ? '' : 'hidden'}><h3>Niveau de détail</h3><p>Choisissez la présentation de l’interface classique.</p><div data-account-slot="view"></div></section>
        <section class="account-setting-block account-interface"><h3>Interface du Cockpit</h3><p>${classic ? 'Vous utilisez la version classique. Le Cockpit est l’interface par défaut.' : 'Vous utilisez le Cockpit. La version classique reste disponible si nécessaire.'}</p><div data-account-slot="interface"></div><small>Enregistrez vos saisies avant de changer d’interface. Les dossiers et les validations restent les mêmes.</small></section>
      </section>
      <section id="account-panel-notifications" role="tabpanel" aria-labelledby="account-tab-notifications" data-account-panel="notifications" tabindex="0" hidden><h3>Rester au courant</h3><p>Réglez les alertes sur cet appareil, sans changer celles de l’autre personne.</p><div data-account-slot="notifications"></div><p class="account-empty" data-account-notifications-empty>Les réglages des alertes seront disponibles après le chargement de votre suivi.</p></section>
      <section id="account-panel-tools" role="tabpanel" aria-labelledby="account-tab-tools" data-account-panel="tools" tabindex="0" hidden><h3>Vos repères</h3><div class="account-help-grid"><article><b>Publications</b><p>Retrouvez textes, images et calendrier, avec les confirmations de chacun.</p></article><article><b>Projets et philanthropie</b><p>Consultez les dossiers, les documents et le registre au même endroit.</p></article></div><div class="account-setting-block"><button type="button" class="account-action" data-account-navigation>Aide à la navigation ${icon('help')}</button></div><section class="account-setting-block" data-account-block="install"><h3>Sur votre appareil</h3><p>Un raccourci vers le Cockpit, comme une application.</p><div data-account-slot="install"></div></section><section class="account-setting-block" data-account-block="health"><h3>En cas de difficulté</h3><p>Vérifiez la connexion et l’état du Cockpit.</p><div data-account-slot="health"></div></section><div data-account-slot="philanthropy"></div></section>`;
    const note = doc.createElement('small'); note.className = 'account-local-note'; note.textContent = 'Les préférences d’affichage sont enregistrées dans ce navigateur, lorsqu’il le permet.'; footer.prepend(note);
    picker.replaceChildren(header, body, footer); picker.querySelector('[data-account-slot="themes"]').append(themes);
    move(picker, host);
    on(dismiss, 'click', () => picker.close());
    on(picker, 'click', event => { const tab = event.target.closest('[data-account-tab]'); if (tab) selectPanel(tab.dataset.accountTab); });
    on(picker, 'keydown', event => {
      const tab = event.target.closest('[data-account-tab]'); if (!tab) return;
      const list = [...picker.querySelectorAll('[data-account-tab]')], i = list.indexOf(tab);
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const next = list[event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (i + (event.key === 'ArrowLeft' ? -1 : 1) + list.length) % list.length]; selectPanel(next.dataset.accountTab, true);
    });
    // Diagnostic and installation can open their own surfaces. Leave this modal first.
    on(picker, 'click', event => { if (event.target.closest('#cockpit-health-launch,#cockpit-install-shortcut')) picker.close(); }, true);
    on(picker.querySelector('[data-account-navigation]'), 'click', () => {
      picker.close(); doc.querySelector('#workspace-v2 [data-v2-help]')?.click();
    });
    on(picker, 'close', () => { if (!disposed && trigger.isConnected) trigger.focus({ preventScroll: true }); });
    selectPanel('appearance');
  }
  function refresh() {
    if (disposed || !session.isConnected) return;
    const picker = doc.querySelector('#cockpit-theme-picker');
    if (picker && !dialog) prepareDialog(picker);
    const theme = doc.querySelector('[data-theme-toggle]');
    if (theme) {
      theme.dataset.accountSettings = ''; theme.setAttribute('role', 'menuitem'); theme.setAttribute('aria-label', 'Paramètres et préférences'); theme.title = 'Thème, animations, notifications et outils';
      if (!theme.querySelector('[data-account-settings-label]')) theme.innerHTML = `${icon('settings')}<span data-account-settings-label>Paramètres et préférences</span>`;
      move(theme, host.querySelector('[data-account-settings-slot]'));
    }
    const logout = doc.querySelector('#cockpit-logout');
    const administration = doc.querySelector('#cockpit-administration-launch');
    if(profile.role === 'admin' && profile.uid === '6FAy9GJU5qTUlHNelXvtHBsVH3k1') move(administration, host.querySelector('[data-account-administration-slot]'));
    if (logout) { logout.setAttribute('role', 'menuitem'); move(logout, host.querySelector('[data-account-logout-slot]')); if (!logout.querySelector('svg')) logout.insertAdjacentHTML('afterbegin', icon('exit')); }
    if (!dialog) return;
    for (const [selector, slot] of [['#cockpit-motion-toggle','motion'], ['#cockpit-view-mode-toggle','view'], ['#cockpit-interface-switch','interface'], ['#cockpit-install-shortcut','install'], ['#cockpit-health-launch','health'], ['[data-vm-attention-controls]','notifications'], ['#cockpit-philanthropy-link','philanthropy']]) {
      move(doc.querySelector(selector), dialog.querySelector(`[data-account-slot="${slot}"]`));
    }
    for (const slot of ['motion', 'install', 'health']) dialog.querySelector(`[data-account-block="${slot}"]`).hidden = !dialog.querySelector(`[data-account-slot="${slot}"]`)?.children.length;
    dialog.querySelector('[data-account-notifications-empty]').hidden = Boolean(dialog.querySelector('[data-vm-attention-controls]'));
    dialog.querySelector('[data-account-navigation]').hidden = !doc.querySelector('#workspace-v2 [data-v2-help]');
  }
  on(host.querySelector('[data-account-help]'), 'click', () => { close(); refresh(); selectPanel('tools'); if (dialog && !dialog.open) { dialog.showModal(); dialog.querySelector('[data-account-tab="tools"]').focus(); } });
  on(win, 'cockpit:content-ready', refresh);
  on(win, 'cockpit:session-ready', refresh);
  const schedule = () => { if (queued || disposed) return; queued = true; (win.queueMicrotask || queueMicrotask)(() => { queued = false; refresh(); }); };
  const observer = new win.MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches?.(controlSelector) || node.querySelector?.(controlSelector))))) schedule();
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  refresh();
  return { element: host, profileKey: `${profile.uid}:${profile.role}`, refresh, destroy({ sessionEnded = false } = {}) {
    if (disposed) return; disposed = true; observer.disconnect(); listeners.forEach(remove => remove()); close();
    if (dialog?.open) dialog.close();
    for (const { node, marker } of moves.reverse()) {
      // The theme script can receive session-ended before this adapter. Never put
      // its surviving controls back into the session that is about to disappear.
      if (sessionEnded && (node.matches?.('[data-theme-toggle]') || node === dialog)) { marker.remove(); doc.body.append(node); }
      else if (marker.isConnected && node.isConnected) marker.replaceWith(node);
      else marker.remove();
    }
    if (dialog) {
      if (dialog.open) dialog.close();
      dialog.querySelector('.account-local-note')?.remove();
      if (originalDialog) {
        dialog.replaceChildren(...originalDialog.children);
        dialog.querySelector('h2').textContent = originalDialog.title;
        const intro = dialog.querySelector('p'); if (intro) intro.textContent = originalDialog.intro;
        dialog.querySelector('form button').textContent = originalDialog.footerLabel;
      }
      dialog.classList.remove('account-settings');
    }
    const theme = doc.querySelector('[data-theme-toggle]');
    if (theme) {
      delete theme.dataset.accountSettings; theme.removeAttribute('role');
      const label = ({light:'Clair',dark:'Sombre',paper:'Crème–terracotta'})[theme.dataset.currentTheme] || 'Clair';
      theme.textContent = `◐ ${label}`; theme.setAttribute('aria-label', `Choisir le thème — ${label}`); theme.title = `Thème : ${label}`;
    }
    brand.remove(); host.remove(); style.remove(); session.classList.remove('has-account-menu'); doc.documentElement.classList.remove('cockpit-account-ready');
  } };
}
