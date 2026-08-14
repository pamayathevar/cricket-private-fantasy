export function recordNavigation<T extends string>(
  history: T[],
  current: T,
  destination: T,
  limit = 20,
) {
  if (current === destination) return history;
  return [...history, current].slice(-Math.max(1, limit));
}

export function previousNavigation<T extends string>(history: T[], allowed: readonly T[]) {
  const remaining = [...history];
  while (remaining.length) {
    const destination = remaining.pop() as T;
    if (allowed.includes(destination)) return { destination, history: remaining };
  }
  return { destination: null, history: remaining };
}
