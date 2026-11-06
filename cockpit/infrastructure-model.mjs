export const INFRASTRUCTURE_ADMIN_UID='6FAy9GJU5qTUlHNelXvtHBsVH3k1';
export const INFRASTRUCTURE_DOCUMENT='admin-infrastructure-current';
export function canAccessInfrastructure(profile) {return profile?.active!==false && profile?.role==='admin' && profile?.uid===INFRASTRUCTURE_ADMIN_UID;}
export function finiteMetric(value){return typeof value==='number'&&Number.isFinite(value)?value:null;}
export function infrastructureAlerts(snapshot,diagnostics={},now=Date.now()) {
  const alerts=[];
  const billing=snapshot?.billing;
  if(billing && String(billing.periodEnd || '').slice(0,7)===new Date(now).toISOString().slice(0,7) && finiteMetric(billing.totalCad)!==null && finiteMetric(billing.budgetCad)!==null && billing.totalCad>=billing.budgetCad) {
    alerts.push({id:`budget-${billing.periodEnd.slice(0,7)}`,severity:'warning',title:'Budget mensuel dépassé',detail:`${billing.totalCad.toLocaleString('fr-CA')} $ CA constatés au ${billing.periodEnd}. Le budget de ${billing.budgetCad} $ CA est une alerte, pas un plafond de dépenses.`});
  }
  if(snapshot?.capturedAt && now-Date.parse(snapshot.capturedAt)>48*3600000) alerts.push({id:`cloud-stale-${snapshot.capturedAt}`,severity:'warning',title:'Mesures Cloud à actualiser',detail:'Le relevé Cloud a plus de 48 heures. Les compteurs de cette session continuent de fonctionner en direct.'});
  if(diagnostics.networkState==='offline') alerts.push({id:`offline-${new Date(now).toISOString().slice(0,10)}`,severity:'warning',title:'Connexion interrompue',detail:'La session utilise les données déjà présentes sur cet appareil.'});
  if((diagnostics.sdkRecentServerApproxBytes||0)>32*1048576) alerts.push({id:`traffic-${Math.floor(now/(10*60000))}`,severity:'warning',title:'Chargement inhabituellement lourd',detail:'Plus de 32 Mio de valeurs SDK ont été livrées dans cet onglet en dix minutes. Le détail des sources se trouve dans « Cette session ». Estimation de diagnostic, distincte des octets réseau et de la facture.'});
  if((diagnostics.listenerStartsRecent||0)>60) alerts.push({id:`listeners-${Math.floor(now/(5*60000))}`,severity:'warning',title:'Réouvertures fréquentes des abonnements',detail:'Plus de 60 démarrages d’abonnements dans cet onglet en cinq minutes. Vérifiez les sources dans « Cette session ». Les connexions et validations continuent de fonctionner.'});
  if(diagnostics.lastErrorAt && now-Date.parse(diagnostics.lastErrorAt)<15*60000) alerts.push({id:`client-${diagnostics.lastErrorCode}-${Math.floor(Date.parse(diagnostics.lastErrorAt)/(15*60000))}`,severity:/permission-denied|unauthenticated/.test(diagnostics.lastErrorCode || '')?'critical':'warning',title:'Incident de connexion au Cockpit',detail:diagnostics.lastErrorMessage || 'Consultez le diagnostic de la session.'});
  return alerts;
}
export function metricWindow(snapshot,type,days=14) {
  const source=snapshot?.monitoring?.series?.find(row=>row.type===type);
  if(!source) return {points:[],source:null};
  const points=(source.points || []).filter(point=>finiteMetric(point.value)!==null&&Number.isFinite(Date.parse(point.at))).sort((a,b)=>a.at.localeCompare(b.at));
  const end=Date.parse(snapshot.monitoring.endTime || snapshot.capturedAt),start=end-days*86400000;
  return {source,points:points.filter(point=>Date.parse(point.at)>start&&Date.parse(point.at)<=end)};
}
export function summarizeMetric(points,kind='DELTA') {return points.length ? kind==='GAUGE'?points.at(-1).value:points.reduce((sum,point)=>sum+point.value,0):null;}
export function catalogueReduction(before,after){return before>0&&after>=0?Math.max(0,(1-after/before)*100):null;}
