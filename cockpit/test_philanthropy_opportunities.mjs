import assert from 'node:assert/strict';
import {opportunityType,opportunityTiming,selectOpportunities,torontoDay} from './philanthropy-opportunities.mjs';
const today='2026-11-12';
assert.equal(torontoDay('2026-11-12T03:00:00Z'),'2026-11-11');
assert.equal(torontoDay('2026-11-12'),'2026-11-12');
assert.equal(torontoDay('2026-03-08T06:59:00Z'),'2026-03-08');
assert.throws(()=>torontoDay('not-a-date'),RangeError);
assert.equal(opportunityType({title:'Google Ad Grants'}).id,'inkind');
assert.equal(opportunityType({title:'Fondation Démonstration'}).id,'foundations');
assert.equal(opportunityType({title:'Autre',summary:'Ne finance pas les stages'}).id,'other');
assert.equal(opportunityType({title:'Programme de stages',category:'inkind'}).id,'inkind');
assert.equal(opportunityType({title:'Programme de stages',category:'Catégorie interne'}).label,'Catégorie interne');
assert.equal(opportunityTiming({deadline:'2026-11-11'},today).id,'past');
assert.equal(opportunityTiming({deadline:today},today).id,'upcoming');
assert.equal(opportunityTiming({deadline:'2028-02-29'},today).id,'upcoming');
for(const deadline of ['2026-02-29','2026-13-01','2026-11-12T00:00Z','12 novembre 2026',null]) assert.equal(opportunityTiming({deadline},today).id,'unspecified');
assert.equal(opportunityTiming({openingDate:'2026-12-01',calendarNote:'Clôture en décembre'},today).id,'unspecified');
const rows=[
 {id:'a',title:'Zèbre',deadline:'2026-12-01',requirements:['Pièce vérifiée'],exclusions:['Dépenses privées'],fundingNote:'Crédit seulement'},
 {id:'b',title:'Érable',deadline:'2026-11-10',opportunityType:'grants'},
 {id:'c',title:'Erable',deadline:'2026-11-10'},
 {id:'d',title:'Autre',calendarNote:'Dates à préciser'}
];
const before=JSON.stringify(rows);rows.forEach(Object.freeze);Object.freeze(rows);
const ids=result=>result.map(row=>row.id);
assert.deepEqual(ids(selectOpportunities(rows,{},today)),['a','b','c','d']);
assert.deepEqual(ids(selectOpportunities(rows,{sort:'deadline'},today)),['b','c','a','d']);
assert.deepEqual(ids(selectOpportunities(rows,{sort:'title'},today)),['d','b','c','a']);
assert.deepEqual(ids(selectOpportunities(rows,{search:'piece verifiee'},today)),['a']);
assert.deepEqual(ids(selectOpportunities(rows,{search:'depenses privees'},today)),['a']);
assert.deepEqual(ids(selectOpportunities(rows,{search:'credit'},today)),['a']);
assert.deepEqual(ids(selectOpportunities(rows,{type:'grants',timing:'past'},today)),['b']);
assert.deepEqual(ids(selectOpportunities(rows,{timing:'unspecified'},today)),['d']);
assert.deepEqual(selectOpportunities(rows,{search:'absent'},today),[]);
assert.equal(selectOpportunities(rows,{},today)[0],rows[0]);
assert.equal(JSON.stringify(rows),before);
console.log('PASS: opportunity classification, civil dates, filters, stable sorting and immutability');
// Named public providers are navigation hints only; no availability or eligibility inferred.
for (const title of ['TD — Amis des arbres','FSHEQ','Daytrippers']) assert.equal(opportunityType({title}).id,'foundations');
for (const title of ['Hydro-Québec','FNCEAP','ESTEN','Desjardins','Stations de nettoyage','Arbres Canada','RBC']) assert.equal(opportunityType({title}).id,'grants');
assert.equal(opportunityType({title:'Emplois été Canada'}).id,'employment');
assert.equal(opportunityType({title:'Autre piste',summary:'RBC'}).id,'other');
assert.equal(opportunityType({title:'RBC',fundingType:'inkind'}).id,'inkind');
