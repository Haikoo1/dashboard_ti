// Seção "Alertas de atraso": PRs em atendimento com o prazo vencido.
// Sempre mostra a situação ATUAL (não depende do filtro de período):
// prioridade crítica primeiro, depois os prazos vencidos há mais tempo.
import { AlarmClock, CircleCheckBig, Flame, UserRoundX } from "lucide-react";
import { db } from "@/lib/db";
import { cn } from "@/lib/cn";
import { STATUS_LABEL } from "@/modules/tickets/status";
import { formatDateTime, formatDuration, formatNumber } from "../domain/format";
import { getOverdueAlerts, type OverdueAlert } from "../queries/alerts";
import { SectionCard, SectionSkeleton } from "./section-card";

const LIMIT = 8;

/** @param className permite encaixar a seção na altura da linha (ver dashboard-view). */
export async function AlertsSection({ now, className }: { now: Date; className?: string }) {
  const alerts = await getOverdueAlerts(db, now, LIMIT);
  const hidden = alerts.total - alerts.items.length;

  return (
    <SectionCard
      id="alertas-titulo"
      title="Alertas de atraso"
      subtitle="Situação atual, independente do período"
      className={className}
      actions={
        alerts.total > 0 && (
          <div className="flex gap-1.5 text-[11px]">
            <span className="rounded-md border border-danger/35 bg-danger-soft px-2 py-1 font-semibold text-danger">
              {formatNumber(alerts.total)} {alerts.total === 1 ? "atrasado" : "atrasados"}
            </span>
            {alerts.critical > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-danger px-2 py-1 font-semibold text-bg">
                <Flame className="size-3" aria-hidden />
                {formatNumber(alerts.critical)} {alerts.critical === 1 ? "crítico" : "críticos"}
              </span>
            )}
          </div>
        )
      }
    >
      {alerts.total === 0 ? (
        <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-success/30 bg-success/5 px-4 py-10 text-center">
          <div className="max-w-xs">
            <CircleCheckBig className="mx-auto size-7 text-success" strokeWidth={1.6} aria-hidden />
            <p className="mt-3 text-sm font-medium text-text">Nenhum PR atrasado</p>
            <p className="mt-1 text-xs text-faint">Todos os PRs em atendimento estão dentro do prazo.</p>
          </div>
        </div>
      ) : (
        <>
          <ol className="-mr-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
            {alerts.items.map((alert) => (
              <AlertItem key={alert.ticketId} alert={alert} />
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-faint">
            {hidden > 0
              ? `Mostrando os ${alerts.items.length} mais urgentes. Outros ${formatNumber(hidden)} também estão atrasados.`
              : "Ordenados por prioridade e tempo de atraso."}
          </p>
        </>
      )}
    </SectionCard>
  );
}

function AlertItem({ alert }: { alert: OverdueAlert }) {
  return (
    <li
      className={cn(
        "rounded-lg border p-3",
        alert.critical ? "border-danger/45 bg-danger-soft" : "border-border bg-surface-2/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] whitespace-nowrap text-faint">
            <span className="font-mono font-medium text-muted">{alert.number}</span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>·</span>
              <span className="size-2 rounded-full" style={{ background: alert.priority.color }} aria-hidden />
              {alert.priority.name}
            </span>
            <span>
              <span aria-hidden>· </span>
              {STATUS_LABEL[alert.status]}
            </span>
          </p>
          <p className="mt-1 truncate text-[13px] font-medium text-text" title={alert.title}>
            {alert.title}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
            alert.critical ? "bg-danger text-bg" : "bg-danger-soft text-danger",
          )}
          title="Tempo desde o vencimento do prazo"
        >
          <AlarmClock className="size-3" aria-hidden />
          {formatDuration(alert.overdueMinutes)}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <Field label="Solicitante" value={alert.requesterName} />
        <Field
          label="Responsável"
          value={
            alert.assigneeName ?? (
              <span className="inline-flex items-center gap-1 text-warning">
                <UserRoundX className="size-3" aria-hidden />
                Sem responsável
              </span>
            )
          }
        />
        <Field label="Aberto em" value={formatDateTime(alert.openedAt)} />
        <Field label="Prazo" value={formatDateTime(alert.dueAt)} />
      </dl>
    </li>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-faint">{label}</dt>
      <dd className="truncate text-muted">{value}</dd>
    </div>
  );
}

export function AlertsSectionSkeleton({ className }: { className?: string }) {
  return <SectionSkeleton rows={5} className={className} />;
}
