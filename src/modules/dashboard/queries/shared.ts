// Trechos SQL compartilhados pelas consultas do Dashboard.
//
// Princípio: todo indicador "de situação" (abertos, em andamento, pendentes,
// atrasados, carteira dos técnicos) é calculado a partir do HISTÓRICO de eventos.
// Isso permite responder "como estava em qualquer momento" — necessário para
// comparar com o período anterior — usando a mesma regra para hoje e para o passado.
//
// Pré-requisito (a ser garantido pelo futuro módulo de PRs): toda mudança de
// status ou de responsável gera o evento correspondente em pr_eventos.
import { Prisma, type PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;

const { sql } = Prisma;

/** Status em atendimento, em SQL. */
export const ACTIVE_STATUS_SQL = sql`('ABERTO', 'EM_ANDAMENTO', 'PENDENTE')`;

/**
 * CTE "estado_em": situação de cada PR (já aberto) no instante informado.
 * Colunas: id, prazo_em, setor_id, status, responsavel_id.
 */
export function stateAtCte(at: Date) {
  return sql`
    estado_em AS (
      SELECT
        p.id,
        p.prazo_em,
        p.setor_id,
        COALESCE((
          SELECT e.status_novo FROM pr_eventos e
          WHERE e.pr_id = p.id AND e.status_novo IS NOT NULL AND e.criado_em <= ${at}::timestamptz
          ORDER BY e.criado_em DESC, e.id DESC LIMIT 1
        ), 'ABERTO') AS status,
        (
          SELECT e.responsavel_novo_id FROM pr_eventos e
          WHERE e.pr_id = p.id AND e.tipo = 'ATRIBUIDO' AND e.criado_em <= ${at}::timestamptz
          ORDER BY e.criado_em DESC, e.id DESC LIMIT 1
        ) AS responsavel_id
      FROM prs p
      WHERE p.aberto_em <= ${at}::timestamptz
    )`;
}

/**
 * CTE "conclusoes": PRs concluídos dentro da janela [start, end), com o
 * instante da (última) conclusão nessa janela.
 */
export function conclusionsCte(start: Date, end: Date) {
  return sql`
    conclusoes AS (
      SELECT DISTINCT ON (e.pr_id) e.pr_id, e.criado_em AS concluido_em
      FROM pr_eventos e
      WHERE e.tipo = 'STATUS_ALTERADO' AND e.status_novo = 'CONCLUIDO'
        AND e.criado_em >= ${start}::timestamptz AND e.criado_em < ${end}::timestamptz
      ORDER BY e.pr_id, e.criado_em DESC, e.id DESC
    )`;
}

/** Existe algum PR aberto antes do instante? (há base para comparação) */
export async function hasTicketsBefore(db: Db, instant: Date): Promise<boolean> {
  const rows = await db.$queryRaw<{ existe: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM prs WHERE aberto_em < ${instant}::timestamptz) AS existe`;
  return rows[0]?.existe ?? false;
}

/** O momento "atual" de um período é o seu fim (nunca depois de agora). */
export function asOf(window: { end: Date }, now: Date): Date {
  return window.end < now ? window.end : now;
}
