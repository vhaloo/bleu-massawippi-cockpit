/** Presentation and calculations only. No real contact data belongs in this file. */
export const MEMBER_SEGMENTS=Object.freeze({members:'Membres · don monétaire documenté',all:'Toutes les fiches du registre',inKind:'Soutiens en nature seulement',unlinked:'Contacts sans versement rattaché',review:'Identités à rapprocher'});
export const normalizeMemberSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-CA').trim();
export const memberMoney=cents=>Number.isSafeInteger(cents)?new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100):'—';
export const memberStatus=r=>r.isMember?'Membre · don documenté':r.hasInKind?'Soutien en nature':'Contact · don à documenter';
export function validateMemberManifest(m){
  if(!m||m.schemaVersion!==1||!/^registre-[a-f0-9]{20}$/.test(m.snapshotId)||!Number.isInteger(m.rowCount)||m.rowCount<1||m.rowCount>2000||!Array.isArray(m.chunkIds)||m.chunkIds.length<1||m.chunkIds.length>20||new Set(m.chunkIds).size!==m.chunkIds.length||m.chunkIds.some(x=>!/^philanthropie-membres-\d{2}$/.test(x)))throw Error('Le registre des membres n’est pas au format attendu.');
  if(!m.source||!/^https:\/\/bleumassawippi\.sharepoint\.com\//i.test(m.source.url)||!Number.isFinite(Date.parse(m.source.checkedAt))||!Number.isFinite(Date.parse(m.generatedAt))||!Array.isArray(m.years)||m.years.some(y=>!Number.isInteger(y)||y<1900||y>2100))throw Error('La provenance du registre est incomplète.');
  return m;
}
export function validateMemberRegistry(payload){
  const m=validateMemberManifest(payload?.manifest),chunks=payload.chunks;
  if(!Array.isArray(chunks)||chunks.length!==m.chunkIds.length)throw Error('Une partie du registre n’a pas pu être chargée.');
  const chunkIds=new Set(),ids=new Set(),paymentKeys=new Set(),rows=[];
  for(const chunk of chunks){if(chunkIds.has(chunk.id)||!m.chunkIds.includes(chunk.id)||chunk.data?.snapshotId!==m.snapshotId||!Array.isArray(chunk.data.rows)||chunk.data.rows.length>100)throw Error('Le registre a changé pendant sa lecture. Actualisez pour charger une version cohérente.');chunkIds.add(chunk.id);
    for(const r of chunk.data.rows){if(!/^\d+$/.test(r.id)||ids.has(r.id)||typeof r.name!=='string'||!r.name||!Array.isArray(r.payments)||!Array.isArray(r.history)||!Array.isArray(r.related)||!r.monetary||!r.inKind)throw Error('Fiche absente, invalide ou en double.');ids.add(r.id);
      for(const p of r.payments){if(typeof p.key!=='string'||!p.key||paymentKeys.has(p.key)||!Number.isSafeInteger(p.netCents)||!m.years.includes(p.year)||!['Monétaire','Nature'].includes(p.kind))throw Error('Versement invalide ou compté deux fois.');paymentKeys.add(p.key);}
      const member=r.payments.some(p=>p.kind==='Monétaire'&&p.netCents>0),inKind=r.payments.some(p=>p.kind==='Nature'&&p.netCents>0);
      if(r.isMember!==member||r.hasInKind!==inKind)throw Error('Le statut de membre ne correspond pas aux versements.');
      for(const year of m.years)for(const [kind,values]of [['Monétaire',r.monetary],['Nature',r.inKind]]){const v=values[year];if(v!=null&&!Number.isSafeInteger(v))throw Error('Montant de fiche invalide.');if((v??0)!==r.payments.filter(p=>p.year===year&&p.kind===kind).reduce((n,p)=>n+p.netCents,0))throw Error('Les montants de la fiche et ses pièces ne concordent pas.');}
      rows.push(r);
    }
  }
  if(rows.length!==m.rowCount||paymentKeys.size!==m.paymentCount||rows.reduce((n,r)=>n+r.history.length,0)!==m.historyCount)throw Error('Le registre chargé est incomplet.');
  const stats={...memberStatistics(rows),inKindOnlyFiles:rows.filter(r=>r.hasInKind&&!r.isMember).length,withoutDocumentedPayment:rows.filter(r=>!r.payments.length).length};
  for(const k of ['files','memberFiles','inKindOnlyFiles','withoutDocumentedPayment','withPhone','withEmail','reviewFiles'])if(m.stats?.[k]!==stats[k])throw Error('Les statistiques et les fiches ne concordent pas.');
  for(const y of m.years){const stated=m.yearly?.find(x=>x.year===y),actual=memberStatistics(rows,y);if(!stated||['memberFiles','monetaryCents','inKindCents'].some(k=>stated[k]!==actual[k]))throw Error('Le bilan annuel ne correspond pas aux versements.');}
  return {manifest:m,rows};
}
export function filterMembers(rows,{search='',segment='members',language='all',year='all',contact='all',sort='name'}={}){
  const q=normalizeMemberSearch(search),digits=q.replace(/\D/g,'');
  const result=rows.filter(r=>(segment==='all'||segment==='members'&&r.isMember||segment==='inKind'&&r.hasInKind&&!r.isMember||segment==='unlinked'&&!r.payments.length||segment==='review'&&r.needsReview)
    &&(language==='all'||r.language===language)&&(year==='all'||r.payments.some(p=>p.year===Number(year)&&p.netCents>0))
    &&(contact==='all'||contact==='phone'&&r.phone||contact==='email'&&r.email||contact==='none'&&!r.phone&&!r.email)
    &&(!q||normalizeMemberSearch([r.id,r.name,r.phone,r.email,r.organisation,r.origin,r.historicalNotes,r.identityNote].join(' ')).includes(q)||digits.length>=4&&String(r.phone).replace(/\D/g,'').includes(digits)));
  const total=r=>r.payments.filter(p=>p.kind==='Monétaire'&&(year==='all'||p.year===Number(year))).reduce((n,p)=>n+p.netCents,0),latest=r=>r.payments.find(p=>year==='all'||p.year===Number(year))?.date||'';
  return result.sort((a,b)=>sort==='total'?total(b)-total(a)||a.name.localeCompare(b.name,'fr-CA'):sort==='recent'?latest(b).localeCompare(latest(a))||a.name.localeCompare(b.name,'fr-CA'):a.name.localeCompare(b.name,'fr-CA',{sensitivity:'base'})||Number(a.id)-Number(b.id));
}
export function memberStatistics(rows,year='all'){
  const payments=rows.flatMap(r=>r.payments.filter(p=>year==='all'||p.year===Number(year))),monetary=payments.filter(p=>p.kind==='Monétaire'),nature=payments.filter(p=>p.kind==='Nature');
  return {files:rows.length,memberFiles:rows.filter(r=>r.payments.some(p=>p.kind==='Monétaire'&&p.netCents>0&&(year==='all'||p.year===Number(year)))).length,
    withPhone:rows.filter(r=>r.phone).length,withEmail:rows.filter(r=>r.email).length,reviewFiles:rows.filter(r=>r.needsReview).length,payments:payments.length,
    monetaryCents:monetary.reduce((n,p)=>n+p.netCents,0),inKindCents:nature.reduce((n,p)=>n+p.netCents,0)};
}
export function memberYearly(rows,years){return years.map(year=>({year,...memberStatistics(rows,year)}));}
export function memberExportRows(rows,years){return rows.map(r=>({id:r.id,name:r.name,status:memberStatus(r),language:r.language,phone:r.phone,email:r.email,
  ...Object.fromEntries(years.flatMap(y=>[[`monetary${y}`,r.monetary[y]==null?'':r.monetary[y]/100],[`inKind${y}`,r.inKind[y]==null?'':r.inKind[y]/100]])),
  organisation:r.organisation,caller:r.caller,beforeCall:r.beforeCall,callResult:r.callResult,callDate:r.callDate,followUp:r.followUp,recurrence:r.recurrence,
  historicalNotes:r.historicalNotes,origin:r.origin,identityNote:r.identityNote,related:r.related.map(x=>`#${x.id} · ${x.name} · ${x.reason}`).join(' | '),source:`Contacts!A${r.sourceRow}`}));}
