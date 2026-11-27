// Seção "Atividades recentes": linha do tempo das últimas ações em todos os PRs.
// Não depende do filtro de período: mostra sempre o que aconteceu por último.
import {
  ArrowRightLeft,
  CircleCheck,
  CircleX,
  Flag,
  History,
  Inbox,
  MessageSquare,
  PencilLine,
  RotateCcw,
  UserRoundCheck,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { cn } from "@/lib/cn";
import type { Activity, ActivityKind } from "../domain/activity";
import { formatDateTime, formatRelative } from "../domain/format";
import { getRecentActivity } from "../queries/activity";
import { SectionCard, SectionEmpty, SectionSkeleton } from "./section-card";

const LIMIT = 10;

const KIND_STYLE: Record<ActivityKind, { icon: LucideIcon; className: string }> = {
  aberto: { icon: Inbox, className: "text-info" },
  atribuido: { icon: UserRoundCheck, className: "text-gold" },
  responsavel_removido: { icon: UserRoundX, className: "text-warning" },
  prioridade: { icon: Flag, className: "text-warning" },
  status: { icon: ArrowRightLeft, className: "text-muted" },
  concluido: { icon: CircleCheck, className: "text-success" },
  cancelado: { icon: CircleX, className: "text-faint" },
  reaberto: { icon: RotateCcw, className: "text-warning" },
  comentario: { icon: MessageSquare, className: "text-muted" },
  editado: { icon: PencilLine, className: "text-muted" },
};

export async function ActivitySection({ now }: { now: Date }) {
  const activities = await getRecentActivity(db, LIMIT);

  return (
    <SectionCard
      id="atividades-titulo"
      title="Atividades recentes"
      subtitle="Últimas ações em todos os PRs"
      className="h-full"
    >
      {activities.length === 0 ? (
        <SectionEmpty
          icon={<History className="size-7" strokeWidth={1.6} />}
          title="Nenhuma atividade registrada"
          hint="Aberturas, atribuições, comentários e conclusões aparecem aqui."
        />
      ) : (
        <ol className="relative">
          {activities.map((a, i) => (
            <ActivityItem key={a.id} activity={a} now={now} last={i === activities.length - 1} />
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function ActivityItem({ activity: a, now, last }: { activity: Activity; now: Date; last: boolean }) {
  const { icon: Icon, className } = KIND_STYLE[a.kind];
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* Linha vertical ligando os itens */}
      {!last && <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-border" />}
      <span
        className={cn("relative grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface-2", className)}
      >
        <Icon className="size-4" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-xs leading-relaxed text-muted">
          <span className="font-semibold text-text">{a.actorName}</span> <ActionText activity={a} />
        </p>
        {a.excerpt && (
          <p className="mt-1 line-clamp-2 border-l-2 border-border-strong pl-2 text-[11px] text-faint italic">
            {a.excerpt}
          </p>
        )}
        <time dateTime={a.createdAt.toISOString()} title={formatDateTime(a.createdAt)} className="mt-0.5 block text-[11px] text-faint">
          {formatRelative(a.createdAt, now)}
        </time>
      </div>
    </li>
  );
}

/** Destaca o número do PR dentro da frase ("concluiu o PR-2026-0012"). */
function ActionText({ activity: a }: { activity: Activity }) {
  const [before, ...rest] = a.action.split(a.ticketNumber);
  if (rest.length === 0) return <>{a.action}</>;
  return (
    <>
      {before}
      <span className="font-mono text-[11px] font-medium whitespace-nowrap text-gold">{a.ticketNumber}</span>
      {rest.join(a.ticketNumber)}
    </>
  );
}

export function ActivitySectionSkeleton() {
  return <SectionSkeleton rows={6} className="h-full" />;
}
