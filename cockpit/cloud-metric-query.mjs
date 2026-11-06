// Firestore exports some metrics under both legacy and current resources.
// Select one representation before reducing series; summing aliases doubles it.
export function canonicalMetricResource(descriptor) {
  const supported = descriptor?.monitoredResourceTypes || [];
  for (const name of ['firestore.googleapis.com/Database', 'firestore_instance', 'datastore_request']) {
    if (supported.includes(name)) return name;
  }
  return supported.length === 1 ? supported[0] : null;
}

export function cloudMetricQuery(descriptor, {startTime, endTime, alignmentSeconds=86400}={}) {
  const resource = canonicalMetricResource(descriptor);
  if (!descriptor?.type || !resource || !Number.isFinite(Date.parse(startTime)) || !Number.isFinite(Date.parse(endTime)) || Date.parse(startTime)>=Date.parse(endTime)) {
    throw Error('Mesure, ressource ou période Cloud ambiguë; aucune collecte.');
  }
  return new URLSearchParams({
    filter: `metric.type="${descriptor.type}" AND resource.type="${resource}"`,
    'interval.startTime': startTime,
    'interval.endTime': endTime,
    'aggregation.alignmentPeriod': `${alignmentSeconds}s`,
    'aggregation.perSeriesAligner': descriptor.metricKind==='GAUGE' ? 'ALIGN_MAX' : 'ALIGN_SUM',
    'aggregation.crossSeriesReducer': descriptor.metricKind==='GAUGE' ? 'REDUCE_MAX' : 'REDUCE_SUM',
    pageSize: '1000', view: 'FULL'
  });
}
