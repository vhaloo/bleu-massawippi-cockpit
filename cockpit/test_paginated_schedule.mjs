import assert from 'node:assert/strict';
import { observePaginatedSchedule } from './paginated-schedule.mjs';
const doc = (id, dateIso) => ({ id, data: () => ({ dateIso, title: id }) });
function harness(pageSize=120) {
  const listeners=[], deliveries=[], errors=[];
  const stop=observePaginatedSchedule({ pageSize, onRows: rows=>deliveries.push(rows), onError:e=>errors.push(e),
    subscribePage(cursor,next,error,number) { const listener={cursor,next,error,number,closed:false};listeners.push(listener);return()=>{listener.closed=true}; } });
  return {listeners,deliveries,errors,stop};
}
const h=harness();
const first=Array.from({length:120},(_,i)=>doc(`old-${String(i).padStart(3,'0')}`,'2026-10-10'));
h.listeners[0].next({docs:first});
assert.equal(h.deliveries.length,0,'Do not report the first 120 as the complete register.');
assert.equal(h.listeners[1].cursor,first.at(-1));
const january=Array.from({length:53},(_,i)=>doc(`january-${String(i).padStart(3,'0')}`,'2027-01-31'));
h.listeners[1].next({docs:january});
assert.equal(h.deliveries.at(-1).length,173);
assert.equal(h.deliveries.at(-1).at(-1).dateIso,'2027-01-31');
const oldTail=h.listeners[1];
const changed=first.slice(1).concat(doc('replacement','2026-11-20'));
h.listeners[0].next({docs:changed});
assert(oldTail.closed,'Changing a boundary cancels its dependent listener.');
const deliveryCount=h.deliveries.length;
oldTail.next({docs:[]});assert.equal(h.deliveries.length,deliveryCount,'Ignore stale callbacks.');
h.listeners[2].next({docs:january});assert.equal(h.deliveries.at(-1).length,173);
h.listeners[2].error(new Error('network'));assert.equal(h.errors.length,1);assert.equal(h.deliveries.at(-1).length,173,'Keep the last complete result on failure.');
h.listeners[2].next({docs:january});
h.listeners[0].next({docs:first.slice(0,9)});assert(h.listeners[2].closed);assert.equal(h.deliveries.at(-1).length,9,'A shorter head discards its obsolete tail.');
h.stop();assert(h.listeners.every(x=>x.closed));const n=h.deliveries.length;h.listeners[0].next({docs:[]});assert.equal(h.deliveries.length,n);
const exact=harness(2);exact.listeners[0].next({docs:[doc('a','2026-01-01'),doc('b','2026-01-01')]});assert.equal(exact.deliveries.length,0);exact.listeners[1].next({docs:[]});assert.equal(exact.deliveries.at(-1).length,2);
exact.listeners[1].next({docs:[doc('c','2027-01-01'),doc('d','2027-01-01')]});assert.equal(exact.listeners.length,3);exact.listeners[2].next({docs:[doc('e','2027-01-02')]});assert.equal(exact.deliveries.at(-1).length,5);exact.stop();
let stops=0;const sync=[];const syncStop=observePaginatedSchedule({pageSize:2,onRows:r=>sync.push(r),subscribePage(cursor,next){next({docs:cursor?[doc('c','2027-01-01')]:[doc('a','2026-01-01'),doc('b','2026-01-01')]});return()=>stops++}});assert.equal(sync.at(-1).length,3);syncStop();assert.equal(stops,2);
console.log('Paginated schedule: complete future register, date ties, live boundaries, errors and teardown verified.');
