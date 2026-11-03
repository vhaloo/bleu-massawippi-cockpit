/** Private evidence stays in Firestore. This module contains presentation rules only. */
export const PHILANTHROPY_VIEWS = Object.freeze({ensemble:'Vue d’ensemble', leviers:'Leviers', actions:'Plan d’action', programmes:'Programmes', scenarios:'Simulateur', documents:'Documents'});
export const PHILANTHROPY_STAGES = Object.freeze({watch:'Proposition', research:'À approfondir', active:'En cours', submitted:'Transmis', completed:'Clos'});
export const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function secureUrl(value) { try { const u=new URL(String(value)); return u.protocol==='https:'&&!u.username&&!u.password?u.href:''; } catch { return ''; } }
export const money = (value, decimals=0) => Number.isFinite(value) ? new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD',minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(value) : '—';
export function civilDate(value) { if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return '';const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?new Intl.DateTimeFormat('fr-CA',{year:'numeric',month:'long',day:'numeric',timeZone:'America/Toronto'}).format(d):''; }
export function progress(actual,target) { if(!Number.isFinite(actual)||!Number.isFinite(target)||target<=0)return null;return {percent:actual/target*100,fill:Math.min(100,Math.max(0,actual/target*100)),gap:Math.max(0,target-actual)}; }
export function trackingStage(fallback,...candidates) {let best=null,latest=-Infinity;for(const row of candidates){if(!row||!Object.hasOwn(PHILANTHROPY_STAGES,row.stage))continue;const t=row.updatedAt;let ms=typeof t?.toMillis==='function'?t.toMillis():Number.isFinite(t?.seconds)?t.seconds*1000:Number.isFinite(t?._firestoreTimestamp?.seconds)?t._firestoreTimestamp.seconds*1000:Date.parse(t);if(!Number.isFinite(ms))ms=0;if(ms>=latest){best=row;latest=ms;}}return best?.stage||(Object.hasOwn(PHILANTHROPY_STAGES,fallback)?fallback:'watch');}
export function filterRecords(rows,{search='',category='all',stage='all',getStage}={}) { const q=normalizeSearch(search);return (rows||[]).filter(r=>(category==='all'||r.category===category||r.lever===category)&&(stage==='all'||(getStage?.(r)||r.stage||'watch')===stage)&&(!q||normalizeSearch([r.title,r.label,r.summary,r.detail,r.category,r.name,r.fit,r.next].join(' ')).includes(q))); }
export function validatePhilanthropy(data) {
  if(!data||data.schemaVersion!==1||!civilDate(data.asOf))throw Error('Les repères de philanthropie ne sont pas au format attendu.');
  for(const key of ['metrics','years','levers','actions','programs','documents','sources','targets','priorities','milestones','journey','principles'])if(!Array.isArray(data[key])||data[key].length>150)throw Error('Registre philanthropique incomplet : '+key);
  for(const m of data.metrics)if(m.value!==null&&!Number.isFinite(m.value))throw Error('Montant de référence invalide.');
  if(data.actions.length>20||new Set(data.actions.map(x=>x.id)).size!==data.actions.length)throw Error('Suivis invalides ou dupliqués.');
  if(data.actions.some(x=>!/^philanthropie-[a-z0-9-]{3,60}$/.test(x.stateId)||!/^[-a-z0-9]{3,60}$/.test(x.id)))throw Error('Identifiant de suivi invalide.');
  if(data.sources.some(x=>!x.id||!secureUrl(x.url))||data.documents.some(x=>!secureUrl(x.url)))throw Error('Lien documentaire invalide.');
  const ids=new Set(data.sources.map(s=>s.id));
  if(!data.cash||!civilDate(data.cash.date)||!ids.has(data.cash.sourceId)||!ids.has(data.targetSourceId)||['current','investments','expected'].some(k=>!Number.isFinite(data.cash[k])))throw Error('Repères de trésorerie incomplets.');
  if(data.years.some(y=>!Number.isInteger(y.year)||!Number.isFinite(y.revenue)||!Number.isFinite(y.expenses)||!Number.isFinite(y.operating)||y.revenue<0||y.expenses<0)||data.targets.some(t=>!Number.isFinite(t.value)||t.value<0))throw Error('Comparatif annuel ou objectif invalide.');
  for(const row of [...data.metrics,...data.years,...data.programs])if(!row.sourceId||!ids.has(row.sourceId))throw Error('Source de référence manquante.');
  return data;
}
export const DEFAULT_SCENARIO=Object.freeze({monthlyDonors:40,monthlyGift:20,majorDonors:25,majorGift:500,companies:8,packagePrice:1500,packageCash:300,hoursPerCompany:20,hourlyCost:40});
export function simulateRevenue(input={}) {
  const p={...DEFAULT_SCENARIO,...input};for(const k of Object.keys(DEFAULT_SCENARIO)){if(!Number.isFinite(Number(p[k]))||Number(p[k])<0||Number(p[k])>1000000)throw Error('Chaque hypothèse doit être un nombre entre 0 et 1 000 000.');p[k]=Number(p[k]);}
  for(const k of ['monthlyDonors','majorDonors','companies'])if(!Number.isInteger(p[k]))throw Error('Les nombres de relations doivent être entiers.');
  const monthly=p.monthlyDonors*p.monthlyGift*12,major=p.majorDonors*p.majorGift,corporate=p.companies*p.packagePrice,cashCost=p.companies*p.packageCash,hours=p.companies*p.hoursPerCompany,timeCost=hours*p.hourlyCost;
  return {monthly,major,corporate,gross:monthly+major+corporate,cashCost,hours,timeCost,contribution:monthly+major+corporate-cashCost-timeCost,corporateContribution:corporate-cashCost-timeCost};
}
export function csv(rows,columns) {const cell=v=>{const s=String(v??'');return '"'+(typeof v==='string'&&/^[=+\-@\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';};return '\ufeff'+[columns.map(x=>cell(x.label)).join(';'),...rows.map(r=>columns.map(c=>cell(r[c.key])).join(';'))].join('\r\n');}
