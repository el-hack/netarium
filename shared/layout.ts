export interface Position {
  x: number;
  y: number;
}
function hash(id: string) {
  let value = 2166136261;
  for (const char of id) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
export function defaultPosition(id: string): Position {
  const angle = (hash(id) / 4294967296) * Math.PI * 2;
  return { x: Math.cos(angle) * 7, y: Math.sin(angle) * 7 };
}
/** Persisted positions never move when identities are added or removed. */
export function allocatePositions(
  ids: string[],
  existing: Record<string, Position> = {},
): Record<string, Position> {
  const result = { ...existing };
  const occupied = ids.flatMap((id) => (result[id] ? [result[id]] : []));
  for (const id of [...ids].sort()) {
    if (result[id]) continue;
    const seed = (hash(id) / 4294967296) * Math.PI * 2;
    let best = defaultPosition(id);
    let clearance = -1;
    for (let i = 0; i < 120; i++) {
      const angle = seed + i * 2.3999632297;
      const radius = Math.min(18, 7 + Math.floor(i / 12) * 3.5);
      const candidate = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      const distance = Math.min(
        Math.hypot(candidate.x, candidate.y),
        ...occupied.map((p) => Math.hypot(candidate.x - p.x, candidate.y - p.y)),
      );
      if (distance > clearance) {
        best = candidate;
        clearance = distance;
      }
      if (distance >= 5.5) break;
    }
    result[id] = best;
    occupied.push(best);
  }
  return result;
}
