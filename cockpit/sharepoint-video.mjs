// The Microsoft player reads the original with the viewer's SharePoint session.
// No file copy, download token, access grant or Firestore mutation is involved.
const VIDEO_HOSTS = new Set(['bleumassawippi.sharepoint.com', 'bleumassawippi-my.sharepoint.com']);
const GUID = /^\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?$/i;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function sharePointVideoUrl(row) {
  if (row?.kind !== 'video') return '';
  try {
    const url = new URL(row.url);
    if (url.protocol !== 'https:' || !VIDEO_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) return '';
    // Canonical paths and SharePoint's /:v:/r/ links retain the original site.
    const pathname = decodeURIComponent(url.pathname).replace(/^\/:v:\/r(?=\/)/i, '');
    const layout = pathname.match(/^(.*?)\/_layouts\/15\/(?:embed|stream|viewer)\.aspx$/i);
    const site = pathname.match(/^\/(?:sites|teams|personal)\/[^/]+(?=\/)/i)?.[0] || '';
    const embed = new URL(`${layout ? layout[1] : site}/_layouts/15/embed.aspx`, url.origin);
    if (layout) {
      const params = new Map([...url.searchParams].map(([key, value]) => [key.toLowerCase(), value]));
      const uniqueId = (params.get('uniqueid') || params.get('sourcedoc') || '').match(GUID)?.[1];
      if (uniqueId) embed.searchParams.set('UniqueId', uniqueId.toLowerCase());
      else {
        const file = params.get('id') || '';
        if (!validVideoPath(file) || !file.startsWith((layout[1] || '') + '/')) return '';
        embed.searchParams.set('Id', file);
      }
    } else {
      if (!validVideoPath(pathname)) {
        // Older sharing links may keep a resolved player path in previewUrl.
        if (/^\/:v:\/[sg]\//i.test(pathname) && row.previewUrl && new URL(row.previewUrl).origin === url.origin) {
          return sharePointVideoUrl({...row, url:row.previewUrl, previewUrl:''});
        }
        return '';
      }
      embed.searchParams.set('Id', pathname);
    }
    return embed.href;
  } catch { return ''; }
}

function validVideoPath(path) {
  return path.startsWith('/') && !path.startsWith('//') && !/[\\\u0000-\u001f?#]/.test(path)
    && !path.split('/').some(part => part === '..' || part === '.')
    && /\.(mp4|m4v|mov|webm|wmv|avi)$/i.test(path);
}

export function sharePointVideoMarkup(row, poster = '') {
  const source = sharePointVideoUrl(row);
  if (!source) return '';
  const label = row.label || 'Vidéo';
  const width = Number(row.previewDataWidth), height = Number(row.previewDataHeight);
  const ratio = width > 0 && width <= 10000 && height > 0 && height <= 10000 ? width / height : 16 / 9;
  return `<div class="cockpit-media-preview cockpit-media-video" data-sharepoint-video data-video-source="${esc(source)}" data-video-label="${esc(label)}" style="--video-ratio:${ratio}">
    <div class="cockpit-video-screen" data-video-screen>
      <button type="button" class="cockpit-video-launch" data-video-launch aria-label="Afficher le lecteur — ${esc(label)}">
        ${poster ? `<img src="${esc(poster)}" alt="" loading="lazy" decoding="async">` : ''}
        <span class="cockpit-video-play" aria-hidden="true">▶</span><span class="cockpit-video-label">Lire la vidéo</span>
      </button>
    </div>
    <button type="button" class="cockpit-video-close" data-video-close hidden>Fermer le lecteur</button>
    <details class="cockpit-video-help"><summary>Aide à la lecture</summary><p>Le lecteur utilise votre accès habituel à SharePoint. Si une connexion est demandée, ouvrez l’original dans SharePoint, puis revenez ici et rouvrez le lecteur.</p></details>
  </div>`;
}

const launchers = new WeakMap();
const observers = new WeakMap();

export function stopSharePointVideos(root) {
  for (const player of root.querySelectorAll('[data-sharepoint-video][data-video-open]')) {
    observers.get(player)?.disconnect();
    observers.delete(player);
    // Removing the frame stops playback; never send commands to a foreign frame.
    player.querySelector('[data-video-screen]').replaceChildren(launchers.get(player));
    player.querySelector('[data-video-close]').hidden = true;
    player.removeAttribute('data-video-open');
  }
}

export function setupSharePointVideos(gallery) {
  if (gallery.dataset.videoControlsReady) return;
  gallery.dataset.videoControlsReady = 'true';
  gallery.addEventListener('click', event => {
    const launch = event.target.closest('[data-video-launch]');
    const close = event.target.closest('[data-video-close]');
    if (!launch && !close) return;
    const player = (launch || close).closest('[data-sharepoint-video]');
    if (!player || !gallery.contains(player)) return;
    event.preventDefault();
    if (close) { stopSharePointVideos(gallery); launchers.get(player)?.focus(); return; }
    const doc = gallery.ownerDocument;
    const source = sharePointVideoUrl({ kind:'video', url:player.dataset.videoSource });
    if (!source) return;
    stopSharePointVideos(doc);
    launchers.set(player, launch);
    const frame = doc.createElement('iframe');
    frame.src = source;
    frame.title = `Lecture — ${player.dataset.videoLabel}`;
    frame.allow = 'fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.dataset.sharepointPlayer = 'true';
    player.querySelector('[data-video-screen]').replaceChildren(frame);
    player.setAttribute('data-video-open', 'true');
    player.querySelector('[data-video-close]').hidden = false;
    frame.focus();
    const Observer = doc.defaultView?.IntersectionObserver;
    if (Observer) {
      const observer = new Observer(entries => {
        if (entries.some(entry => !entry.isIntersecting)) stopSharePointVideos(gallery);
      });
      observer.observe(player);
      observers.set(player, observer);
    }
  });
}

const installed = new WeakSet();
export function setupSharePointVideoLifecycle(doc) {
  if (installed.has(doc)) return;
  installed.add(doc);
  doc.defaultView?.addEventListener('hashchange', () => stopSharePointVideos(doc));
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) stopSharePointVideos(doc); });
  doc.addEventListener('toggle', event => {
    if (event.target.tagName === 'DETAILS' && !event.target.open) stopSharePointVideos(event.target);
  }, true);
}

// Keep a playing frame mounted when a realtime approval refreshes its card.
// Updating sibling controls must not interrupt playback or reset its position.
export function patchVideoGallery(gallery, markup) {
  const template = gallery.ownerDocument.createElement('template');
  template.innerHTML = markup;
  const next = [...template.content.children];
  const old = new Map([...gallery.children].map(card => [card.dataset.mediaId, card]));
  const wanted = new Set(next.map(card => card.dataset.mediaId));
  for (const card of [...gallery.children]) if (!wanted.has(card.dataset.mediaId)) { stopSharePointVideos(card); card.remove(); }
  for (const [index, candidate] of next.entries()) {
    let card = old.get(candidate.dataset.mediaId);
    const player = card?.querySelector('[data-sharepoint-video][data-video-open]');
    const replacement = candidate.querySelector('[data-sharepoint-video]');
    if (player && replacement?.dataset.videoSource === player.dataset.videoSource) {
      for (const attribute of [...card.attributes]) if (!candidate.hasAttribute(attribute.name)) card.removeAttribute(attribute.name);
      for (const attribute of [...candidate.attributes]) card.setAttribute(attribute.name, attribute.value);
      for (const child of [...card.childNodes]) if (child !== player) child.remove();
      for (const child of [...candidate.childNodes]) if (child !== replacement) card.append(child);
    } else {
      if (card) { stopSharePointVideos(card); card.replaceWith(candidate); }
      card = candidate;
    }
    if (gallery.children[index] !== card) {
      stopSharePointVideos(card);
      gallery.insertBefore(card, gallery.children[index] || null);
    }
  }
}
