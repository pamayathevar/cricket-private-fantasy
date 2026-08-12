export function formatOversFromBalls(balls: number) {
  const safeBalls = Math.max(0, Math.floor(Number(balls) || 0));
  return `${Math.floor(safeBalls / 6)}.${safeBalls % 6}`;
}

export function scorecardDismissalLabel(row: Record<string, unknown>) {
  const raw = row.dismissalText ?? row.dismissal_text ?? row.howOut ?? row.how_out ?? row.dismissal;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return Boolean(row.notOut ?? row.not_out) ? "not out" : "";
}

export function latestPublishedPlayerPoints<T extends { player_id?: unknown; published_at?: unknown; calculation_version?: unknown }>(rows: T[]) {
  const result = new Map<string, T>();
  rows.filter(row => row.published_at).forEach(row => {
    const playerId = String(row.player_id ?? "");
    const current = result.get(playerId);
    if (playerId && (!current || Number(row.calculation_version ?? 0) > Number(current.calculation_version ?? 0))) result.set(playerId, row);
  });
  return [...result.values()];
}
