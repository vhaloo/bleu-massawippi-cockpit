import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { sharePointVideoUrl, sharePointVideoMarkup, setupSharePointVideos, setupSharePointVideoLifecycle, patchVideoGallery, stopSharePointVideos } from './sharepoint-video.mjs';

const origin = 'https://bleumassawippi.sharepoint.com';
const row = {kind:'video', url:origin + '/Documents%20partages/Media%20Cockpit/%C3%89t%C3%A9.mp4?web=1&download=1', label:'Vidéo <été>', previewDataWidth:720, previewDataHeight:1280};
const resolved = new URL(sharePointVideoUrl(row));
assert.equal(resolved.origin, origin);
assert.equal(resolved.pathname, '/_layouts/15/embed.aspx');
assert.equal(resolved.searchParams.get('Id'), '/Documents partages/Media Cockpit/Été.mp4');
assert.equal([...resolved.searchParams].length, 1);
for (const prefix of ['/sites/Ecologie', '/teams/Eau', '/personal/communication_bleu_com']) {
  const result = new URL(sharePointVideoUrl({...row, url:origin + prefix + '/Documents/a.mp4'}));
  assert.equal(result.pathname, prefix + '/_layouts/15/embed.aspx');
  assert.equal(result.searchParams.get('Id'), prefix + '/Documents/a.mp4');
}
assert.equal(new URL(sharePointVideoUrl({...row,url:origin+'/:v:/r/sites/Eau/Documents/a.mp4?csf=1&e=unused'})).searchParams.get('Id'), '/sites/Eau/Documents/a.mp4');
const guid = '6bf20f9b-9a63-4b5c-810f-2b540a2850b0';
for (const query of [`UniqueId=${guid}`, `sourcedoc=%7B${guid}%7D`]) {
  assert.equal(new URL(sharePointVideoUrl({...row,url:origin+'/_layouts/15/embed.aspx?'+query})).searchParams.get('UniqueId'), guid);
}
assert.equal(sharePointVideoUrl({kind:'video',url:resolved.href}), resolved.href);
assert.equal(sharePointVideoUrl({...row,url:origin+'/:v:/g/opaque',previewUrl:row.url}),resolved.href,'Un ancien lien résolu garde son URL d’origine.');
assert.equal(sharePointVideoUrl({...row,url:origin+'/:v:/g/opaque',previewUrl:'https://other.sharepoint.com/a.mp4'}),'');
for (const url of ['http://bleumassawippi.sharepoint.com/a.mp4','javascript:alert(1)',origin+':8443/a.mp4','https://me:secret@bleumassawippi.sharepoint.com/a.mp4','https://bleumassawippi.sharepoint.com.evil.test/a.mp4','https://other.sharepoint.com/a.mp4',origin+'/image.jpg',origin+'/:v:/s/Team/OpaqueToken',origin+'/_layouts/15/embed.aspx?Id=https://evil.test/a.mp4',origin+'/Documents/%00/a.mp4',origin+'/_layouts/15/embed.aspx?UniqueId=not-a-guid',origin+'/_layouts/15/embed.aspx?Id=%2FDocuments%2F..%2Fa.mp4']) {
  assert.equal(sharePointVideoUrl({...row,url}), '', `Refuse ${url}`);
}
assert.equal(sharePointVideoUrl({...row,kind:'image'}), '');
assert.equal(sharePointVideoMarkup({...row,kind:'image'}), '');

const {document,window} = parseHTML('<html><body><div id="gallery"></div></body></html>');
const gallery = document.querySelector('#gallery');
const article = (id, r=row, status='pending') => `<article class="cockpit-media-card" data-media-id="${id}" data-status="${status}">${sharePointVideoMarkup(r)}<p>${status}</p><button data-approval>Choisir</button></article>`;
patchVideoGallery(gallery, article('one') + article('two',{...row,url:origin+'/Documents/b.mp4'}));
setupSharePointVideos(gallery); setupSharePointVideos(gallery);
setupSharePointVideoLifecycle(document); setupSharePointVideoLifecycle(document);
assert.equal(gallery.querySelectorAll('iframe').length, 0, 'Aucune requête vidéo avant le clic.');
assert.equal(gallery.querySelector('[data-video-launch]').getAttribute('aria-label'), 'Afficher le lecteur — Vidéo <été>');
assert.equal(gallery.querySelector('[data-sharepoint-video]').style.getPropertyValue('--video-ratio'), '0.5625');
gallery.querySelector('[data-video-launch]').click();
const frame = gallery.querySelector('iframe');
assert.equal(frame.getAttribute('src'), resolved.href);
assert.equal(frame.title, 'Lecture — Vidéo <été>');
assert.equal(frame.allow, 'fullscreen');
assert.equal(frame.hasAttribute('autoplay'), false);
assert.equal(frame.parentNode.closest('a'), null, 'Lecteur jamais imbriqué dans un lien.');
patchVideoGallery(gallery, article('one',row,'approved') + article('two',{...row,url:origin+'/Documents/b.mp4'}));
assert.equal(gallery.querySelector('iframe'), frame, 'La validation en temps réel conserve le lecteur monté.');
assert.equal(frame.parentNode.closest('article').dataset.status, 'approved');
assert.equal(frame.parentNode.closest('article').querySelector(':scope > p').textContent, 'approved');
gallery.children[1].querySelector('[data-video-launch]').click();
assert.equal(gallery.querySelectorAll('iframe').length, 1, 'Une seule vidéo chargée à la fois.');
assert.equal(gallery.children[0].querySelector('[data-video-launch]') !== null, true);
gallery.querySelector('[data-video-open] [data-video-close]').click();
assert.equal(gallery.querySelectorAll('iframe').length, 0, 'Fermer arrête la lecture.');
gallery.querySelector('[data-video-launch]').click();
window.dispatchEvent(new window.Event('hashchange'));
assert.equal(gallery.querySelectorAll('iframe').length, 0, 'Quitter une fiche arrête la lecture.');
gallery.querySelector('[data-video-launch]').click();
patchVideoGallery(gallery, article('one',{...row,url:origin+'/Documents/new.mp4'}));
assert.equal(gallery.querySelectorAll('iframe').length, 0, 'Changer de fichier ne conserve pas l’ancien lecteur.');
gallery.querySelector('[data-video-launch]').click();
patchVideoGallery(gallery, '');
assert.equal(gallery.children.length, 0);
stopSharePointVideos(document);

const workflow = fs.readFileSync(new URL('../.github/workflows/deploy-pages.yml',import.meta.url),'utf8');
const worker = fs.readFileSync(new URL('./sw.js',import.meta.url),'utf8');
assert.match(workflow,/cp cockpit\/sharepoint-video\.mjs public\//);
assert.match(worker,/sharepoint-video\.mjs/);
assert.match(workflow,/test:sharepoint-video/);
console.log('SharePoint video: trusted canonical/embed URLs, escaping, lazy loading, one player, realtime refresh, close, route change, file replacement, removal and deployment verified.');
