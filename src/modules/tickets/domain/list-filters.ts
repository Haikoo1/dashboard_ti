// Filtros da listagem de PRs, lidos do endereço da página.
// Ex.: /prs?status=EM_ANDAMENTO&prioridade=1&situacao=atrasado&ordem=prazo&pagina=2
//
// Valores inválidos são ignorados (o filtro some) e informados à tela, para que
// um link antigo ou digitado errado nunca quebre a página.
import { z } from "zod";
import { TicketStatus } from "@/generated/prisma/enums";
import { parseIsoDate } from "@/lib/time-zone";

export const SITUATIONS = ["atrasado", "proximo", "critico"] as const;
export type Situation = (typeof SITUATIONS)[number];

export const SITUATION_LABEL: Record<Situation, string> = {
  atrasado: "Atrasados",
  proximo: "Próximos do vencimento",
  critico: "Críticos em atendimento",
};

export const SORTS = ["abertura", "prioridade", "prazo"] as const;
export type SortKey = (typeof SORTS)[number];

export const SORT_LABEL: Record<SortKey, string> = {
  abertura: "Data de abertura",
  prioridade: "Prioridade",
  prazo: "Prazo",
};

/** Direção padrão de cada ordenação (mais recentes, mais urgentes, prazos mais próximos). */
export const DEFAULT_DIRECTION: Record<SortKey, "asc" | "desc"> = { abertura: "desc", prioridade: "asc", prazo: "asc" };

export const PAGE_SIZE = 20;

/** Valor especial do filtro de responsável: PRs sem responsável. */
export const NO_ASSIGNEE = "nenhum";

export type TicketListFilters = {
  q?: string;
  status?: TicketStatus;
  priorityId?: number;
  categoryId?: number;
  assignee?: number | typeof NO_ASSIGNEE;
  sectorId?: number;
  situation?: Situation;
  /** Período de abertura (dias inteiros, horário de Brasília). */
  openedFrom?: string;
  openedTo?: string;
  /** Período de conclusão (usado pelo link do card "Concluídos" do Dashboard). */
  closedFrom?: string;
  closedTo?: string;
  sort: SortKey;
  direction: "asc" | "desc";
  page: number;
};

/** Nomes dos parâmetros no endereço (em português, como o restante do sistema). */
export const PARAM = {
  q: "busca",
  status: "status",
  priorityId: "prioridade",
  categoryId: "categoria",
  assignee: "responsavel",
  sectorId: "setor",
  situation: "situacao",
  openedFrom: "aberto_de",
  openedTo: "aberto_ate",
  closedFrom: "concluido_de",
  closedTo: "concluido_ate",
  sort: "ordem",
  direction: "direcao",
  page: "pagina",
} as const satisfies Record<keyof TicketListFilters, string>;

type SearchParams = Record<string, string | string[] | undefined>;

const id = z.coerce.number().int().positive();
const isoDate = z.string().refine((v) => parseIsoDate(v) !== null);

const FIELDS = {
  q: z.string().trim().min(1).max(100),
  status: z.enum(TicketStatus),
  priorityId: id,
  categoryId: id,
  assignee: z.union([z.literal(NO_ASSIGNEE), id]),
  sectorId: id,
  situation: z.enum(SITUATIONS),
  openedFrom: isoDate,
  openedTo: isoDate,
  closedFrom: isoDate,
  closedTo: isoDate,
  sort: z.enum(SORTS),
  direction: z.enum(["asc", "desc"]),
  page: id,
} as const;

export function parseListFilters(params: SearchParams): { filters: TicketListFilters; ignored: string[] } {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const result: Record<string, unknown> = {};
  const ignored: string[] = [];

  for (const [key, schema] of Object.entries(FIELDS)) {
    const raw = first(params[PARAM[key as keyof typeof PARAM]]);
    if (raw === undefined || raw === "") continue;
    const parsed = schema.safeParse(raw);
    if (parsed.success) result[key] = parsed.data;
    else ignored.push(PARAM[key as keyof typeof PARAM]);
  }

  const sort = (result.sort as SortKey | undefined) ?? "abertura";
  return {
    filters: {
      ...(result as Partial<TicketListFilters>),
      sort,
      direction: (result.direction as "asc" | "desc" | undefined) ?? DEFAULT_DIRECTION[sort],
      page: (result.page as number | undefined) ?? 1,
    },
    ignored,
  };
}

/** Monta o endereço da listagem a partir dos filtros (omitindo os valores padrão). */
export function listFiltersToQuery(filters: Partial<TicketListFilters>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "page" && value === 1) continue;
    if (key === "sort" && value === "abertura") continue;
    if (key === "direction" && value === DEFAULT_DIRECTION[(filters.sort ?? "abertura") as SortKey]) continue;
    params.set(PARAM[key as keyof typeof PARAM], String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Há algum filtro aplicado (além de ordenação e página)? */
export function hasActiveFilters(filters: TicketListFilters): boolean {
  return Object.entries(filters).some(([key, value]) => !["sort", "direction", "page"].includes(key) && value !== undefined);
}
