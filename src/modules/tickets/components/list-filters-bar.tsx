"use client";

// Pesquisa, filtros e ordenação da listagem. Tudo fica no endereço da página;
// cada alteração volta para a página 1. Enquanto o servidor busca os dados,
// a tabela é esmaecida (data-pending), como no Dashboard.
import { ArrowDownWideNarrow, ArrowUpNarrowWide, FilterX, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import {
  DEFAULT_DIRECTION,
  listFiltersToQuery,
  NO_ASSIGNEE,
  SITUATION_LABEL,
  SITUATIONS,
  SORT_LABEL,
  SORTS,
  type SortKey,
  type TicketListFilters,
} from "../domain/list-filters";
import type { FilterOptions } from "../queries/list";
import { STATUS_LABEL } from "../status";

const STATUSES = Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[];

const control =
  "h-9 w-full rounded-lg border border-border-strong bg-surface-2 px-2.5 text-xs text-text focus:border-gold-line focus:outline-none";

export function ListFiltersBar({
  filters,
  options,
  hasFilters,
}: {
  filters: TicketListFilters;
  options: FilterOptions;
  hasFilters: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q ?? "");

  function apply(changes: Partial<TicketListFilters>) {
    const next: Partial<TicketListFilters> = { ...filters, ...changes, page: 1 };
    startTransition(() => router.push(`${pathname}${listFiltersToQuery(next)}`, { scroll: false }));
  }

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    apply({ q: search.trim() || undefined });
  }

  const set = <K extends keyof TicketListFilters>(key: K) => (value: string) =>
    apply({ [key]: value === "" ? undefined : (value as TicketListFilters[K]) } as Partial<TicketListFilters>);
  const setNumber = <K extends keyof TicketListFilters>(key: K) => (value: string) =>
    apply({ [key]: value === "" ? undefined : Number(value) } as Partial<TicketListFilters>);

  return (
    <div data-pending={isPending ? "" : undefined} className="space-y-3 rounded-xl border border-border bg-surface p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <form onSubmit={onSearch} role="search" className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => (search.trim() || undefined) !== filters.q && apply({ q: search.trim() || undefined })}
            placeholder="Pesquisar por número, título ou solicitante…"
            aria-label="Pesquisar PRs"
            maxLength={100}
            className={cn(control, "pl-9 text-sm")}
          />
        </form>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="ordem">
            Ordenar por
          </label>
          <select
            id="ordem"
            value={filters.sort}
            onChange={(e) => {
              const sort = e.target.value as SortKey;
              apply({ sort, direction: DEFAULT_DIRECTION[sort] });
            }}
            className={cn(control, "sm:w-44")}
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                Ordenar: {SORT_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => apply({ direction: filters.direction === "asc" ? "desc" : "asc" })}
            title={filters.direction === "asc" ? "Ordem crescente (clique para inverter)" : "Ordem decrescente (clique para inverter)"}
            aria-label="Inverter a ordem"
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-strong bg-surface-2 text-muted hover:text-text"
          >
            {filters.direction === "asc" ? <ArrowUpNarrowWide className="size-4" /> : <ArrowDownWideNarrow className="size-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <Select label="Status" value={filters.status} onChange={set("status")}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select label="Situação" value={filters.situation} onChange={set("situation")}>
          {SITUATIONS.map((s) => (
            <option key={s} value={s}>
              {SITUATION_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select label="Prioridade" value={filters.priorityId} onChange={setNumber("priorityId")}>
          {options.priorities.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select label="Categoria" value={filters.categoryId} onChange={setNumber("categoryId")}>
          {options.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          label="Responsável"
          value={filters.assignee}
          onChange={(v) => apply({ assignee: v === "" ? undefined : v === NO_ASSIGNEE ? NO_ASSIGNEE : Number(v) })}
        >
          <option value={NO_ASSIGNEE}>Sem responsável</option>
          {options.assignees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {!u.active && " (inativo)"}
            </option>
          ))}
        </Select>
        <Select label="Setor" value={filters.sectorId} onChange={setNumber("sectorId")}>
          {options.sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <DateInput label="Aberto de" value={filters.openedFrom} onChange={set("openedFrom")} />
        <DateInput label="Aberto até" value={filters.openedTo} onChange={set("openedTo")} />
      </div>

      {hasFilters && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSearch("");
              startTransition(() => router.push(pathname, { scroll: false }));
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text"
          >
            <FilterX className="size-3.5" aria-hidden />
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-medium tracking-wide text-faint uppercase">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cn(control, value !== undefined && "border-gold-line text-gold-bright")}
      >
        <option value="">Todos</option>
        {children}
      </select>
    </label>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string | undefined; onChange: (v: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-medium tracking-wide text-faint uppercase">{label}</span>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cn(control, value && "border-gold-line text-gold-bright")}
      />
    </label>
  );
}
