// Conteúdo da página /prs, montado no servidor a cada acesso.
import { AlarmClock, CircleDot, CirclePause, Flame, Inbox, Plus, SearchX, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { cn } from "@/lib/cn";
import { DatabaseOffline } from "@/modules/dashboard/components/database-offline";
import { formatNumber } from "@/modules/dashboard/domain/format";
import { isDatabaseReachable } from "@/modules/dashboard/queries/shared";
import { hasActiveFilters, listFiltersToQuery, parseListFilters, type TicketListFilters } from "../domain/list-filters";
import { countAllTickets, getFilterOptions, getTicketSummary, listTickets, type TicketSummary } from "../queries/list";
import { ListFiltersBar } from "./list-filters-bar";
import { Pagination, TicketsTable } from "./tickets-table";

type SearchParams = Record<string, string | string[] | undefined>;

export async function TicketsView({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  if (!(await isDatabaseReachable(db))) return <DatabaseOffline />;

  const now = new Date();
  const { filters, ignored } = parseListFilters(searchParams);
  const [summary, options, result, totalTickets] = await Promise.all([
    getTicketSummary(db, now),
    getFilterOptions(db),
    listTickets(db, filters, now),
    countAllTickets(db),
  ]);
  const filtered = hasActiveFilters(filters);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Listagem de PRs</h2>
          <p className="mt-0.5 text-sm text-muted">
            {formatNumber(totalTickets)} {totalTickets === 1 ? "PR registrado" : "PRs registrados"} no sistema
          </p>
        </div>
        {/* A abertura de PRs chega na próxima entrega. */}
        <span
          title="Disponível na próxima entrega"
          className="inline-flex w-fit cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-faint"
        >
          <Plus className="size-4" aria-hidden />
          Novo PR
          <span className="rounded border border-border px-1.5 py-px text-[10px] tracking-wide uppercase">Em breve</span>
        </span>
      </div>

      <SummaryCards summary={summary} />

      {ignored.length > 0 && (
        <p role="status" className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
          Alguns filtros do endereço eram inválidos e foram ignorados: {ignored.join(", ")}.
        </p>
      )}

      <div className="group space-y-4">
        <ListFiltersBar filters={filters} options={options} hasFilters={filtered} />

        <section
          aria-label="Lista de PRs"
          className="animate-fade-in overflow-hidden rounded-xl border border-border bg-surface transition-opacity group-has-data-pending:opacity-50"
        >
          {result.total === 0 ? (
            <EmptyList filtered={filtered} noTickets={totalTickets === 0} />
          ) : (
            <>
              <TicketsTable result={result} />
              <Pagination result={result} filters={filters} />
            </>
          )}
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

const SUMMARY: { key: keyof TicketSummary; label: string; icon: LucideIcon; filter: Partial<TicketListFilters>; tone?: string }[] = [
  { key: "open", label: "Abertos", icon: CircleDot, filter: { status: "ABERTO" } },
  { key: "inProgress", label: "Em andamento", icon: Wrench, filter: { status: "EM_ANDAMENTO" } },
  { key: "pending", label: "Pendentes", icon: CirclePause, filter: { status: "PENDENTE" }, tone: "warning" },
  { key: "overdue", label: "Atrasados", icon: AlarmClock, filter: { situation: "atrasado" }, tone: "danger" },
  { key: "critical", label: "Críticos em atendimento", icon: Flame, filter: { situation: "critico" }, tone: "danger" },
];

function SummaryCards({ summary }: { summary: TicketSummary }) {
  return (
    <nav aria-label="Indicadores" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {SUMMARY.map(({ key, label, icon: Icon, filter, tone }) => {
        const value = summary[key];
        const alert = tone && value > 0;
        return (
          <Link
            key={key}
            href={`/prs${listFiltersToQuery(filter)}`}
            className={cn(
              "group/card flex items-center gap-3 rounded-xl border bg-surface px-3.5 py-3 transition-colors hover:border-gold-line",
              alert && tone === "danger" ? "border-danger/35" : alert ? "border-warning/35" : "border-border",
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg border",
                alert && tone === "danger"
                  ? "border-danger/40 bg-danger-soft text-danger"
                  : alert
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-gold-line bg-gold-soft text-gold",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-xl leading-tight font-semibold">{formatNumber(value)}</span>
              <span className="block truncate text-[11px] text-faint group-hover/card:text-muted">{label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function EmptyList({ filtered, noTickets }: { filtered: boolean; noTickets: boolean }) {
  if (noTickets) {
    return (
      <div className="px-6 py-16 text-center">
        <Inbox className="mx-auto size-8 text-gold-dim" strokeWidth={1.5} aria-hidden />
        <p className="mt-3 text-sm font-medium text-muted">Nenhum PR registrado ainda</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-faint">
          Os PRs abertos no sistema aparecem aqui, com filtros e indicadores de prazo.
        </p>
      </div>
    );
  }
  return (
    <div className="px-6 py-16 text-center">
      <SearchX className="mx-auto size-8 text-gold-dim" strokeWidth={1.5} aria-hidden />
      <p className="mt-3 text-sm font-medium text-muted">Nenhum PR encontrado</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-faint">
        {filtered ? "Nenhum PR corresponde aos filtros escolhidos. Ajuste ou limpe os filtros." : "Esta página não tem resultados."}
      </p>
      {filtered && (
        <Link href="/prs" className="mt-4 inline-block rounded-lg px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold-soft">
          Limpar filtros
        </Link>
      )}
    </div>
  );
}

export function TicketsViewSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-12 w-72 animate-pulse rounded bg-surface" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
      <div className="h-28 animate-pulse rounded-xl bg-surface" />
      <div className="h-96 animate-pulse rounded-xl bg-surface" />
    </div>
  );
}
