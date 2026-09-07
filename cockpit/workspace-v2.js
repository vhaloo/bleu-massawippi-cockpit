import { SPACES, WORKSPACE_VERSION, escapeHtml as esc, routeHash, parseRoute, prettyDate, todayKey, monthDays, shiftMonth, filterPublications, publicationState, safeLink, workspaceIcon as icon, topicIcon, publicationNeighbours, previewCandidates, interfaceUrl } from "./workspace-model.mjs";

/** Opt-in presentation adapter. Existing DOM controls remain the only writers. */
export function mountWorkspace(api) {
  const doc = api.document || document;
  const win = api.window || window;
  const host = doc.querySelector("#cockpit-content");
  if (!host || !api.profile?.uid) return null;
  const state = { route: parseRoute(win.location.hash), query: "", status: "all", month: todayKey().slice(0, 7), timer: 0, disposed: false, lastEntity: "", galleryIndex: new Map(), histories: new Map(), historyTokens: new Map(), moves: [], scrolls: new Map(), navigating: false };
  const listeners = [];
  const on = (target, name, handler, options) => { target.addEventListener(name, handler, options); listeners.push(() => target.removeEventListener(name, handler, options)); };
  const all = (selector, root = doc) => [...root.querySelectorAll(selector)];
  const anchor = (label, space, id = "", view = "", help = "", symbol = "") => `<a href="${esc(routeHash(space, id, view))}" data-v2-route title="${esc(help || label)}">${symbol ? icon(symbol) : ""}<span>${esc(label)}</span></a>`;
  const statusMarkup = item => `<span class="v2-state" data-tone="${esc(item.state.tone)}">${esc(item.state.label)}</span>`;
  const announce = text => { const node = doc.querySelector("#cockpit-announcer"); if (node) node.textContent = text; };
  let css = doc.querySelector("#workspace-v2-style");
  if (!css) { css = doc.createElement("link"); css.id = "workspace-v2-style"; css.rel = "stylesheet"; css.href = new URL(`./workspace-v2.css?v=${WORKSPACE_VERSION}`, import.meta.url).href; doc.head.append(css); }
  doc.documentElement.dataset.workspace = "v2";
  const shell = doc.createElement("div"); shell.id = "workspace-v2";
  const classic = new URL(win.location.href); classic.searchParams.delete("interface"); classic.hash = "";
  shell.innerHTML = `<aside class="v2-sidebar"><a class="v2-brand" href="#/accueil" data-v2-route title="Retour à votre tableau de travail"><span class="v2-brand-mark" aria-hidden="true">≈</span><span>BLEU MASSAWIPPI<small>Le cockpit · aperçu V2</small></span></a><nav aria-label="Espaces de travail">${Object.entries(SPACES).map(([key, val]) => `<a data-v2-route href="${routeHash(key)}" data-v2-space="${key}" title="${esc(val.description)}"><span aria-hidden="true">${icon(val.icon)}</span>${val.label}</a>`).join("")}</nav><div class="v2-side-bottom"><p>Mêmes dossiers.<br>Une autre façon d’avancer.</p><a class="v2-classic-link" href="${esc(classic.href)}" title="Revenir à l’interface habituelle. Vos textes, choix et commentaires restent enregistrés dans la même base.">↩ Version classique</a><button type="button" data-v2-help title="Comprendre les espaces, les validations, les galeries et le retour à la version classique">${icon("help")} Aide à la navigation</button></div></aside><header class="v2-heading"><div><p class="v2-eyebrow">Notre espace de travail</p><h1 tabindex="-1" data-v2-title></h1><p data-v2-description></p></div><span class="v2-wave" aria-hidden="true">∿<br>∿</span></header><div class="v2-toolbar" data-v2-toolbar></div><section class="v2-panel" data-v2-panel></section><p class="v2-connection-note" data-v2-note>Les actions de cette V2 utilisent les données réelles du cockpit. Rien n’est envoyé aux réseaux sociaux.</p>`;
  host.before(shell);
  const footer = host.querySelector("footer"); if (footer && !footer.id) footer.id = "v2-classic-footer";
  const portable = doc.createElement("div"); portable.className = "v2-portable-tools";
  portable.innerHTML = `<button type="button" data-v2-help title="Ouvrir les explications de navigation et des validations">Aide</button><a href="${esc(classic.href)}" title="Revenir au cockpit habituel, avec les mêmes données">Version classique ↗</a>`;
  shell.querySelector(".v2-heading").append(portable);
  const heading = shell.querySelector("[data-v2-title]");
  const description = shell.querySelector("[data-v2-description]");
  const toolbar = shell.querySelector("[data-v2-toolbar]");
  const panel = shell.querySelector("[data-v2-panel]");
  const note = shell.querySelector("[data-v2-note]");
  const cardFor = id => all(".post[data-item-id]", host).find(node => node.dataset.itemId === id);
  const projectFor = id => all(".internal-project,.opportunity", host).find(node => (node.dataset.internalProjectId || node.dataset.opportunityId) === id || node.id === id);
  function publications() {
    return (api.getPosts?.() || []).map(item => {
      const card = cardFor(item.id);
      const wf = api.getWorkflow?.(item.id) || {};
      const decision = api.getDecision?.(item.id)?.decision || (card?.classList.contains("editorial-deferred") ? "deferred" : "");
      const stage = wf.stage || card?.dataset.workflowStage || "proposal";
      const contentApproved = api.contentApproved?.(item.id) ?? card?.querySelector('[data-gate="content"]')?.getAttribute("aria-pressed") === "true";
      const mediaApproved = api.mediaApproved?.(item.id) ?? card?.querySelector('[data-gate="media"]')?.getAttribute("aria-pressed") === "true";
      return { ...item, dateIso: api.dateIso?.(item) || item.dateIso || "", decision, state: publicationState({ stage, contentApproved, mediaApproved, decision }) };
    });
  }
  function subtabs(tabs, view) { return `<nav class="v2-tabs" aria-label="Vues">${tabs.map(([id, label, help]) => `<a data-v2-route href="${routeHash(state.route.space, "", id)}" ${view === id ? 'aria-current="page"' : ""} title="${esc(help || label)}">${icon(id === "calendrier" ? state.route.space === "projets" ? "projectCalendar" : "socialCalendar" : { liste: "list", archives: "archive", reserve: "history", actifs: "folder", occasions: "leaf", documents: "document", medias: "publications", guides: "library" }[id])}<span>${esc(label)}</span></a>`).join("")}</nav>`; }
  function previewFor(item) {
    if (state.previews?.has(item.id)) return state.previews.get(item.id);
    const rows = state.mediaRows?.get(item.id) || [];
    const choice = api.getMediaDecision?.(item.id);
    for (const candidate of previewCandidates(rows, choice)) {
      const url = safeLink(api.mediaPreview?.(candidate.row) || candidate.row.previewUrl);
      if (url) { const result = { ...candidate, url }; state.previews?.set(item.id, result); return result; }
    }
    // The original gallery remains a valid cached preview source, not a new read.
    const cards = all(".cockpit-media-card", cardFor(item.id) || doc.createElement("div"));
    const selected = cards.find(n => n.dataset.mediaDirectionSelected === "true") || cards.find(n => n.dataset.mediaCommunicationsSelected === "true") || cards[0];
    const source = selected?.querySelector("img[data-media-preview],.cockpit-media-preview img")?.getAttribute("src");
    if (!source) return null;
    const url = safeLink(new URL(source, win.location.href).href);
    const result = url ? { url, label: selected.dataset.mediaDirectionSelected === "true" ? "Choix de la direction" : selected.dataset.mediaCommunicationsSelected === "true" ? "Recommandation des communications" : "Proposition · choix à confirmer" } : null;
    state.previews?.set(item.id, result); return result;
  }
  function centerCurrentFrame() {
    const strip = panel.querySelector(".v2-date-filmstrip");
    const current = strip?.querySelector('[aria-current="page"]');
    if (strip && current) strip.scrollLeft += current.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - current.clientWidth) / 2;
  }
  const previewImage = preview => preview ? `<img class="v2-background-photo" src="${esc(preview.url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : "";
  function publicationNavigation(item) {
    const neighbours = publicationNeighbours(publications(), item.id);
    if (!neighbours.items.length) return "";
    const arrow = (post, next) => post ? `<a class="v2-date-arrow" data-v2-route href="${routeHash("publications", post.id)}" aria-label="${esc(`${next ? "Publication suivante" : "Publication précédente"} : ${prettyDate(post.dateIso)} — ${post.title}`)}" title="${esc(`${prettyDate(post.dateIso)} — ${post.title}. Consulter cette publication sans modifier les dates ni les validations.`)}"><b aria-hidden="true">${next ? "→" : "←"}</b><small>${next ? "Après" : "Avant"}</small></a>` : `<span class="v2-date-arrow" aria-disabled="true" title="${next ? "Fin" : "Début"} des publications datées"><b aria-hidden="true">${next ? "→" : "←"}</b><small>${next ? "Fin" : "Début"}</small></span>`;
    return `<nav class="v2-date-navigation" aria-label="Parcourir les publications dans l’ordre chronologique">${arrow(neighbours.previous, false)}<div class="v2-date-filmstrip">${neighbours.items.map(post => {
      const preview = previewFor(post);
      return `<a class="v2-date-frame${preview ? " v2-has-photo" : ""}" data-v2-route href="${routeHash("publications", post.id)}" data-date="${esc(post.dateIso)}" ${post.id === item.id ? 'aria-current="page"' : ""} title="${esc(`${prettyDate(post.dateIso)} — ${post.title}${preview ? ` · ${preview.label}` : " · aperçu non chargé"}`)}">${previewImage(preview)}<span class="v2-frame-copy"><small>${esc(prettyDate(post.dateIso, { weekday: "short", day: "numeric", month: "short" }))}</small><b>${esc(post.title)}</b>${post.id === item.id ? '<em>Vous êtes ici</em>' : ""}</span></a>`;
    }).join("")}</div>${arrow(neighbours.next, true)}</nav><p class="v2-strip-note">${neighbours.index + 1} / ${neighbours.total} publications datées · les flèches suivent les dates, sans modifier le calendrier.</p>`;
  }
  function searchMarkup(placeholder) { return `<label class="v2-search"><span aria-hidden="true">⌕</span><input data-v2-search type="search" value="${esc(state.query)}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"></label>`; }
  function resetVisibility() {
    all("[data-v2-concealed]", host).forEach(n => n.removeAttribute("data-v2-concealed"));
    all("[data-v2-path]", host).forEach(n => n.removeAttribute("data-v2-path"));
    all("[data-v2-target]", host).forEach(n => n.removeAttribute("data-v2-target"));
    all(":scope > *", host).forEach(n => n.setAttribute("data-v2-concealed", ""));
    host.setAttribute("data-v2-empty", "");
  }
  function reveal(target) {
    if (!target || !host.contains(target)) return false;
    let child = target;
    target.setAttribute("data-v2-target", "");
    while (child && child !== host) {
      child.removeAttribute("data-v2-concealed"); child.setAttribute("data-v2-path", "");
      if (child.tagName === "DETAILS") child.open = true;
      for (const sibling of child.parentElement?.children || []) if (sibling !== child) sibling.setAttribute("data-v2-concealed", "");
      child = child.parentElement;
    }
    host.removeAttribute("data-v2-empty");
    return true;
  }
  function move(node, parent) {
    if (!node || node.parentElement === parent) return;
    const marker = doc.createComment("workspace-v2: original position"); node.before(marker); state.moves.push({ node, marker }); parent.append(node);
  }
  function details(label, className = "") {
    const node = doc.createElement("details"); node.className = className;
    const summary = doc.createElement("summary"); summary.textContent = label; node.append(summary); return node;
  }
  function arrangeUtilities() {
    const controls = ["cockpit-task-launch", "cockpit-feedback-launch", "cockpit-sidebar-toggle", "cockpit-health-launch", "cockpit-motion-toggle"].map(id => doc.getElementById(id)).filter(Boolean);
    if (!controls.length) return;
    let dock = shell.querySelector(".v2-utilities");
    if (!dock) {
      dock = details("Outils et préférences", "v2-utilities");
      dock.querySelector("summary").title = "Retrouver la liste des tâches, les idées, le journal, le diagnostic et les préférences sans masquer les textes ni les images.";
      dock.querySelector("summary").insertAdjacentHTML("afterbegin", icon("tools"));
      const group = doc.createElement("div"); group.className = "v2-utility-buttons"; dock.append(group);
      toolbar.before(dock);
    }
    const group = dock.querySelector(".v2-utility-buttons");
    controls.forEach(node => move(node, group));
  }
  function transformCard(card) {
    if (!card || card.dataset.v2Prepared) return;
    card.dataset.v2Prepared = "true";
    const brief = card.querySelector(":scope > details");
    const copy = card.querySelector(".copy");
    const controls = card.querySelector(".cockpit-controls");
    if (!copy || !controls) { delete card.dataset.v2Prepared; return; }
    const body = doc.createElement("div"); body.className = "v2-publication-body";
    const reading = doc.createElement("section"); reading.className = "v2-reading"; reading.setAttribute("aria-label", "Texte proposé et versions");
    reading.innerHTML = `<div class="v2-section-label"><h2>Le texte proposé</h2><button type="button" data-v2-history title="Lire les versions sauvegardées, leur date et leur auteur. Consulter l’historique ne change pas le texte.">Historique du texte</button></div>`;
    move(copy, reading);
    const gallery = doc.createElement("section"); gallery.className = "v2-gallery-column"; gallery.setAttribute("aria-label", "Galerie des médias");
    move(card.querySelector(".cockpit-media"), gallery);
    const media = gallery.querySelector(".cockpit-media"); if (media) media.open = true;
    const add = details("Ajouter un média · lien et informations", "v2-add-media");
    const mediaBody = media?.querySelector(".cockpit-media-body");
    if (mediaBody) { move(mediaBody.querySelector("[data-media-form]"), add); move(mediaBody.querySelector(".cockpit-media-tools"), add); mediaBody.append(add); }
    const decision = doc.createElement("section"); decision.className = "v2-decisions"; move(card.querySelector(".cockpit-workflow"), decision);
    const conversation = doc.createElement("section"); conversation.className = "v2-conversation";
    move(card.querySelector(".cockpit-thread"), conversation); move(card.querySelector(".cockpit-comment-row"), conversation);
    const more = details("Brief, options, avis rapides et informations complémentaires", "v2-more");
    move(card.querySelector(".post-foot"), more); move(brief, more); move(controls, more);
    body.append(reading, gallery, decision, conversation, more); card.append(body);
    const copyValue = api.getPosts?.().find(p => p.id === card.dataset.itemId)?.copy || copy.textContent;
    const count = doc.createElement("p"); count.className = "v2-copy-count"; count.textContent = `${copyValue.length.toLocaleString("fr-CA")} / 2 200 caractères · texte bilingue complet`;
    if (copyValue.length > 2200) count.dataset.warning = "true"; reading.append(count);
    if (api.profile.role === "admin" && api.openStudio) { const button = doc.createElement("button"); button.type = "button"; button.dataset.v2Edit = ""; button.textContent = "Modifier dans le Studio"; button.title = "Ouvrir cette publication dans l’éditeur. Aucun changement n’est effectué avant l’enregistrement."; reading.querySelector(".v2-section-label").append(button); }
    card.querySelectorAll(".cockpit-workflow-help").forEach(n => { n.open = false; });
  }
  function enhanceGallery(card) {
    const gallery = card?.querySelector("[data-media-gallery]"); if (!gallery) return;
    gallery.onscroll = null;
    const items = all(".cockpit-media-card", gallery);
    const media = gallery.closest(".cockpit-media");
    let thumbs = media.querySelector(".v2-thumbnails");
    if (!thumbs) { thumbs = doc.createElement("div"); thumbs.className = "v2-thumbnails"; thumbs.setAttribute("aria-label", "Toutes les propositions de médias"); gallery.after(thumbs); }
    const signature = items.map(n => `${n.dataset.mediaId}:${n.querySelector("img")?.getAttribute("src") || ""}:${n.dataset.mediaCommunicationsSelected}:${n.dataset.mediaDirectionSelected}`).join("|");
    if (thumbs.dataset.signature !== signature) {
      thumbs.dataset.signature = signature;
      thumbs.innerHTML = items.map((item, i) => {
        const image = item.querySelector("img"); const title = image?.alt || item.querySelector(".cockpit-media-meta b")?.textContent || `Média ${i + 1}`;
        return `<button type="button" data-v2-thumbnail="${i}" title="${esc(`Afficher la proposition ${i + 1} : ${title}`)}" aria-label="${esc(`Proposition ${i + 1} : ${title}`)}">${image ? `<img src="${esc(image.getAttribute("src"))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span aria-hidden="true">▧</span>'}<small>${i + 1}${item.dataset.mediaDirectionSelected === "true" ? " · DG ✓" : item.dataset.mediaCommunicationsSelected === "true" ? " · COM ✓" : ""}</small></button>`;
      }).join("");
    }
    const selectedId = state.galleryIndex.get(card.dataset.itemId)
      || items.find(n => n.dataset.mediaDirectionSelected === "true")?.dataset.mediaId
      || items.find(n => n.dataset.mediaCommunicationsSelected === "true")?.dataset.mediaId;
    const index = Math.max(0, items.findIndex(n => n.dataset.mediaId === selectedId));
    const show = i => {
      const n = Math.max(0, Math.min(items.length - 1, i));
      items.forEach((node, j) => { node.toggleAttribute("data-v2-slide-hidden", j !== n); });
      all("[data-v2-thumbnail]", thumbs).forEach((node, j) => node.setAttribute("aria-pressed", String(j === n)));
      if (items[n]) state.galleryIndex.set(card.dataset.itemId, items[n].dataset.mediaId);
      const nav = media.querySelector("[data-media-nav]");
      if (nav) { nav.hidden = items.length < 2; const position = nav.querySelector("[data-media-position]"); if (position) position.textContent = `${n + 1} / ${items.length}`; const prev = nav.querySelector("[data-media-previous]"); const next = nav.querySelector("[data-media-next]"); if (prev) { prev.disabled = n <= 0; prev.onclick = () => show(n - 1); } if (next) { next.disabled = n >= items.length - 1; next.onclick = () => show(n + 1); } }
    };
    items.forEach(item => { const info = item.querySelector(".cockpit-media-info"); if (info && !info.dataset.v2Ready) { info.open = false; info.dataset.v2Ready = "true"; } });
    const hint = media.querySelector(".cockpit-media-swipe-hint");
    if (hint) hint.textContent = "Utilisez les miniatures ou les flèches pour parcourir les propositions. Cela ne change pas votre choix.";
    thumbs.onclick = e => { const b = e.target.closest("[data-v2-thumbnail]"); if (b) show(Number(b.dataset.v2Thumbnail)); };
    show(index);
  }
  function calendarDay(day, items) {
    const background = items.length === 1 ? previewFor(items[0]) : null;
    return `<section class="v2-day${day.startsWith(state.month) ? "" : " v2-outside"}${background ? " v2-has-photo" : ""}" ${day === todayKey() ? 'data-today="true"' : ""} aria-label="${esc(prettyDate(day))}">${previewImage(background)}<span class="v2-day-number">${Number(day.slice(-2))}</span>${items.map(item => {
      const preview = background || previewFor(item);
      return `<a data-v2-route class="v2-calendar-post${preview ? " v2-has-photo" : ""}" data-tone="${esc(item.state.tone)}" href="${routeHash("publications", item.id)}" title="${esc(`${item.title} · ${item.state.label}${preview ? ` · ${preview.label}` : " · aperçu non chargé"}`)}">${background ? "" : previewImage(preview)}<span>${esc(item.title)}<small>${esc(item.state.label)}</small></span></a>`;
    }).join("")}</section>`;
  }
  function agendaItem(item) {
    const preview = previewFor(item);
    return `<a data-v2-route class="${preview ? "v2-has-photo" : ""}" href="${routeHash("publications", item.id)}" title="${esc(`${prettyDate(item.dateIso)} — ${item.title}${preview ? ` · ${preview.label}` : ""}`)}">${previewImage(preview)}<span class="v2-agenda-copy"><small>${esc(prettyDate(item.dateIso))}</small><b>${esc(item.title)}</b>${statusMarkup(item)}</span></a>`;
  }
  function renderPublicationList(view) {
    const items = filterPublications(publications(), { view, query: state.query, status: state.status });
    toolbar.innerHTML = subtabs([["calendrier", "Calendrier", "Calendrier mensuel des réseaux sociaux — indépendant des échéances des projets"], ["liste", "Liste"], ["reserve", "À replanifier"], ["archives", "Passées et archives"]], view) + `<div class="v2-filters">${searchMarkup("Rechercher une publication…")}<label>État <select data-v2-status><option value="all">Tous les états</option><option value="waiting">À préparer / valider</option><option value="attention">Ajustement demandé</option><option value="ready">Prêt à programmer</option><option value="done">Terminé</option></select></label>${api.profile.role === "admin" ? '<button type="button" data-v2-studio title="Créer ou dupliquer une publication dans le Studio existant">Ouvrir le Studio</button>' : ""}</div>`;
    toolbar.querySelector("[data-v2-status]").value = state.status;
    if (view === "calendrier") {
      const byDay = new Map(); items.forEach(item => { const list = byDay.get(item.dateIso) || []; list.push(item); byDay.set(item.dateIso, list); });
      panel.innerHTML = `<div class="v2-calendar-heading"><div><h2>Calendrier des publications</h2><p>Un jour peut contenir des options à arbitrer; cela ne signifie pas plusieurs publications confirmées.</p></div><div><button type="button" data-v2-month="-1" title="Mois précédent">←</button><strong>${esc(prettyDate(`${state.month}-01`, { month: "long", year: "numeric" }))}</strong><button type="button" data-v2-month="1" title="Mois suivant">→</button><button type="button" data-v2-today title="Revenir au mois courant">Aujourd’hui</button></div></div><div class="v2-calendar" aria-label="Calendrier mensuel des publications">${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(d => `<div class="v2-weekday">${d}</div>`).join("")}${monthDays(state.month).map(day => calendarDay(day, byDay.get(day) || [])).join("")}</div>`;
      const calendar = panel.querySelector(".v2-calendar");
      const scroll = doc.createElement("div"); scroll.className = "v2-calendar-scroll"; scroll.tabIndex = 0; scroll.setAttribute("aria-label", "Calendrier mensuel, défilement horizontal sur petit écran"); calendar.before(scroll); scroll.append(calendar);
      const agenda = doc.createElement("section"); agenda.className = "v2-mobile-agenda";
      const list = items.filter(item => item.dateIso.startsWith(state.month));
      agenda.innerHTML = "<h3>Ce mois, en détail</h3>" + list.map(agendaItem).join("");
      if (!list.length) agenda.innerHTML += "<p>Aucune publication dans ce mois avec ces filtres.</p>";
      panel.append(agenda);
    } else panel.innerHTML = `<p class="v2-result-count">${items.length} publication${items.length === 1 ? "" : "s"}${view === "reserve" ? " · Les dates et validations ne sont pas modifiées par ce classement de lecture." : ""}</p><div class="v2-publication-list">${items.map(item => `<a data-v2-route class="v2-publication-row" href="${routeHash("publications", item.id)}"><div class="v2-date-tile${previewFor(item) ? " v2-has-photo" : ""}">${previewImage(previewFor(item))}<b>${esc(item.dateIso ? item.dateIso.slice(8) : "—")}</b><small>${esc(item.dateIso ? prettyDate(item.dateIso, { month: "short" }) : "à dater")}</small></div><div><small>${esc(item.t || "Publication")}</small><h2>${esc(item.title)}</h2><p>${esc(prettyDate(item.dateIso))}${item.optionLabel ? ` · ${esc(item.optionLabel)}` : ""}</p></div>${statusMarkup(item)}<span aria-hidden="true">→</span></a>`).join("") || '<p class="v2-empty">Aucune publication ne correspond à ces filtres.</p>'}</div>`;
    note.textContent = "Vue des publications chargées dans le registre. Passées et archives conserve aussi les versions et propositions classées; aucun déplacement automatique.";
  }
  function projectItems() {
    return all(".internal-project,.opportunity", host).map(node => ({ node, id: node.dataset.internalProjectId || node.dataset.opportunityId, title: node.querySelector(":scope > summary strong")?.textContent || node.id, archived: node.classList.contains("is-archived"), opportunity: node.classList.contains("opportunity"), status: node.querySelector("[data-internal-project-stage-label],[data-opportunity-stage-label]")?.textContent || "", next: node.querySelector(".internal-project-next,.opportunity-verdict")?.textContent || "" }));
  }
  function renderProjects(view) {
    toolbar.innerHTML = subtabs([["actifs", "Dossiers actifs"], ["calendrier", "Calendrier des projets"], ["occasions", "Occasions"], ["archives", "Archives"]], view) + searchMarkup("Rechercher un projet…");
    if (view === "calendrier") {
      const calendar = host.querySelector(".project-calendar-shell");
      if (calendar) { panel.innerHTML = '<p class="v2-intro">Les échéances, propositions et rendez-vous des projets. Ce calendrier ne déplace aucun post des réseaux sociaux.</p>'; reveal(calendar); }
      else panel.innerHTML = '<p role="status">Chargement du calendrier des projets…</p>';
    } else {
      const q = state.query.toLocaleLowerCase("fr"); const items = projectItems().filter(p => (view === "archives" ? p.archived : view === "occasions" ? p.opportunity && !p.archived : !p.archived && !p.opportunity) && (!q || `${p.title} ${p.next}`.toLocaleLowerCase("fr").includes(q)));
      panel.innerHTML = `<div class="v2-project-list">${items.map(item => `<a data-v2-route class="v2-project-tile" href="${routeHash("projets", item.id)}"><span class="v2-state" data-tone="${item.archived ? "muted" : "waiting"}">${esc(item.archived ? "Archivé · conservé" : item.status || "Dossier")}</span><span class="v2-topic-icon">${icon(topicIcon(item.title))}</span><h2>${esc(item.title)}</h2><p>${esc(item.next)}</p><span class="v2-tile-open">Ouvrir le dossier →</span></a>`).join("") || '<p class="v2-empty">Aucun dossier dans cette vue.</p>'}</div>`;
    }
    note.textContent = "Les projets archivés restent consultables sans les réactiver. Tous leurs documents, décisions et liens sont conservés.";
  }
  function documentItems() {
    const items = []; const seen = new Set();
    all('a[href]', host).forEach(link => {
      if (link.closest(".post,.v2-publication-body,#cockpit-essential-dashboard")) return;
      const href = safeLink(link.href); if (!href || !/sharepoint|1drv\.ms|\.pdf(?:$|\?)|\.docx?(?:$|\?)|\.xlsx?(?:$|\?)/i.test(href)) return;
      const owner = link.closest(".internal-project,.opportunity"); const label = link.textContent.trim(); if (!label) return;
      const key = `${owner?.id || ""}:${href}`; if (seen.has(key)) return; seen.add(key);
      items.push({ href, label, project: owner?.querySelector("summary strong")?.textContent || "Guides et références", owner: owner?.dataset.internalProjectId || owner?.dataset.opportunityId || "", archived: owner?.classList.contains("is-archived") === true });
    });
    return items;
  }
  function renderLibrary(view) {
    toolbar.innerHTML = subtabs([["documents", "Documents et dossiers"], ["medias", "Photos et vidéos"], ["guides", "Guides et méthodes"]], view) + searchMarkup("Rechercher un document ou un média…");
    const q = state.query.toLocaleLowerCase("fr");
    if (view === "guides") {
      panel.innerHTML = `<div class="v2-guide-links">${[["context-collapsible", "Contexte stratégique et collaboration"], ["production", "Rituels et canaux de production"], ["pilotage", "Repères de pilotage"], ["sources", "Sources et références"], ["v2-classic-footer", "À propos du cockpit · actualisation"]].map(([id, title]) => anchor(title, "bibliotheque", id, "guides")).join("")}</div>`;
      note.textContent = "Le cadre de collaboration, les validations du CA et les méthodes restent disponibles ici, à l’écart des tâches quotidiennes."; return;
    }
    if (view === "medias") {
      const media = api.getMedia?.() || [];
      const items = media.filter(m => !q || `${m.label} ${m.note} ${m.eventId}`.toLocaleLowerCase("fr").includes(q));
      panel.innerHTML = `<p class="v2-intro">${items.length} média${items.length === 1 ? "" : "s"} dans le cache chargé. Ouvrez une publication pour charger son contexte complet, y compris ses références. Ce nombre n’est pas le total de SharePoint.</p><div class="v2-library-grid">${items.map(m => `<article class="v2-document"><span class="v2-file-kind">${esc(m.kind || "Média")}${m.archived ? " · archivé" : ""}</span>${icon(m.kind === "image" || m.kind === "video" ? "publications" : "document")}<h2>${esc(m.label || "Média lié")}</h2><p>${esc(m.note || "")}</p>${anchor("Voir dans la publication →", "publications", m.eventId)}${safeLink(m.url) ? `<a href="${esc(safeLink(m.url))}" target="_blank" rel="noopener noreferrer">Ouvrir l’original ↗</a>` : ""}</article>`).join("") || '<p class="v2-empty">Aucun média correspondant parmi les éléments chargés.</p>'}</div>`;
      note.textContent = "Les références seules et les médias archivés ne sont ni supprimés ni approuvés par leur présence dans la bibliothèque."; return;
    }
    const items = documentItems().filter(item => !q || `${item.label} ${item.project}`.toLocaleLowerCase("fr").includes(q));
    panel.innerHTML = `<p class="v2-result-count">${items.length} référence${items.length === 1 ? "" : "s"} liée${items.length === 1 ? "" : "s"} aux dossiers du cockpit</p><div class="v2-library-grid">${items.map(item => `<article class="v2-document"><span class="v2-file-kind">${item.archived ? "Projet archivé" : "Document / dossier"}</span>${icon(/\.xlsx?/i.test(item.href) ? "list" : "document")}<h2>${esc(item.label)}</h2><p>${esc(item.project)}</p><a href="${esc(item.href)}" target="_blank" rel="noopener noreferrer" title="Ouvrir l’original avec votre session autorisée. Le document n’est pas copié ni déplacé.">Ouvrir l’original ↗</a>${item.owner ? anchor("Voir le contexte du projet", "projets", item.owner) : ""}</article>`).join("")}</div>`;
    note.textContent = "Les liens restent ceux des documents d’origine. Le contexte du projet permet de distinguer version courante, historique et restrictions d’utilisation.";
  }
  async function showHistory(card, reset = true) {
    const id = card.dataset.itemId;
    let holder = card.querySelector(".v2-text-history");
    if (!holder) { holder = details("Versions du texte · lecture seule", "v2-text-history"); card.querySelector(".v2-reading").append(holder); }
    holder.open = true;
    const original = api.getOriginalPost?.(id);
    if (reset) { const token = {}; state.historyTokens.set(id, token); holder.innerHTML = '<summary>Versions du texte · lecture seule</summary><p role="status">Chargement des versions sauvegardées…</p>'; state.histories.set(id, { items: [], cursor: null, token }); }
    const cache = state.histories.get(id); if (!cache) return;
    try {
      const page = await api.readHistory(id, { cursor: cache.cursor, pageSize: 12 });
      if (state.disposed || state.historyTokens.get(id) !== cache.token || !card.isConnected) return;
      const known = new Set(cache.items.map(item => item.id)); cache.items.push(...page.items.filter(item => !known.has(item.id))); cache.cursor = page.cursor;
      holder.innerHTML = `<summary>Versions du texte · lecture seule</summary><p>Les versions enregistrées sont présentées sans modifier le texte courant.</p>${cache.items.map(entry => {
        const after = entry.after?.editorial; const before = entry.before?.editorial;
        const when = entry.createdAt?.toDate?.().toLocaleString("fr-CA") || "Date non précisée";
        return `<details><summary>${esc(when)} · ${esc(entry.actorLabel || "Auteur non précisé")}${after?.revision ? ` · version ${after.revision}` : ""}</summary><p>${esc(entry.action || "Modification")}</p>${before?.copy ? `<h3>Avant</h3><pre>${esc(before.copy)}</pre>` : ""}${after?.copy ? `<h3>Après</h3><pre>${esc(after.copy)}</pre>` : '<p>Cette trace ne contient pas le texte complet.</p>'}</details>`;
      }).join("") || '<p>Aucune révision structurée enregistrée pour cette publication. Cela ne signifie pas qu’elle n’a jamais été ajustée avant la mise en place de cet historique.</p>'}${original?.copy ? `<details><summary>Texte du dossier source conservé</summary><pre>${esc(original.copy)}</pre></details>` : ""}${page.hasMore ? '<button type="button" data-v2-history-more>Charger les versions plus anciennes</button>' : '<p class="v2-copy-count">Fin de l’historique disponible.</p>'}`;
    } catch (error) { holder.innerHTML = `<summary>Versions du texte · lecture seule</summary><p role="alert">L’historique n’est pas accessible pour le moment. Le texte actuel est conservé.</p><p>${esc(error.message)}</p><button type="button" data-v2-history>Réessayer</button>${original?.copy ? `<details><summary>Texte du dossier source</summary><pre>${esc(original.copy)}</pre></details>` : ""}`; }
  }
  function render({ focus = false } = {}) {
    if (state.disposed || doc.body.classList.contains("cockpit-locked")) return;
    arrangeUtilities();
    state.previews = new Map(); state.mediaRows = new Map();
    for (const row of api.getMedia?.() || []) { const rows = state.mediaRows.get(row.eventId) || []; rows.push(row); state.mediaRows.set(row.eventId, rows); }
    const r = state.route; const space = SPACES[r.space];
    all(".v2-classic-link,.v2-portable-tools a", shell).forEach(link => { link.href = interfaceUrl(win.location.href, "classic", (api.getPosts?.() || []).map(p => p.id)); });
    resetVisibility(); toolbar.replaceChildren(); panel.replaceChildren();
    note.textContent = "V2 d’essai · données partagées avec le cockpit classique.";
    note.title = "Les commentaires, choix et validations sont réels et restent visibles dans les deux interfaces. Aucun contenu n’est envoyé aux réseaux sociaux.";
    shell.dataset.space = r.space; heading.textContent = space.title; description.textContent = space.description;
    all("[data-v2-space]", shell).forEach(n => { if (n.dataset.v2Space === r.space) n.setAttribute("aria-current", "page"); else n.removeAttribute("aria-current"); });
    if (r.legacy) {
      let id; try { id = decodeURIComponent(r.legacy); } catch { id = r.legacy; }
      const target = doc.getElementById(id);
      if (target && host.contains(target)) { heading.textContent = target.querySelector("h2,h3,summary strong")?.textContent || "Détail du cockpit"; reveal(target); toolbar.innerHTML = anchor("← Retour au tableau", "accueil"); }
      else { state.route = { space: "accueil", id: "", view: "", legacy: "" }; render({ focus }); return; }
    } else if (r.space === "accueil") {
      const dashboard = doc.querySelector("#cockpit-essential-dashboard");
      if (dashboard) reveal(dashboard); else panel.innerHTML = '<p role="status">Vos actions sont en cours de chargement…</p>';
      toolbar.innerHTML = `<div class="v2-home-links">${anchor("Décisions qui m’attendent", "accueil", "decisions", "", "Vos décisions personnelles, sans les demandes destinées à l’autre rôle.", "decisions")}${anchor("Messages actifs", "accueil", "messages", "", "Les messages non traités et non masqués des publications chargées. Le fil complet reste dans chaque publication.", "messages")}${anchor("Calendrier des publications", "publications", "", "calendrier", "Voir les publications Facebook et Instagram, leur visuel et leur validation.", "socialCalendar")}${anchor("Calendrier des projets", "projets", "", "calendrier", "Voir les échéances et rencontres des projets, sans déplacer les publications sociales.", "projectCalendar")}</div>`;
      if (r.id === "messages" || r.id === "decisions") { const sub = doc.querySelector(r.id === "messages" ? "#vm-panel-message" : "#vm-panel-decision"); if (sub) { resetVisibility(); reveal(sub); } }
    } else if (r.space === "publications" && r.id) {
      const item = publications().find(p => p.id === r.id);
      const card = api.ensurePublication?.(r.id) || cardFor(r.id);
      if (card && item) { transformCard(card); reveal(card); enhanceGallery(card); heading.textContent = item.title; description.textContent = `${prettyDate(item.dateIso)} · ${item.state.label}`; toolbar.innerHTML = `<div class="v2-detail-toolbar">${anchor("← Toutes les publications", "publications", "", "liste")}${anchor("Calendrier", "publications", "", "calendrier", "Retrouver ce mois dans le calendrier illustré des publications.", "socialCalendar")}${statusMarkup(item)}</div>`; state.month = item.dateIso ? item.dateIso.slice(0, 7) : state.month; panel.innerHTML = publicationNavigation(item); const strip = panel.querySelector(".v2-date-filmstrip"); const current = strip?.querySelector('[aria-current="page"]'); if (strip && current) strip.scrollLeft = Math.max(0, current.offsetLeft - strip.offsetLeft - (strip.clientWidth - current.clientWidth) / 2); if (state.lastEntity !== r.id) { state.lastEntity = r.id; win.dispatchEvent(new CustomEvent("cockpit:event-context-request", { detail: { eventId: r.id, source: "workspace-v2" } })); } }
      else panel.innerHTML = `<p role="alert">Cette publication n’est pas chargée dans le registre. Rien n’a été supprimé.</p>${anchor("Consulter le registre", "publications")}`;
    } else if (r.space === "publications") renderPublicationList(r.view || "calendrier");
    else if (r.space === "projets" && r.id) {
      const project = projectFor(r.id);
      if (project) { reveal(project); heading.textContent = project.querySelector("summary strong")?.textContent || "Projet"; description.textContent = project.classList.contains("is-archived") ? "Dossier archivé · consultation sans réactivation" : "Synthèse, actions, documents et échanges"; toolbar.innerHTML = `<div class="v2-detail-toolbar">${anchor("← Tous les projets", "projets")}${anchor("Calendrier des projets", "projets", "", "calendrier")}<button type="button" data-v2-project-docs title="Afficher les documents et liens conservés dans ce dossier">Documents de ce projet ↓</button></div>`; }
      else panel.innerHTML = '<p role="alert">Ce projet n’est pas chargé. Revenez à la liste pour le retrouver.</p>';
    } else if (r.space === "projets") renderProjects(r.view || "actifs");
    else if (r.space === "bibliotheque" && r.id) { const target = doc.getElementById(r.id); reveal(target); heading.textContent = target?.querySelector("h2,h3,summary")?.textContent || "Guide et méthode"; toolbar.innerHTML = anchor("← Guides et méthodes", "bibliotheque", "", "guides"); }
    else renderLibrary(r.view || "documents");
    if (!(r.space === "publications" && r.id)) state.lastEntity = "";
    win.requestAnimationFrame?.(centerCurrentFrame);
    if (focus) { heading.focus({ preventScroll: true }); win.scrollTo?.({ top: 0, behavior: "instant" }); announce(`${SPACES[r.space].label} · ${heading.textContent}`); }
  }
  function scheduleRender() { if (!state.timer) state.timer = win.setTimeout(() => { state.timer = 0; render(); }, 100); }
  function go(hash) {
    const currentKey = win.location.hash; state.scrolls.set(currentKey, win.scrollY || 0);
    state.route = parseRoute(hash); state.query = ""; state.status = "all";
    win.history.pushState(null, "", hash); render({ focus: true });
  }
  function routeForTarget(type, id) {
    if (type === "schedule" || type === "publication" || cardFor(id) || api.getPosts?.().some(p => p.id === id)) return routeHash("publications", id);
    if (["internal-project", "internalProject", "opportunity", "project"].includes(type) || projectFor(id)) return routeHash("projets", id);
    const target = doc.getElementById(id); return target && host.contains(target) ? `#${encodeURIComponent(id)}` : "";
  }
  function captureNavigation(e) {
    if (e.defaultPrevented || e.button > 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    // Handle only V2-owned reader controls before legacy card listeners can
    // refresh their context. Existing decision/comment writers keep bubbling.
    if (e.target.closest?.("[data-v2-history],[data-v2-history-more],[data-v2-edit]")) {
      e.preventDefault(); e.stopImmediatePropagation(); onClick(e); return;
    }
    const direct = e.target.closest?.("a[data-v2-route]");
    if (direct) { e.preventDefault(); e.stopImmediatePropagation(); go(direct.getAttribute("href")); return; }
    const target = e.target.closest?.("[data-vm-target],[data-open-task],[data-open-related-project],[data-open-monthly-post]");
    if (target) { const id = target.dataset.vmTarget || target.dataset.taskTarget || target.dataset.openRelatedProject || target.dataset.openMonthlyPost || ""; const type = target.dataset.vmEntityType || target.dataset.taskTargetType || (target.dataset.openRelatedProject ? "project" : "schedule"); const hash = routeForTarget(type, id); if (hash) { e.preventDefault(); if (target.dataset.vmMedia) state.galleryIndex.set(id, target.dataset.vmMedia); go(hash); if (!target.hasAttribute("data-vm-target")) e.stopImmediatePropagation(); return; } }
    const link = e.target.closest?.('a[href^="#"]');
    if (link && host.contains(link) && !link.hasAttribute("data-vm-open")) { const href = link.getAttribute("href"); if (href.startsWith("#/")) return; let id; try { id = decodeURIComponent(href.slice(1)); } catch { return; } const hash = routeForTarget("", id); if (hash) { e.preventDefault(); e.stopImmediatePropagation(); go(hash); } }
  }
  function onClick(e) {
    const card = e.target.closest?.(".post[data-item-id]");
    if (e.target.closest?.("[data-v2-history]")) { if (card) void showHistory(card); return; }
    if (e.target.closest?.("[data-v2-history-more]")) { if (card) void showHistory(card, false); return; }
    if (e.target.closest?.("[data-v2-edit]")) { api.openStudio?.(card?.dataset.itemId); return; }
    if (e.target.closest?.("[data-v2-studio]")) { api.openStudio?.(); return; }
    const month = e.target.closest?.("[data-v2-month]"); if (month) { state.month = shiftMonth(state.month, Number(month.dataset.v2Month)); render(); return; }
    if (e.target.closest?.("[data-v2-today]")) { state.month = todayKey().slice(0, 7); render(); return; }
    if (e.target.closest?.("[data-v2-project-docs]")) { const project = projectFor(state.route.id); const target = project?.querySelector('.internal-project-documents, .internal-project-files, .document-card, a[href*="sharepoint"]'); if (target) { for (let n = target; n && n !== project; n = n.parentElement) if (n.tagName === "DETAILS") n.open = true; target.scrollIntoView?.({ behavior: "smooth", block: "center" }); target.focus?.({ preventScroll: true }); } return; }
    if (e.target.closest?.("[data-v2-help]")) {
      const help = doc.createElement("dialog"); help.className = "v2-help-dialog";
      help.innerHTML = `<h2>Un cockpit, deux interfaces</h2><p>Cette V2 est une autre présentation des mêmes dossiers. Les choix, commentaires et validations sont réels et sont aussi visibles dans la version classique.</p><dl><dt>À faire</dt><dd>Vos validations personnelles et les messages récents.</dd><dt>Publications</dt><dd>Un calendrier propre aux réseaux sociaux. Ouvrez une publication pour lire son texte, parcourir toutes les images, consulter l’historique ou déplier les informations complémentaires.</dd><dt>Projets</dt><dd>Les dossiers et leur calendrier distinct. Les archives restent accessibles.</dd><dt>Bibliothèque</dt><dd>Les documents, médias chargés et guides, avec leurs liens d’origine.</dd></dl><p>Les boutons nomment leurs actions. Sur ordinateur, laissez le pointeur dessus pour plus de détails. Sur mobile, les informations et aides dépliables restent accessibles au toucher. Aucun message n’est envoyé automatiquement.</p><p>Le Studio reste réservé aux communications. Revenir à la version classique ne restaure pas une ancienne base : vos nouveaux travaux sont conservés.</p><form method="dialog"><button>J’ai compris</button></form>`;
      doc.body.append(help); help.addEventListener("close", () => help.remove(), { once: true }); help.showModal();
    }
  }
  on(doc, "click", captureNavigation, true); on(doc, "click", onClick);
  on(toolbar, "input", e => { if (!e.target.matches("[data-v2-search]")) return; state.query = e.target.value; const position = e.target.selectionStart; render(); const next = toolbar.querySelector("[data-v2-search]"); next?.focus(); try { next?.setSelectionRange(position, position); } catch {} });
  on(toolbar, "change", e => { if (e.target.matches("[data-v2-status]")) { state.status = e.target.value; render(); } });
  const onLocation = () => { state.route = parseRoute(win.location.hash); state.query = ""; render({ focus: true }); const y = state.scrolls.get(win.location.hash); if (y) win.scrollTo?.(0, y); };
  on(win, "popstate", onLocation); on(win, "hashchange", onLocation); on(win, "cockpit:data-updated", scheduleRender);
  on(win, "resize", centerCurrentFrame); on(css, "load", centerCurrentFrame);
  on(win, "cockpit:entity-will-open", event => {
    const {type, id, mediaId} = event.detail || {}; const hash = routeForTarget(type, id);
    if (mediaId) state.galleryIndex.set(id, mediaId);
    if (hash && hash !== win.location.hash) go(hash); else if (hash && mediaId) render();
  });
  if (win.navigator?.serviceWorker) on(win.navigator.serviceWorker, "message", event => { if (event.data?.type === "cockpit-open-attention") go(routeHash("accueil", "decisions")); });
  on(win, "cockpit:content-ready", scheduleRender);
  // Only structural replacements matter. Class/style changes from this view must
  // not feed the classic observer and create an unbounded render loop.
  const observer = new MutationObserver(changes => {
    if (changes.some(change => [...change.addedNodes].some(node => node.nodeType === 1 && (node.matches?.(".post,.project-calendar-shell,.cockpit-media-card") || node.querySelector?.(".post,.cockpit-media-card"))))) scheduleRender();
  });
  observer.observe(host, { childList: true, subtree: true });
  render();
  return { refresh: scheduleRender, navigate: go, destroy() {
    state.disposed = true; win.clearTimeout(state.timer); observer.disconnect(); listeners.forEach(remove => remove());
    for (const { node, marker } of state.moves.reverse()) { if (marker.isConnected) { marker.replaceWith(node); } }
    all(".v2-publication-body,.v2-thumbnails", host).forEach(node => node.remove());
    all("[data-v2-prepared],[data-v2-slide-hidden],[data-v2-concealed],[data-v2-target],[data-v2-path]", host).forEach(node => ["data-v2-prepared", "data-v2-slide-hidden", "data-v2-concealed", "data-v2-target", "data-v2-path"].forEach(attr => node.removeAttribute(attr)));
    host.removeAttribute("data-v2-empty"); shell.remove(); css.remove(); delete doc.documentElement.dataset.workspace;
  } };
}
