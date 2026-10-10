/** mulberry32. Deterministic, so the demo history is the same on every visit. */
export function nextRandom(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}

export function uuidFrom(random: () => number): string {
  const hex = Array.from({ length: 32 }, (_, i) => {
    if (i === 12) return '4';
    const digit = Math.floor(random() * 16);
    return (i === 16 ? (digit & 0x3) | 0x8 : digit).toString(16);
  }).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
