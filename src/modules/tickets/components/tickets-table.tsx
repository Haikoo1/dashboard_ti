// Tabela da listagem de PRs, com paginação.
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatNumber } from "@/modules/dashboard/domain/format";
import { listFiltersToQuery, type TicketListFilters } from "../domain/list-filters";
import type { TicketListItem, TicketListResult } from "../queries/list";
import { PriorityTag, SlaTag, StatusBadge } from "./ticket-badges";

export function TicketsTable({ result }: { result: TicketListResult }) {
  return (
    <div className="-mx-px overflow-x-auto">
      <table className="w-full min-w-[1200px] text-left text-xs">
        <thead className="text-faint">
          <tr className="border-b border-border">
            <Th className="sticky left-0 z-10 bg-surface pl-4 sm:pl-5">Número</Th>
            <Th>Título</Th>
            <Th>Solicitante</Th>
            <Th>Setor</Th>
            <Th>Categoria</Th>
            <Th>Prioridade</Th>
            <Th>Responsável</Th>
            <Th>Status</Th>
            <Th>Abertura</Th>
            <Th>Prazo</Th>
            <Th className="pr-4 sm:pr-5">Situação do prazo</Th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((t) => (
            <Row key={t.id} ticket={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ ticket: t }: { ticket: TicketListItem }) {
  const overdue = t.sla.kind === "atrasado";
  return (
    <tr
      className={cn(
        "border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2/60",
        t.critical && "bg-danger-soft/40",
      )}
    >
      <td
        className={cn(
          "sticky left-0 z-10 border-l-2 py-2.5 pr-3 pl-3.5 font-mono font-medium whitespace-nowrap sm:pl-4.5",
          t.critical ? "border-l-danger bg-[color-mix(in_oklab,var(--surface)_85%,var(--danger))]" : "border-l-transparent bg-surface",
        )}
      >
        <span className="inline-flex items-center gap-1.5 text-text">
          {t.critical && <Flame className="size-3.5 text-danger" aria-label="Crítico" />}
          {t.number}
        </span>
      </td>
      <td className="max-w-80 min-w-56 px-3 py-2.5">
        <span className="line-clamp-2 font-medium text-text" title={t.title}>
          {t.title}
        </span>
      </td>
      <Td>{t.requesterName}</Td>
      <Td>{t.sectorName}</Td>
      <Td>{t.categoryName}</Td>
      <td className="px-3 py-2.5">
        <PriorityTag priority={t.priority} />
      </td>
      <Td>{t.assigneeName ?? <span className="text-warning">Sem responsável</span>}</Td>
      <td className="px-3 py-2.5">
        <StatusBadge status={t.status} />
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-muted" title={formatDateTime(t.openedAt)}>
        {formatDate(t.openedAt)}
      </td>
      <td className={cn("px-3 py-2.5 whitespace-nowrap", overdue ? "font-medium text-danger" : "text-muted")}>
        {formatDateTime(t.dueAt)}
      </td>
      <td className="py-2.5 pr-4 pl-3 sm:pr-5">
        <SlaTag sla={t.sla} />
      </td>
    </tr>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2.5 font-medium whitespace-nowrap", className)}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 whitespace-nowrap text-muted">{children}</td>;
}

export function Pagination({ result, filters }: { result: TicketListResult; filters: TicketListFilters }) {
  const first = (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.page * result.pageSize, result.total);
  const href = (page: number) => `/prs${listFiltersToQuery({ ...filters, page })}`;
  const pages = pageWindow(result.page, result.pageCount);

  return (
    <nav aria-label="Paginação" className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs sm:flex-row sm:px-5">
      <p className="text-faint">
        Mostrando <span className="text-muted">{formatNumber(first)}</span>–<span className="text-muted">{formatNumber(last)}</span> de{" "}
        <span className="text-muted">{formatNumber(result.total)}</span> PRs
      </p>
      {result.pageCount > 1 && (
        <div className="flex items-center gap-1">
          <PageLink href={href(result.page - 1)} disabled={result.page === 1} label="Página anterior">
            <ChevronLeft className="size-4" />
          </PageLink>
          {pages.map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1 text-faint">
                …
              </span>
            ) : (
              <PageLink key={p} href={href(p)} current={p === result.page} label={`Página ${p}`}>
                {p}
              </PageLink>
            ),
          )}
          <PageLink href={href(result.page + 1)} disabled={result.page === result.pageCount} label="Próxima página">
            <ChevronRight className="size-4" />
          </PageLink>
        </div>
      )}
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  current,
  label,
  children,
}: {
  href: string;
  disabled?: boolean;
  current?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const cls = "grid h-8 min-w-8 place-items-center rounded-lg px-2 font-medium transition-colors";
  if (disabled) {
    return (
      <span aria-disabled className={cn(cls, "text-faint/50")} aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={cn(cls, current ? "bg-gold-soft text-gold-bright ring-1 ring-gold-line" : "text-muted hover:bg-surface-2 hover:text-text")}
    >
      {children}
    </Link>
  );
}

/** Páginas exibidas: primeira, última e vizinhas da atual, com "…" nos saltos. */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}
