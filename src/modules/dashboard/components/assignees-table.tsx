"use client";

// Tabela de desempenho por técnico, ordenável pelos títulos das colunas.
// Os dados chegam prontos do servidor; a ordenação acontece no navegador.
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { ASSIGNEE_SORT_LABEL, sortAssignees, type AssigneeSortKey, type AssigneeStats } from "../domain/assignees";
import { formatDuration, formatNumber, formatPercent } from "../domain/format";

type Sort = { key: AssigneeSortKey; direction: "asc" | "desc" };

// Direção usada no primeiro clique em cada coluna.
const FIRST_DIRECTION: Record<AssigneeSortKey, "asc" | "desc"> = {
  assigned: "desc",
  concluded: "desc",
  workload: "desc",
  overdue: "desc",
  avgResolution: "asc",
  onTime: "desc",
};

const COLUMNS: { key: AssigneeSortKey; hint: string }[] = [
  { key: "assigned", hint: "PRs atribuídos ao técnico durante o período" },
  { key: "concluded", hint: "PRs concluídos pelo técnico durante o período" },
  { key: "workload", hint: "PRs em atendimento com o técnico no fim do período (abertos, em andamento e pendentes)" },
  { key: "overdue", hint: "PRs da carteira com o prazo vencido" },
  { key: "avgResolution", hint: "Tempo médio da abertura até a conclusão, nos PRs que ele concluiu" },
  { key: "onTime", hint: "Das conclusões dele, quantas foram até o prazo" },
];

export function AssigneesTable({ assignees }: { assignees: AssigneeStats[] }) {
  const [sort, setSort] = useState<Sort>({ key: "concluded", direction: "desc" });
  const rows = sortAssignees(assignees, sort.key, sort.direction);

  function toggle(key: AssigneeSortKey) {
    setSort((s) =>
      s.key === key
        ? { key, direction: s.direction === "desc" ? "asc" : "desc" }
        : { key, direction: FIRST_DIRECTION[key] },
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full min-w-[640px] text-left text-xs">
        <caption className="sr-only">
          Desempenho por técnico, ordenado por {ASSIGNEE_SORT_LABEL[sort.key].toLowerCase()} (
          {sort.direction === "desc" ? "decrescente" : "crescente"})
        </caption>
        <thead className="text-faint">
          <tr className="border-b border-border">
            <th scope="col" className="sticky left-0 bg-surface py-2 pr-3 pl-4 font-medium sm:pl-5">
              Técnico
            </th>
            {COLUMNS.map(({ key, hint }) => {
              const active = sort.key === key;
              const Icon = !active ? ArrowUpDown : sort.direction === "desc" ? ArrowDown : ArrowUp;
              return (
                <th
                  key={key}
                  scope="col"
                  aria-sort={active ? (sort.direction === "desc" ? "descending" : "ascending") : "none"}
                  className="px-2 py-1 text-right font-medium last:pr-4 sm:last:pr-5"
                >
                  <button
                    type="button"
                    title={hint}
                    onClick={() => toggle(key)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-1 whitespace-nowrap transition-colors hover:text-text",
                      active && "text-gold",
                    )}
                  >
                    {ASSIGNEE_SORT_LABEL[key]}
                    <Icon className={cn("size-3", !active && "opacity-40")} aria-hidden />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const workload = a.open + a.inProgress + a.pending;
            return (
              <tr key={a.userId} className="border-b border-border/60 last:border-b-0 hover:bg-surface-2/50">
                <th scope="row" className="sticky left-0 bg-surface py-2.5 pr-3 pl-4 font-medium text-text sm:pl-5">
                  <span className="flex items-center gap-2.5">
                    <Initials name={a.name} />
                    <span className="whitespace-nowrap">{a.name}</span>
                  </span>
                </th>
                <Cell>{formatNumber(a.assigned)}</Cell>
                <Cell strong>{formatNumber(a.concluded)}</Cell>
                <Cell>
                  <span
                    title={`${a.open} abertos · ${a.inProgress} em andamento · ${a.pending} pendentes`}
                    className="cursor-help underline decoration-border-strong decoration-dotted underline-offset-4"
                  >
                    {formatNumber(workload)}
                  </span>
                </Cell>
                <Cell>
                  <span className={a.overdue > 0 ? "font-semibold text-danger" : undefined}>{formatNumber(a.overdue)}</span>
                </Cell>
                <Cell>{a.avgResolutionMinutes === null ? <Dash /> : formatDuration(a.avgResolutionMinutes)}</Cell>
                <Cell>{a.onTimePercent === null ? <Dash /> : formatPercent(a.onTimePercent)}</Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <td className={cn("px-3.5 py-2.5 text-right whitespace-nowrap last:pr-5 sm:last:pr-6", strong ? "text-text" : "text-muted")}>
      {children}
    </td>
  );
}

function Dash() {
  return (
    <span className="text-faint" title="Sem conclusões no período">
      —
    </span>
  );
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full border border-gold-line bg-gold-soft text-[10px] font-semibold text-gold"
    >
      {initials}
    </span>
  );
}
