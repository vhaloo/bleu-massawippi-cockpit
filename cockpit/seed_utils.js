export const isDryRun = (argv = process.argv) => argv.includes("--dry-run");

export function sameSeedFields(existing = {}, desired = {}) {
  return Object.entries(desired).every(([key, value]) => JSON.stringify(existing?.[key] ?? null) === JSON.stringify(value ?? null));
}

export function dryRunSummary(name, items, extra = {}) {
  return { ready: true, dryRun: true, seed: name, items: items.length, maximumWrites: items.length, ...extra };
}
