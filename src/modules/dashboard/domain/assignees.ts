// Desempenho por responsável: tipo de dado e ordenação.

export type AssigneeStats = {
  userId: number;
  name: string;
  /** PRs atribuídos a ele durante o período. */
  assigned: number;
  /** Situação no fim do período (carteira atual). */
  open: number;
  inProgress: number;
  pending: number;
  overdue: number;
  /** Concluídos por ele durante o período. */
  concluded: number;
  avgResolutionMinutes: number | null;
  /** % das conclusões dentro do prazo (null se não concluiu nenhum). */
  onTimePercent: number | null;
};

export const ASSIGNEE_SORT_KEYS = ["assigned", "concluded", "overdue", "workload", "avgResolution", "onTime"] as const;
export type AssigneeSortKey = (typeof ASSIGNEE_SORT_KEYS)[number];

export const ASSIGNEE_SORT_LABEL: Record<AssigneeSortKey, string> = {
  assigned: "Atribuídos",
  concluded: "Concluídos",
  overdue: "Atrasados",
  workload: "Carteira atual",
  avgResolution: "Tempo médio",
  onTime: "% no prazo",
};

const workload = (a: AssigneeStats) => a.open + a.inProgress + a.pending;

/** Valor usado na ordenação e se "maior é melhor" no sentido padrão. */
const SORTERS: Record<AssigneeSortKey, { value: (a: AssigneeStats) => number | null; defaultDesc: boolean }> = {
  assigned: { value: (a) => a.assigned, defaultDesc: true },
  concluded: { value: (a) => a.concluded, defaultDesc: true },
  overdue: { value: (a) => a.overdue, defaultDesc: true },
  workload: { value: workload, defaultDesc: true },
  // Tempo: menor primeiro (mais rápido no topo).
  avgResolution: { value: (a) => a.avgResolutionMinutes, defaultDesc: false },
  onTime: { value: (a) => a.onTimePercent, defaultDesc: true },
};

/**
 * Ordena os responsáveis. Valores ausentes (null) vão sempre para o fim;
 * empates são resolvidos pelo nome.
 */
export function sortAssignees(
  list: AssigneeStats[],
  key: AssigneeSortKey,
  direction: "asc" | "desc" = SORTERS[key].defaultDesc ? "desc" : "asc",
): AssigneeStats[] {
  const { value } = SORTERS[key];
  const sign = direction === "desc" ? -1 : 1;
  return [...list].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return a.name.localeCompare(b.name, "pt-BR");
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * sign || a.name.localeCompare(b.name, "pt-BR");
  });
}
