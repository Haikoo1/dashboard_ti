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
 * Colunas: id, prazo_em (vigente no instante), setor_id, status, responsavel_id.
 */
export function stateAtCte(at: Date) {
  return sql`
    estado_em AS (
      SELECT
        p.id,
        -- Prazo vigente no instante: o último prazo novo registrado até ele; se o
        -- prazo só mudou depois, o prazo anterior à primeira mudança; senão, o atual.
        COALESCE(
          (
            SELECT e.prazo_novo_em FROM pr_eventos e
            WHERE e.pr_id = p.id AND e.prazo_novo_em IS NOT NULL AND e.criado_em <= ${at}::timestamptz
            ORDER BY e.criado_em DESC, e.id DESC LIMIT 1
          ),
          (
            SELECT e.prazo_anterior_em FROM pr_eventos e
            WHERE e.pr_id = p.id AND e.prazo_anterior_em IS NOT NULL AND e.criado_em > ${at}::timestamptz
            ORDER BY e.criado_em ASC, e.id ASC LIMIT 1
          ),
          p.prazo_em
        ) AS prazo_em,
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

/**
 * O banco responde? Usado para mostrar uma orientação clara (em vez de uma
 * tela de erro genérica) quando o banco do projeto está desligado.
 */
export async function isDatabaseReachable(db: Db): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.warn("[dashboard] Banco de dados inacessível:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** Existe pelo menos um PR registrado? (decide entre o Dashboard e o estado vazio) */
export async function hasAnyTicket(db: Db): Promise<boolean> {
  const rows = await db.$queryRaw<{ existe: boolean }[]>`SELECT EXISTS (SELECT 1 FROM prs) AS existe`;
  return rows[0]?.existe ?? false;
}

/** O momento "atual" de um período é o seu fim (nunca depois de agora). */
export function asOf(window: { end: Date }, now: Date): Date {
  return window.end < now ? window.end : now;
}
