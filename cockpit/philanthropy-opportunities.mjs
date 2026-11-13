/** Pure display classification. No eligibility, opening status or awarded amount is inferred.
 * Explicit opportunityType/fundingType/category IDs take precedence. Unknown explicit labels
 * are retained under `other` instead of being overwritten by title heuristics.
 * Callers render labels as text (not HTML). Original records are never mutated.
 */
export const OPPORTUNITY_TYPES = Object.freeze({
  grants: 'Subventions et programmes', foundations: 'Fondations',
  community: 'Mobilisation et financement participatif', employment: 'Emploi et stages',
  inkind: 'Appuis en nature et services', other: 'Autres pistes à préciser'
});
export const TIMING_OPTIONS = Object.freeze({
  past: 'Échéance passée', upcoming: 'Échéance aujourd’hui ou à venir', unspecified: 'Date non précisée'
});
const icons = {grants:'leaf',foundations:'heart',community:'users',employment:'users',inkind:'gift',other:'leaf'};
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const aliases = {subvention:'grants',subventions:'grants',programme:'grants',programmes:'grants',fondation:'foundations',fondations:'foundations',communaute:'community',participatif:'community',emploi:'employment',stages:'employment','en nature':'inkind',services:'inkind'};
export function opportunityType(row = {}) {
  const explicit = [row.opportunityType,row.fundingType,row.category].find(v=>typeof v === 'string' && v.trim());
  if (explicit) {
    const key = norm(explicit), id = Object.hasOwn(OPPORTUNITY_TYPES,key) ? key : aliases[key] || 'other';
    return {id,label:id === 'other' && key !== 'other' ? explicit : OPPORTUNITY_TYPES[id],icon:icons[id],inferred:false};
  }
  const title = norm(row.title);
  // Deliberately no inference from descriptions: mentions of excluded costs are not categories.
  const id = /\b(ad grants|en nature|don de materiel|services gratuits)\b/.test(title) ? 'inkind'
    : /\b(swpp|stage|stages|emploi|emplois|embauche)\b/.test(title) ? 'employment'
    : /\b(participatif|sociofinancement|mille et un)\b/.test(title) ? 'community'
    : (/\b(fondation|foundation)\b/.test(title) || /^(td|fsheq|daytrippers)\b/.test(title)) ? 'foundations'
    : (/\b(subvention|subventions|programme|programmes)\b/.test(title) || /^(hydro[- ]quebec|fnceap|esten|desjardins|stations? de nettoyage|arbres canada|rbc)\b/.test(title)) ? 'grants' : 'other';
  return {id,label:OPPORTUNITY_TYPES[id],icon:icons[id],inferred:id !== 'other'};
}
function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? value : '';
}
/** Convert an instant to a civil day in America/Toronto. A civil YYYY-MM-DD stays a civil date. */
export function torontoDay(instant = new Date()) {
  if (validDay(instant)) return instant;
  if (typeof instant === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(instant)) throw new RangeError('Date de référence invalide.');
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Date de référence invalide.');
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get = type => parts.find(p=>p.type===type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
/** Compare only a validated structured deadline, never free-text calendar notes or opening dates. */
export function opportunityTiming(row = {}, today = new Date()) {
  const reference = torontoDay(today), date = validDay(row.deadline);
  const id = !date ? 'unspecified' : date < reference ? 'past' : 'upcoming';
  return {id,label:TIMING_OPTIONS[id],date:date || null};
}
const searchFields = ['title','label','name','summary','detail','category','opportunityType','fundingType','status','fit','fitPoints','next','conditions','requirements','exclusions','fundingNote','calendarNote','deadline','openingDate','sourceId','documentIds','projectId','tags'];
function searchText(row) {
  const collect = value => Array.isArray(value) ? value.map(collect).join(' ') : value && typeof value === 'object' ? Object.values(value).map(collect).join(' ') : String(value ?? '');
  return norm(searchFields.map(key=>collect(row[key])).concat(opportunityType(row).label).join(' '));
}
/** Filters {search,type,timing,sort}; all is the unfiltered value. Stable sort: original,
 * deadline (dated first, earliest first, undated last), title (French accent-insensitive).
 * Returns a fresh array containing the unchanged original record references.
 */
export function selectOpportunities(programs = [], filters = {}, today = new Date()) {
  const {search='',type='all',timing='all',sort='original'} = filters;
  const reference = torontoDay(today), query = norm(search);
  const rows = programs.map((row,index)=>({row,index,date:validDay(row.deadline)})).filter(({row})=>
    (type==='all'||opportunityType(row).id===type) &&
    (timing==='all'||opportunityTiming(row,reference).id===timing) &&
    (!query||searchText(row).includes(query)));
  if(sort==='deadline') rows.sort((a,b)=>(a.date||'9999-99-99').localeCompare(b.date||'9999-99-99')||a.index-b.index);
  if(sort==='title') rows.sort((a,b)=>String(a.row.title||'').localeCompare(String(b.row.title||''),'fr',{sensitivity:'base'})||a.index-b.index);
  return rows.map(({row})=>row);
}


