-- CreateEnum
CREATE TYPE "status_pr" AS ENUM ('ABERTO', 'EM_ANDAMENTO', 'PENDENTE', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "papel_usuario" AS ENUM ('ADMIN', 'TECNICO', 'SOLICITANTE');

-- CreateEnum
CREATE TYPE "tipo_evento_pr" AS ENUM ('CRIADO', 'ATRIBUIDO', 'PRIORIDADE_ALTERADA', 'STATUS_ALTERADO', 'COMENTARIO');

-- CreateTable
CREATE TABLE "setores" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "setores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "papel" "papel_usuario" NOT NULL,
    "setor_id" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prioridades" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "nivel" INTEGER NOT NULL,
    "cor" VARCHAR(7) NOT NULL,
    "prazo_resposta_min" INTEGER NOT NULL,
    "prazo_resolucao_min" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prioridades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prs" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "status_pr" NOT NULL DEFAULT 'ABERTO',
    "prioridade_id" INTEGER NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "solicitante_id" INTEGER NOT NULL,
    "responsavel_id" INTEGER,
    "setor_id" INTEGER NOT NULL,
    "aberto_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "primeira_resposta_em" TIMESTAMPTZ(3),
    "prazo_em" TIMESTAMPTZ(3) NOT NULL,
    "encerrado_em" TIMESTAMPTZ(3),
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_comentarios" (
    "id" SERIAL NOT NULL,
    "pr_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_eventos" (
    "id" SERIAL NOT NULL,
    "pr_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" "tipo_evento_pr" NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status_anterior" "status_pr",
    "status_novo" "status_pr",
    "prioridade_anterior_id" INTEGER,
    "prioridade_nova_id" INTEGER,
    "responsavel_anterior_id" INTEGER,
    "responsavel_novo_id" INTEGER,
    "comentario_id" INTEGER,

    CONSTRAINT "pr_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "setores_nome_key" ON "setores"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_setor_id_idx" ON "usuarios"("setor_id");

-- CreateIndex
CREATE INDEX "usuarios_papel_ativo_idx" ON "usuarios"("papel", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "prioridades_nome_key" ON "prioridades"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "prioridades_nivel_key" ON "prioridades"("nivel");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nome_key" ON "categorias"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "prs_numero_key" ON "prs"("numero");

-- CreateIndex
CREATE INDEX "prs_status_idx" ON "prs"("status");

-- CreateIndex
CREATE INDEX "prs_aberto_em_idx" ON "prs"("aberto_em");

-- CreateIndex
CREATE INDEX "prs_encerrado_em_idx" ON "prs"("encerrado_em");

-- CreateIndex
CREATE INDEX "prs_prazo_em_idx" ON "prs"("prazo_em");

-- CreateIndex
CREATE INDEX "prs_responsavel_id_idx" ON "prs"("responsavel_id");

-- CreateIndex
CREATE INDEX "prs_solicitante_id_idx" ON "prs"("solicitante_id");

-- CreateIndex
CREATE INDEX "prs_setor_id_idx" ON "prs"("setor_id");

-- CreateIndex
CREATE INDEX "prs_categoria_id_idx" ON "prs"("categoria_id");

-- CreateIndex
CREATE INDEX "prs_prioridade_id_idx" ON "prs"("prioridade_id");

-- CreateIndex
CREATE INDEX "pr_comentarios_pr_id_criado_em_idx" ON "pr_comentarios"("pr_id", "criado_em");

-- CreateIndex
CREATE INDEX "pr_comentarios_autor_id_idx" ON "pr_comentarios"("autor_id");

-- CreateIndex
CREATE UNIQUE INDEX "pr_eventos_comentario_id_key" ON "pr_eventos"("comentario_id");

-- CreateIndex
CREATE INDEX "pr_eventos_criado_em_idx" ON "pr_eventos"("criado_em" DESC);

-- CreateIndex
CREATE INDEX "pr_eventos_pr_id_criado_em_idx" ON "pr_eventos"("pr_id", "criado_em");

-- CreateIndex
CREATE INDEX "pr_eventos_tipo_criado_em_idx" ON "pr_eventos"("tipo", "criado_em");

-- CreateIndex
CREATE INDEX "pr_eventos_usuario_id_idx" ON "pr_eventos"("usuario_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prs" ADD CONSTRAINT "prs_prioridade_id_fkey" FOREIGN KEY ("prioridade_id") REFERENCES "prioridades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prs" ADD CONSTRAINT "prs_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prs" ADD CONSTRAINT "prs_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prs" ADD CONSTRAINT "prs_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prs" ADD CONSTRAINT "prs_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_comentarios" ADD CONSTRAINT "pr_comentarios_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "prs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_comentarios" ADD CONSTRAINT "pr_comentarios_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_eventos" ADD CONSTRAINT "pr_eventos_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "prs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_eventos" ADD CONSTRAINT "pr_eventos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_eventos" ADD CONSTRAINT "pr_eventos_prioridade_anterior_id_fkey" FOREIGN KEY ("prioridade_anterior_id") REFERENCES "prioridades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_eventos" ADD CONSTRAINT "pr_eventos_prioridade_nova_id_fkey" FOREIGN KEY ("prioridade_nova_id") REFERENCES "prioridades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_eventos" ADD CONSTRAINT "pr_eventos_responsavel_anterior_id_fkey" FOREIGN KEY ("responsavel_anterior_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_eventos" ADD CONSTRAINT "pr_eventos_responsavel_novo_id_fkey" FOREIGN KEY ("responsavel_novo_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_eventos" ADD CONSTRAINT "pr_eventos_comentario_id_fkey" FOREIGN KEY ("comentario_id") REFERENCES "pr_comentarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===========================================================================
-- Regras de integridade adicionais (CHECKs), escritas à mão.
-- O Prisma não gera estas regras; elas garantem dados consistentes mesmo que
-- algum código futuro tente gravar valores inválidos.
-- ===========================================================================

-- Usuários: e-mail sempre em minúsculas (evita duplicidade "Ana@" x "ana@").
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_email_minusculo_chk"
  CHECK ("email" = lower("email"));

-- Prioridades: prazos positivos; resposta não pode exceder resolução; cor #RRGGBB.
ALTER TABLE "prioridades" ADD CONSTRAINT "prioridades_prazos_chk"
  CHECK ("prazo_resposta_min" > 0 AND "prazo_resolucao_min" > 0
         AND "prazo_resposta_min" <= "prazo_resolucao_min");
ALTER TABLE "prioridades" ADD CONSTRAINT "prioridades_nivel_chk" CHECK ("nivel" > 0);
ALTER TABLE "prioridades" ADD CONSTRAINT "prioridades_cor_chk"
  CHECK ("cor" ~ '^#[0-9A-Fa-f]{6}$');

-- PRs: datas coerentes com a abertura.
ALTER TABLE "prs" ADD CONSTRAINT "prs_prazo_chk" CHECK ("prazo_em" > "aberto_em");
ALTER TABLE "prs" ADD CONSTRAINT "prs_primeira_resposta_chk"
  CHECK ("primeira_resposta_em" IS NULL OR "primeira_resposta_em" >= "aberto_em");
ALTER TABLE "prs" ADD CONSTRAINT "prs_encerramento_data_chk"
  CHECK ("encerrado_em" IS NULL OR "encerrado_em" >= "aberto_em");
-- "encerrado_em" preenchido se, e somente se, o PR estiver concluído ou cancelado.
ALTER TABLE "prs" ADD CONSTRAINT "prs_encerramento_status_chk"
  CHECK (("status" IN ('CONCLUIDO', 'CANCELADO')) = ("encerrado_em" IS NOT NULL));

-- Eventos: cada tipo exige os campos que o descrevem.
ALTER TABLE "pr_eventos" ADD CONSTRAINT "pr_eventos_campos_por_tipo_chk" CHECK (
  CASE "tipo"
    WHEN 'CRIADO'              THEN "status_novo" = 'ABERTO'
    WHEN 'STATUS_ALTERADO'     THEN "status_anterior" IS NOT NULL AND "status_novo" IS NOT NULL
                                    AND "status_anterior" <> "status_novo"
    WHEN 'PRIORIDADE_ALTERADA' THEN "prioridade_anterior_id" IS NOT NULL AND "prioridade_nova_id" IS NOT NULL
                                    AND "prioridade_anterior_id" <> "prioridade_nova_id"
    WHEN 'ATRIBUIDO'           THEN "responsavel_anterior_id" IS DISTINCT FROM "responsavel_novo_id"
    WHEN 'COMENTARIO'          THEN "comentario_id" IS NOT NULL
  END
);
