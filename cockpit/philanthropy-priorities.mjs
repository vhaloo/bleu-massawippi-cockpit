/** Human-authored shared signals, independent of workflow stage and funding decisions. */
export const PRIORITY_PREFIX = 'phi-priority-';
export function prioritySection(kind,id) {
  if(!['program','action'].includes(kind)||!/^[a-z0-9-]{1,90}$/i.test(String(id||''))) throw Error('Dossier de priorité invalide.');
  return `${PRIORITY_PREFIX}${kind}-${id}`;
}
export function priorityText(active,title) { return `Priorité philanthropie : ${active?'ACTIVE':'RETIRÉE'}\n${String(title||'Dossier').slice(0,220)}\nSignal de travail partagé, sans décision de financement ni engagement.`; }
export function priorityActive(row) { return !!row && row.deleted!==true && row.resolved!==true && String(row.comment||'').startsWith('Priorité philanthropie : ACTIVE\n'); }
export function prioritySignals(rows,section) { return (rows||[]).filter(x=>x.sectionId===section&&priorityActive(x)); }
export function ownPriority(rows,section,uid) { return (rows||[]).find(x=>x.sectionId===section&&x.authorUid===uid); }
export function assertPriorityWrite(before,{section,uid,expected,active}) {
  if(typeof active!=='boolean'||typeof expected!=='boolean'||!uid) throw Error('Signal de priorité invalide.');
  if(before && (before.authorUid!==uid||before.sectionId!==section)) throw Error('Ce signal appartient à un autre dossier ou auteur.');
  if(before?.resolved===true||before?.deleted===true) throw Error('Ce signal a été archivé ou traité. Actualisez avant de poursuivre.');
  if(priorityActive(before)!==expected && priorityActive(before)!==active) throw Error('Votre signal a changé dans un autre onglet. Actualisez avant de réessayer.');
  return priorityActive(before)!==active;
}
