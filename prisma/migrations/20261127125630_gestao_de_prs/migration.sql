-- Etapa 02 — Gerenciamento de PRs.
-- Gerada pelo Prisma e completada à mão (preenchimento de dados existentes e CHECKs).

-- CreateEnum
CREATE TYPE "visibilidade_comentario" AS ENUM ('PUBLICO', 'INTERNO');

-- AlterEnum
-- (o novo valor só pode ser usado após o fim desta transação; por isso, abaixo,
--  o CHECK compara "tipo"::text em vez do valor do enum)
ALTER TYPE "tipo_evento_pr" ADD VALUE 'DADOS_ALTERADOS';

-- AlterTable
ALTER TABLE "pr_comentarios" ADD COLUMN     "visibilidade" "visibilidade_comentario" NOT NULL DEFAULT 'PUBLICO';

-- AlterTable
ALTER TABLE "pr_eventos" ADD COLUMN     "alteracoes" JSONB,
ADD COLUMN     "detalhe" TEXT,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "prazo_anterior_em" TIMESTAMPTZ(3),
ADD COLUMN     "prazo_novo_em" TIMESTAMPTZ(3),
ADD COLUMN     "prazo_resposta_anterior_em" TIMESTAMPTZ(3),
ADD COLUMN     "prazo_resposta_novo_em" TIMESTAMPTZ(3);

-- AlterTable: prazo de primeira resposta.
-- PRs já existentes: abertura + SLA de resposta da prioridade atual. Depois, obrigatório.
ALTER TABLE "prs" ADD COLUMN "prazo_resposta_em" TIMESTAMPTZ(3);
UPDATE "prs" p
   SET "prazo_resposta_em" = p."aberto_em" + make_interval(mins => pr."prazo_resposta_min")
  FROM "prioridades" pr
 WHERE pr.id = p."prioridade_id";
ALTER TABLE "prs" ALTER COLUMN "prazo_resposta_em" SET NOT NULL;
ALTER TABLE "prs" ADD CONSTRAINT "prs_prazo_resposta_chk" CHECK ("prazo_resposta_em" > "aberto_em");

-- CreateTable: contador de números de PR por ano.
CREATE TABLE "contador_prs" (
    "ano" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL,

    CONSTRAINT "contador_prs_pkey" PRIMARY KEY ("ano")
);
ALTER TABLE "contador_prs" ADD CONSTRAINT "contador_prs_ultimo_chk" CHECK ("ultimo" > 0);

-- Continua a numeração a partir dos PRs já existentes (formato PR-AAAA-NNNN).
INSERT INTO "contador_prs" ("ano", "ultimo")
SELECT (m[1])::int, MAX((m[2])::int)
  FROM (SELECT regexp_match("numero", '^PR-(\d{4})-(\d+)$') AS m FROM "prs") s
 WHERE m IS NOT NULL
 GROUP BY m[1];

-- Eventos: regra por tipo, agora incluindo a edição de dados.
ALTER TABLE "pr_eventos" DROP CONSTRAINT "pr_eventos_campos_por_tipo_chk";
ALTER TABLE "pr_eventos" ADD CONSTRAINT "pr_eventos_campos_por_tipo_chk" CHECK (
  CASE
    WHEN "tipo"::text = 'CRIADO'              THEN "status_novo" = 'ABERTO'
    WHEN "tipo"::text = 'STATUS_ALTERADO'     THEN "status_anterior" IS NOT NULL AND "status_novo" IS NOT NULL
                                                   AND "status_anterior" <> "status_novo"
    WHEN "tipo"::text = 'PRIORIDADE_ALTERADA' THEN "prioridade_anterior_id" IS NOT NULL AND "prioridade_nova_id" IS NOT NULL
                                                   AND "prioridade_anterior_id" <> "prioridade_nova_id"
    WHEN "tipo"::text = 'ATRIBUIDO'           THEN "responsavel_anterior_id" IS DISTINCT FROM "responsavel_novo_id"
    WHEN "tipo"::text = 'COMENTARIO'          THEN "comentario_id" IS NOT NULL
    WHEN "tipo"::text = 'DADOS_ALTERADOS'     THEN "alteracoes" IS NOT NULL
  END
);

-- Regras novas que valem só para registros gravados a partir de agora
-- (NOT VALID: o histórico já existente não é reavaliado).
-- Pendência, conclusão, cancelamento e reabertura exigem o texto explicativo.
ALTER TABLE "pr_eventos" ADD CONSTRAINT "pr_eventos_detalhe_chk" CHECK (
  "tipo"::text <> 'STATUS_ALTERADO'
  OR NOT ("status_novo" IN ('PENDENTE', 'CONCLUIDO', 'CANCELADO')
          OR "status_anterior" IN ('CONCLUIDO', 'CANCELADO'))
  OR length(btrim(coalesce("detalhe", ''))) > 0
) NOT VALID;
-- Mudança de prioridade registra os prazos antes e depois.
ALTER TABLE "pr_eventos" ADD CONSTRAINT "pr_eventos_prazos_prioridade_chk" CHECK (
  "tipo"::text <> 'PRIORIDADE_ALTERADA'
  OR ("prazo_anterior_em" IS NOT NULL AND "prazo_novo_em" IS NOT NULL
      AND "prazo_resposta_anterior_em" IS NOT NULL AND "prazo_resposta_novo_em" IS NOT NULL)
) NOT VALID;
