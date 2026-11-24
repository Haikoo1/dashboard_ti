// Comparação de um valor com o período anterior.

export type Comparison = {
  current: number;
  /** null = não há dados suficientes para comparar. */
  previous: number | null;
  /** Diferença absoluta (atual − anterior). */
  delta: number | null;
  /** Variação percentual. null quando o anterior é zero (variação indefinida). */
  deltaPercent: number | null;
};

export function compare(current: number, previous: number | null): Comparison {
  if (previous === null) return { current, previous: null, delta: null, deltaPercent: null };
  const delta = current - previous;
  return {
    current,
    previous,
    delta,
    deltaPercent: previous === 0 ? null : (delta / previous) * 100,
  };
}
