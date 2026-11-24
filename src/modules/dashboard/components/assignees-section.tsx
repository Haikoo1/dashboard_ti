// Seção "Desempenho dos técnicos".
import { UserRoundX, UsersRound } from "lucide-react";
import { db } from "@/lib/db";
import { elapsedTime } from "../domain/duration";
import { formatNumber } from "../domain/format";
import type { DashboardRange } from "../domain/period";
import { getAssigneeReport } from "../queries/assignees";
import { AssigneesTable } from "./assignees-table";
import { ElapsedTimeBadge, SectionCard, SectionEmpty, SectionSkeleton } from "./section-card";

export async function AssigneesSection({ range }: { range: DashboardRange }) {
  const { assignees, unassigned } = await getAssigneeReport(db, range, elapsedTime);

  return (
    <SectionCard
      id="tecnicos-titulo"
      title="Desempenho dos técnicos"
      subtitle="Clique no título de uma coluna para ordenar"
      actions={<ElapsedTimeBadge />}
      className="h-full"
    >
      {assignees.length === 0 ? (
        <SectionEmpty
          icon={<UsersRound className="size-7" strokeWidth={1.6} />}
          title="Nenhum técnico cadastrado"
          hint="Os técnicos aparecem aqui assim que forem cadastrados ou receberem PRs."
        />
      ) : (
        <>
          <AssigneesTable assignees={assignees} />
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-[11px] text-faint">
            <span>Atribuídos e concluídos: no período. Carteira e atrasados: situação no fim do período.</span>
            {unassigned.open > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-warning/35 bg-warning/10 px-2 py-1 text-warning">
                <UserRoundX className="size-3.5" aria-hidden />
                {formatNumber(unassigned.open)} sem responsável
                {unassigned.overdue > 0 && ` (${formatNumber(unassigned.overdue)} atrasados)`}
              </span>
            )}
          </div>
        </>
      )}
    </SectionCard>
  );
}

export function AssigneesSectionSkeleton() {
  return <SectionSkeleton rows={6} className="h-full" />;
}
