import assert from "node:assert/strict";
import { observeAuthProfiles } from "./auth-profile-session.mjs";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = () => new Promise((resolve) => setImmediate(resolve));
const denied = () => Object.assign(new Error("denied"), { code: "permission-denied" });
function harness({ readProfile, refreshToken = async () => {} }) {
  let listener, currentUser = null, unsubscribed = 0;
  const calls = [], failures = [];
  const stop = observeAuthProfiles({
    subscribe: (next) => { listener = next; return () => { unsubscribed += 1; }; },
    getCurrentUser: () => currentUser,
    readProfile, refreshToken,
    callback: (...args) => calls.push(args), onFailure: (error) => failures.push(error)
  });
  return { calls, failures, stop, get unsubscribed() { return unsubscribed; },
    emit(user) { currentUser = user; listener(user); },
    emitStale(user) { listener(user); } };
}

// Late successes and failures from a previous account must not affect the new one.
for (const failOld of [false, true]) {
  const old = deferred();
  const h = harness({ readProfile: (user) => user.uid === "old" ? old.promise : Promise.resolve({ role: "director", active: true }) });
  h.emit({ uid: "old" }); h.emit({ uid: "new" }); await settle();
  failOld ? old.reject(denied()) : old.resolve({ role: "admin", active: true }); await settle();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0].uid, "new");
  assert.equal(h.calls[0][1].role, "director"); assert.equal(h.failures.length, 0);
}

// One credential refresh can recover the current profile; its role is unchanged.
{
  let reads = 0, refreshes = 0;
  const h = harness({ readProfile: async () => { if (++reads === 1) throw denied(); return { role: "director", active: true }; }, refreshToken: async () => { refreshes += 1; } });
  h.emit({ uid: "annie" }); await settle();
  assert.equal(reads, 2); assert.equal(refreshes, 1); assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0][1], { role: "director", active: true }); assert.equal(h.calls[0][2], null);
}

// A real denial stays a denial after exactly one retry, with no promotion.
{
  let reads = 0, refreshes = 0;
  const h = harness({ readProfile: async () => { reads += 1; throw denied(); }, refreshToken: async () => { refreshes += 1; } });
  h.emit({ uid: "unapproved" }); await settle();
  assert.equal(reads, 2); assert.equal(refreshes, 1); assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][1], null); assert.equal(h.calls[0][2].code, "permission-denied"); assert.equal(h.failures.length, 1);
}

// Network failures do not trigger a credential refresh or a retry storm.
{
  let refreshes = 0;
  const error = Object.assign(new Error("offline"), { code: "unavailable" });
  const h = harness({ readProfile: async () => { throw error; }, refreshToken: async () => { refreshes += 1; } });
  h.emit({ uid: "valentin" }); await settle();
  assert.equal(refreshes, 0); assert.equal(h.calls[0][2], error);
}

// An expired credential remains an error if token renewal itself fails.
{
  let reads = 0;
  const refreshError = Object.assign(new Error("session expired"), { code: "auth/user-token-expired" });
  const h = harness({ readProfile: async () => { reads += 1; throw denied(); }, refreshToken: async () => { throw refreshError; } });
  h.emit({ uid: "expired" }); await settle();
  assert.equal(reads, 1); assert.equal(h.calls.length, 1); assert.equal(h.calls[0][2], refreshError);
}

// Signing out or disposing an observer cancels a pending read.
for (const dispose of [false, true]) {
  const pending = deferred(), h = harness({ readProfile: () => pending.promise });
  h.emit({ uid: "valentin" });
  if (dispose) { h.stop(); h.stop(); } else h.emit(null);
  pending.resolve({ role: "admin", active: true }); await settle();
  assert.equal(h.calls.length, dispose ? 0 : 1);
  if (dispose) assert.equal(h.unsubscribed, 1); else assert.deepEqual(h.calls[0], [null, null, null]);
}

// An account switch during refresh cannot retry or report the old profile.
{
  const refresh = deferred(); let reads = 0;
  const h = harness({ readProfile: async (u) => { reads += 1; if (u.uid === "old") throw denied(); return { role: "director", active: true }; }, refreshToken: () => refresh.promise });
  h.emit({ uid: "old" }); await settle(); h.emit({ uid: "new" }); refresh.resolve(); await settle();
  assert.equal(reads, 2); assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0].uid, "new");
}

// Inactive or missing profiles remain inactive after a successful read.
{
  const h = harness({ readProfile: async () => ({ role: "viewer", active: false }) });
  h.emit({ uid: "inactive" }); await settle(); assert.deepEqual(h.calls[0][1], { role: "viewer", active: false });
}

// A superseded auth notification must not cancel the current profile read.
{
  const pending = deferred(), h = harness({ readProfile: () => pending.promise });
  h.emit({ uid: "current" }); h.emitStale({ uid: "previous" });
  pending.resolve({ role: "director", active: true }); await settle();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0].uid, "current");
}
console.log("✓ auth profiles: 11 race, recovery and fail-closed scenarios");
