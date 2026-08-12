const DAY_MS = 24 * 60 * 60 * 1000;

function dayDistance(left, right) {
  return Math.round(Math.abs(Date.parse(`${right}T12:00:00Z`) - Date.parse(`${left}T12:00:00Z`)) / DAY_MS);
}

export function findEditorialFamilyConflicts(posts, { minimumGapDays = 7 } = {}) {
  const active = (Array.isArray(posts) ? posts : [])
    .filter((post) => post?.archivedEditorial !== true && post?.dateIso && post?.editorialFamily)
    .sort((left, right) => left.dateIso.localeCompare(right.dateIso) || String(left.id).localeCompare(String(right.id)));
  const previousByFamily = new Map();
  const conflicts = [];
  for (const post of active) {
    const previous = previousByFamily.get(post.editorialFamily);
    if (previous) {
      const gapDays = dayDistance(previous.dateIso, post.dateIso);
      if (gapDays < minimumGapDays) conflicts.push({
        family: post.editorialFamily,
        previousId: previous.id,
        previousDateIso: previous.dateIso,
        currentId: post.id,
        currentDateIso: post.dateIso,
        gapDays,
        minimumGapDays
      });
    }
    previousByFamily.set(post.editorialFamily, post);
  }
  return conflicts;
}

export function findTopicSignatureConflicts(posts, { minimumGapDays = 7 } = {}) {
  const active = (Array.isArray(posts) ? posts : [])
    .filter((post) => post?.archivedEditorial !== true && post?.dateIso && post?.topicSignature)
    .sort((left, right) => left.dateIso.localeCompare(right.dateIso) || String(left.id).localeCompare(String(right.id)));
  const previousByTopic = new Map();
  const conflicts = [];
  for (const post of active) {
    const signatures = [...new Set(String(post.topicSignature).split(",").map((value) => value.trim()).filter(Boolean))];
    for (const signature of signatures) {
      const previous = previousByTopic.get(signature);
      if (previous) {
        const gapDays = dayDistance(previous.dateIso, post.dateIso);
        if (gapDays < minimumGapDays) conflicts.push({
          signature,
          previousId: previous.id,
          previousDateIso: previous.dateIso,
          currentId: post.id,
          currentDateIso: post.dateIso,
          gapDays,
          minimumGapDays
        });
      }
      previousByTopic.set(signature, post);
    }
  }
  return conflicts;
}
