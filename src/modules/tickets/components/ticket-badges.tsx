// Etiquetas visuais dos PRs: status, prioridade e situação do prazo (SLA).
// Sempre com texto (nunca só cor), para leitura por qualquer pessoa.
import { AlarmClock, CircleCheck, Clock, Hourglass } from "lucide-react";
import type { TicketStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/modules/dashboard/domain/format";
import type { SlaState } from "../domain/sla";
import { STATUS_LABEL } from "../status";

const STATUS_STYLE: Record<TicketStatus, string> = {
  ABERTO: "bg-info/12 text-info ring-info/25",
  EM_ANDAMENTO: "bg-gold-soft text-gold ring-gold-line",
  PENDENTE: "bg-warning/12 text-warning ring-warning/30",
  CONCLUIDO: "bg-success/12 text-success ring-success/25",
  CANCELADO: "bg-surface-3 text-faint ring-border-strong",
};

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset",
        STATUS_STYLE[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: { name: string; color: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
      <span className="size-2 rounded-full" style={{ background: priority.color }} aria-hidden />
      {priority.name}
    </span>
  );
}

/** Situação do prazo de resolução: atrasado, vence em breve, no prazo, concluído... */
export function SlaTag({ sla, compact = false }: { sla: SlaState; compact?: boolean }) {
  const base = "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap";
  switch (sla.kind) {
    case "atrasado":
      return (
        <span className={cn(base, "bg-danger-soft text-danger")} title="Prazo de resolução vencido">
          <AlarmClock className="size-3" aria-hidden />
          {compact ? formatDuration(sla.overdueMinutes) : `Atrasado ${formatDuration(sla.overdueMinutes)}`}
        </span>
      );
    case "proximo":
      return (
        <span className={cn(base, "bg-warning/12 text-warning")} title="Resta 25% ou menos do prazo">
          <Hourglass className="size-3" aria-hidden />
          Vence em {formatDuration(sla.remainingMinutes)}
        </span>
      );
    case "no_prazo":
      return (
        <span className={cn(base, "text-faint")} title="Tempo restante até o prazo">
          <Clock className="size-3" aria-hidden />
          {compact ? formatDuration(sla.remainingMinutes) : `Resta ${formatDuration(sla.remainingMinutes)}`}
        </span>
      );
    case "concluido_no_prazo":
      return (
        <span className={cn(base, "text-success")}>
          <CircleCheck className="size-3" aria-hidden />
          No prazo
        </span>
      );
    case "concluido_com_atraso":
      return (
        <span className={cn(base, "text-danger/80")} title="Concluído depois do prazo">
          <CircleCheck className="size-3" aria-hidden />
          Fora do prazo
        </span>
      );
    case "cancelado":
      return <span className={cn(base, "text-faint")}>—</span>;
  }
}
