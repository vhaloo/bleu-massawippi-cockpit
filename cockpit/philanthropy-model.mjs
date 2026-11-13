/** Private evidence stays in Firestore. This module contains presentation rules only. */
export const PHILANTHROPY_VIEWS = Object.freeze({ensemble:'Vue d’ensemble', programmes:'Occasions de financement', leviers:'Stratégies de revenus', actions:'Démarches en cours', membres:'Membres et donateurs', scenarios:'Simulateur', documents:'Documents'});
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
  if(data.dossiers!==undefined){if(!Array.isArray(data.dossiers)||data.dossiers.length>25||new Set(data.dossiers.map(x=>x.id)).size!==data.dossiers.length)throw Error('Dossiers de financement invalides.');const docIds=new Set(data.documents.map(x=>x.id));for(const d of data.dossiers)if(!/^[-a-z0-9]{3,60}$/.test(d.id)||!d.projectId||!Array.isArray(d.documentIds)||d.documentIds.length<1||d.documentIds.some(id=>!docIds.has(id)))throw Error('Chaque dossier doit avoir un projet et des documents valides.');const dossierIds=new Set(data.dossiers.map(x=>x.id));if(data.actions.some(x=>!dossierIds.has(x.dossierId)))throw Error('Démarche sans dossier lié.');}
  const ids=new Set(data.sources.map(s=>s.id));
  if(!data.cash||!civilDate(data.cash.date)||!ids.has(data.cash.sourceId)||!ids.has(data.targetSourceId)||['current','investments','expected'].some(k=>!Number.isFinite(data.cash[k])))throw Error('Repères de trésorerie incomplets.');
  if(data.years.some(y=>!Number.isInteger(y.year)||!Number.isFinite(y.revenue)||!Number.isFinite(y.expenses)||!Number.isFinite(y.operating)||y.revenue<0||y.expenses<0)||data.targets.some(t=>!Number.isFinite(t.value)||t.value<0))throw Error('Comparatif annuel ou objectif invalide.');
  for(const row of [...data.metrics,...data.years,...data.programs])if(!row.sourceId||!ids.has(row.sourceId))throw Error('Source de référence manquante.');
  return data;
}
export const SCENARIO_FIELDS=Object.freeze([
  {key:'horizonMonths',label:'Durée du scénario',unit:'mois',min:1,max:36,integer:true,group:'revenus'},
  {key:'monthlyStartMonth',label:'Premier mois des dons réguliers',unit:'mois du scénario',min:1,max:36,integer:true,group:'revenus'},
  {key:'monthlyDonors',label:'Relations mensuelles au démarrage',max:1000000,integer:true,group:'revenus'},
  {key:'monthlyGift',label:'Don mensuel par relation',unit:'$',group:'revenus'},
  {key:'monthlyChurnPercent',label:'Abandons mensuels supposés',unit:'%',max:100,group:'revenus'},
  {key:'annualContacts',label:'Contacts pour les dons ponctuels',integer:true,group:'revenus'},
  {key:'annualConversionPercent',label:'Contacts qui donneraient',unit:'%',max:100,group:'revenus'},
  {key:'majorGift',label:'Don ponctuel moyen supposé',unit:'$',group:'revenus'},
  {key:'companies',label:'Forfaits entreprises envisagés',integer:true,group:'entreprises'},
  {key:'packagePrice',label:'Prix d’un forfait',unit:'$',group:'entreprises'},
  {key:'packageCash',label:'Frais directs par forfait',unit:'$',group:'entreprises'},
  {key:'hoursPerCompany',label:'Temps complet par forfait',unit:'h',group:'entreprises'},
  {key:'hourlyCost',label:'Coût valorisé d’une heure',unit:'$/h',group:'couts'},
  {key:'collectionCash',label:'Autres frais de collecte',unit:'$',group:'couts'},
  {key:'collectionHours',label:'Temps de relation et de collecte',unit:'h',group:'couts'},
  {key:'donationFeesPercent',label:'Frais variables sur les dons',unit:'%',max:100,group:'couts'},
  {key:'overhead',label:'Autres coûts non déjà comptés',unit:'$',group:'couts'},
  {key:'paidTimePercent',label:'Part du temps qui occasionne une sortie payée',unit:'%',max:100,group:'couts'},
  {key:'capacityHours',label:'Capacité de travail disponible sur la période',unit:'h',group:'couts'},
  {key:'openingScenarioCash',label:'Solde de départ hypothétique',unit:'$',group:'flux'},
  {key:'annualGiftMonth',label:'Mois de réception des dons ponctuels',min:1,max:36,integer:true,group:'flux'},
  {key:'companyDeliveryMonth',label:'Mois de réalisation des forfaits',min:1,max:36,integer:true,group:'flux'},
  {key:'companyPaymentLag',label:'Délai de paiement après réalisation',unit:'mois',max:36,integer:true,group:'flux'},
  {key:'missionSupport',label:'Autre appui libre retenu dans l’hypothèse',unit:'$',group:'affectes'},
  {key:'missionMonth',label:'Mois de réception de cet appui',min:1,max:36,integer:true,group:'affectes'},
  {key:'grantAmount',label:'Financement affecté retenu dans l’hypothèse',unit:'$',group:'affectes'},
  {key:'grantMonth',label:'Mois de réception du financement affecté',min:1,max:36,integer:true,group:'affectes'},
  {key:'grantProjectCost',label:'Dépenses du projet affecté',unit:'$',group:'affectes'},
  {key:'projectSpendMonth',label:'Mois de paiement de ces dépenses',min:1,max:36,integer:true,group:'affectes'}
]);
export const DEFAULT_SCENARIO=Object.freeze({horizonMonths:12,monthlyStartMonth:1,monthlyDonors:40,monthlyGift:20,monthlyChurnPercent:0,annualContacts:100,annualConversionPercent:25,majorGift:500,companies:8,packagePrice:1500,packageCash:300,hoursPerCompany:20,hourlyCost:40,collectionCash:300,collectionHours:25,donationFeesPercent:0,overhead:1000,paidTimePercent:100,capacityHours:300,openingScenarioCash:0,annualGiftMonth:2,companyDeliveryMonth:4,companyPaymentLag:2,missionSupport:0,missionMonth:1,grantAmount:0,grantMonth:4,grantProjectCost:0,projectSpendMonth:3});
export function simulateRevenue(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Les hypothèses doivent former un objet.');
  const p={...DEFAULT_SCENARIO,...input};
  for(const f of SCENARIO_FIELDS){const raw=p[f.key];if(raw===null||typeof raw==='string'&&raw.trim()===''||typeof raw==='boolean'||!Number.isFinite(Number(raw)))throw Error('Chaque hypothèse doit être un nombre renseigné.');p[f.key]=Number(raw);if(p[f.key]<(f.min||0)||p[f.key]>(f.max??1000000)||f.integer&&!Number.isInteger(p[f.key]))throw Error('Hypothèse hors limites : '+f.label+'.');}
  // Support the earlier fixed-count API without silently changing its meaning.
  if(Object.hasOwn(input,'majorDonors')){if(!Number.isSafeInteger(input.majorDonors)||input.majorDonors<0||input.majorDonors>1000000)throw Error('Nombre de dons ponctuels invalide.');p.annualContacts=input.majorDonors;p.annualConversionPercent=100;}
  const majorDonors=Math.floor(p.annualContacts*p.annualConversionPercent/100);
  const activeMonths=Math.max(0,p.horizonMonths-p.monthlyStartMonth+1),donorMonths=Array.from({length:activeMonths},(_,i)=>p.monthlyDonors*Math.pow(1-p.monthlyChurnPercent/100,i)).reduce((n,v)=>n+v,0);
  const monthly=donorMonths*p.monthlyGift,major=p.annualGiftMonth<=p.horizonMonths?majorDonors*p.majorGift:0;
  const delivered=p.companyDeliveryMonth<=p.horizonMonths,corporate=delivered?p.companies*p.packagePrice:0,cashCost=delivered?p.companies*p.packageCash:0,hours=delivered?p.companies*p.hoursPerCompany:0,timeCost=hours*p.hourlyCost;
  const totalHours=hours+p.collectionHours,allTimeCost=totalHours*p.hourlyCost,paidTimeCost=allTimeCost*p.paidTimePercent/100,opportunityTimeCost=allTimeCost-paidTimeCost;
  const mission=p.missionMonth<=p.horizonMonths?p.missionSupport:0,fees=(monthly+major)*p.donationFeesPercent/100;
  const gross=monthly+major+corporate+mission,otherCash=p.collectionCash+p.overhead+fees;
  const contribution=gross-cashCost-otherCash-allTimeCost,corporateContribution=corporate-cashCost-timeCost;
  let free=p.openingScenarioCash,restricted=0,minFree=free,peakBridge=0;const flows=[];
  for(let m=1;m<=p.horizonMonths;m++){
    const recurring=m>=p.monthlyStartMonth?p.monthlyDonors*Math.pow(1-p.monthlyChurnPercent/100,m-p.monthlyStartMonth)*p.monthlyGift:0;
    const gifts=m===p.annualGiftMonth?major:0,companyPayment=m===p.companyDeliveryMonth+p.companyPaymentLag?corporate:0,missionPayment=m===p.missionMonth?mission:0;
    const freeIn=recurring+gifts+companyPayment+missionPayment;
    const productionOut=m===p.companyDeliveryMonth?cashCost+timeCost*p.paidTimePercent/100:0;
    const freeOut=productionOut+(m===1?p.collectionCash:0)+p.overhead/p.horizonMonths+p.collectionHours*p.hourlyCost*p.paidTimePercent/100/p.horizonMonths+(recurring+gifts)*p.donationFeesPercent/100;
    const restrictedIn=m===p.grantMonth?p.grantAmount:0,restrictedOut=m===p.projectSpendMonth?p.grantProjectCost:0;
    free+=freeIn-freeOut;restricted+=restrictedIn-restrictedOut;
    const available=free+Math.min(0,restricted),totalCash=free+restricted,bridge=Math.max(0,-restricted);
    minFree=Math.min(minFree,available);peakBridge=Math.max(peakBridge,bridge);
    flows.push({month:m,freeIn,freeOut,restrictedIn,restrictedOut,restrictedBalance:restricted,freeAvailable:available,totalCash,bridge});
  }
  const last=flows.at(-1),receivedCorporate=flows.reduce((n,r)=>n+(r.month===p.companyDeliveryMonth+p.companyPaymentLag?corporate:0),0);
  const restrictedIn=flows.reduce((n,r)=>n+r.restrictedIn,0),restrictedOut=flows.reduce((n,r)=>n+r.restrictedOut,0);
  const result={monthly,major,majorDonors,corporate,mission,gross,cashCost,hours,timeCost,totalHours,allTimeCost,paidTimeCost,opportunityTimeCost,fees,otherCash,contribution,corporateContribution,donorMonths,activeMonths,flows,minFree,peakBridge,freeCashEnd:last.freeAvailable,totalCashEnd:last.totalCash,restrictedBalance:restrictedIn-restrictedOut,restrictedIn,restrictedOut,receivedCorporate,receivableCorporate:corporate-receivedCorporate,capacityGap:Math.max(0,totalHours-p.capacityHours),cashNet:flows.reduce((n,r)=>n+r.freeIn-r.freeOut,0)};
  if(Object.values(result).some(v=>typeof v==='number'&&(!Number.isFinite(v)||Math.abs(v)>Number.MAX_SAFE_INTEGER))||flows.some(r=>Object.values(r).some(v=>!Number.isFinite(v)||Math.abs(v)>Number.MAX_SAFE_INTEGER)))throw Error('Les montants calculés dépassent la précision du simulateur. Réduisez les hypothèses.');
  return result;
}
export function scenarioSensitivity(input={}) {const p={...DEFAULT_SCENARIO,...input};return [{label:'Hypothèse affichée',result:simulateRevenue(p)},{label:'Dons et prix inférieurs de 10 %',result:simulateRevenue({...p,monthlyGift:p.monthlyGift*.9,majorGift:p.majorGift*.9,packagePrice:p.packagePrice*.9})},{label:'Temps de travail supérieur de 25 %',result:simulateRevenue({...p,hoursPerCompany:p.hoursPerCompany*1.25,collectionHours:p.collectionHours*1.25})}];}
export function csv(rows,columns) {const cell=v=>{const s=String(v??'');return '"'+(typeof v==='string'&&/^[=+\-@\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';};return '\ufeff'+[columns.map(x=>cell(x.label)).join(';'),...rows.map(r=>columns.map(c=>cell(r[c.key])).join(';'))].join('\r\n');}
