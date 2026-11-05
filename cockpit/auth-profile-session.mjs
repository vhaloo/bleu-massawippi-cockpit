const permissionDenied = (error) => /^(?:firestore\/)?permission-denied$/.test(String(error?.code || ""));

/** Keep late profile reads from replacing a newer account or a signed-out view. */
export function observeAuthProfiles({ subscribe, getCurrentUser, readProfile, refreshToken, callback, onFailure }) {
  let generation = 0;
  let stopped = false;
  const isCurrent = (user, ticket) => !stopped && ticket === generation
    && (getCurrentUser()?.uid || null) === (user?.uid || null);

  const unsubscribe = subscribe((user) => {
    if (stopped || (getCurrentUser()?.uid || null) !== (user?.uid || null)) return;
    const ticket = ++generation;
    if (!user) {
      callback(null, null, null);
      return;
    }

    const load = async () => {
      try {
        return await readProfile(user);
      } catch (error) {
        // A restored/switched session can briefly retain an older credential.
        // Refresh once; authorization still comes from the same server profile.
        if (!isCurrent(user, ticket) || !permissionDenied(error)) throw error;
        await refreshToken(user);
        if (!isCurrent(user, ticket)) return null;
        return readProfile(user);
      }
    };

    load().then((profile) => {
      if (isCurrent(user, ticket)) callback(user, profile, null);
    }).catch((error) => {
      if (!isCurrent(user, ticket)) return;
      onFailure?.(error);
      callback(user, null, error);
    });
  });

  return () => {
    if (stopped) return;
    stopped = true;
    generation += 1;
    unsubscribe();
  };
}
