// =============================================================================
//  DADOS FICTÍCIOS DE DEMONSTRAÇÃO
// =============================================================================
// Gera setores, usuários e PRs fictícios no banco de DEMONSTRAÇÃO, para que o
// Dashboard possa ser visto funcionando antes de existir o módulo de PRs.
//
// Segurança: o script se recusa a rodar se o banco de destino não terminar
// em "_demo". O banco real (gestao_ti) nunca é tocado.
//
// Os dados são simulados de forma reprodutível (mesma "semente" -> mesmo
// resultado), com datas relativas ao momento da execução, e seguem as mesmas
// regras que o sistema real seguirá (SLA, histórico de eventos, primeira resposta).
//
// Uso: npm run db:demo   (recria o banco de demonstração por completo)
import "dotenv/config";
import { createPrismaClient } from "../src/lib/db";
import type { Prisma } from "../src/generated/prisma/client";
import { TicketEventType, TicketStatus, UserRole } from "../src/generated/prisma/enums";
import { deadlinesAtOpening, deadlinesOnPriorityChange } from "../src/modules/tickets/domain/sla";

const DAYS_OF_HISTORY = 200;
const RANDOM_SEED = 20261124;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const BRT_OFFSET = -3 * HOUR; // horário de Brasília, para simular expediente

const SOLUTIONS = [
  "Problema identificado e corrigido. Testado com o solicitante.",
  "Configuração ajustada e serviço reiniciado.",
  "Equipamento substituído por unidade reserva.",
  "Acesso liberado conforme solicitado.",
  "Atualização aplicada e funcionamento normalizado.",
] as const;

// ---------------------------------------------------------------------------
// Gerador pseudoaleatório determinístico (mulberry32)
// ---------------------------------------------------------------------------
function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    weighted: <T>(items: readonly (readonly [T, number])[]) => {
      const total = items.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [item, w] of items) if ((r -= w) < 0) return item;
      return items[items.length - 1][0];
    },
  };
}

// ---------------------------------------------------------------------------
// Cadastros fictícios
// ---------------------------------------------------------------------------
const SECTORS = [
  ["Administrativo", 14],
  ["Financeiro", 12],
  ["Recursos Humanos", 8],
  ["Comercial", 18],
  ["Produção", 22],
  ["Logística", 13],
  ["Jurídico", 5],
  ["Diretoria", 8],
] as const;

const TECHNICIANS = [
  ["Carlos Mendes", 30],
  ["Juliana Rocha", 26],
  ["Rafael Lima", 20],
  ["Patrícia Alves", 15],
  ["Bruno Teixeira", 9],
] as const;

const FIRST_NAMES = ["Ana", "Bruno", "Camila", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Larissa", "Marcos", "Natália", "Otávio", "Paula", "Renato", "Sabrina", "Thiago", "Vanessa", "William"];
const LAST_NAMES = ["Almeida", "Barbosa", "Cardoso", "Dias", "Esteves", "Ferreira", "Gomes", "Martins", "Nogueira", "Oliveira", "Pereira", "Ribeiro", "Santos", "Vieira"];

const TITLES: Record<string, readonly string[]> = {
  Hardware: ["Computador não liga", "Monitor sem imagem", "Teclado com teclas falhando", "Notebook muito lento", "Solicitação de mouse novo"],
  Software: ["Erro ao abrir o sistema ERP", "Instalação de software solicitada", "Planilha travando ao salvar", "Atualização do antivírus", "Licença do Office expirada"],
  "Rede e Internet": ["Sem acesso à internet", "Wi-Fi instável na sala de reuniões", "Pasta de rede inacessível", "VPN não conecta"],
  Impressoras: ["Impressora não imprime", "Papel atolado na impressora", "Toner acabando", "Scanner não envia para e-mail"],
  "Acessos e Senhas": ["Redefinição de senha", "Acesso a pasta compartilhada", "Usuário bloqueado", "Criação de acesso para novo colaborador"],
  "E-mail": ["Caixa de e-mail cheia", "Não recebe e-mails externos", "Configurar assinatura de e-mail", "E-mail no celular"],
  Telefonia: ["Ramal sem linha", "Transferência de ramal", "Headset com chiado"],
  Outros: ["Dúvida sobre procedimento", "Apoio para reunião por vídeo", "Mudança de estação de trabalho"],
};
const CATEGORY_WEIGHTS: Record<string, number> = {
  Hardware: 16, Software: 22, "Rede e Internet": 12, Impressoras: 15,
  "Acessos e Senhas": 18, "E-mail": 8, Telefonia: 4, Outros: 5,
};
const PRIORITY_WEIGHTS: Record<number, number> = { 1: 7, 2: 21, 3: 46, 4: 26 }; // por nível

// ---------------------------------------------------------------------------
// Segurança: só roda em banco "_demo"
// ---------------------------------------------------------------------------
function assertDemoDatabase(url: string) {
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_demo")) {
    throw new Error(`Recusado: o banco "${dbName}" não é de demonstração (precisa terminar em "_demo").`);
  }
  return dbName;
}

async function main() {
  const url = process.env.DEMO_DATABASE_URL;
  if (!url) throw new Error("DEMO_DATABASE_URL não definida.");
  const dbName = assertDemoDatabase(url);
  const db = createPrismaClient(url);
  const rnd = createRandom(RANDOM_SEED);
  const now = Date.now();

  try {
    const priorities = await db.priority.findMany({ orderBy: { level: "asc" } });
    const categories = await db.category.findMany();
    if (priorities.length === 0 || categories.length === 0) {
      throw new Error("Prioridades/categorias ausentes. Rode o seed de configuração antes.");
    }

    console.log(`→ Limpando dados operacionais de "${dbName}"...`);
    await db.$executeRawUnsafe(
      'TRUNCATE TABLE "pr_eventos", "pr_comentarios", "prs", "usuarios", "setores" RESTART IDENTITY',
    );

    // --- Setores e usuários ------------------------------------------------
    await db.sector.createMany({ data: SECTORS.map(([name]) => ({ name })) });
    const sectors = await db.sector.findMany();
    const sectorByName = new Map(sectors.map((s) => [s.name, s]));
    const ti = await db.sector.create({ data: { name: "Tecnologia da Informação" } });

    await db.user.create({
      data: { name: "Marina Costa", email: "marina.costa@exemplo.demo", role: UserRole.ADMIN, sectorId: ti.id },
    });
    await db.user.createMany({
      data: TECHNICIANS.map(([name]) => ({
        name,
        email: `${slug(name)}@exemplo.demo`,
        role: UserRole.TECNICO,
        sectorId: ti.id,
      })),
    });

    const requesterData: Prisma.UserCreateManyInput[] = [];
    const usedEmails = new Set<string>();
    while (requesterData.length < 36) {
      const name = `${rnd.pick(FIRST_NAMES)} ${rnd.pick(LAST_NAMES)}`;
      const email = `${slug(name)}@exemplo.demo`;
      if (usedEmails.has(email)) continue;
      usedEmails.add(email);
      const sectorName = rnd.weighted(SECTORS.map(([n, w]) => [n, w] as const));
      requesterData.push({ name, email, role: UserRole.SOLICITANTE, sectorId: sectorByName.get(sectorName)!.id });
    }
    await db.user.createMany({ data: requesterData });

    const users = await db.user.findMany();
    const technicians = TECHNICIANS.map(([name, weight]) => [users.find((u) => u.name === name)!, weight] as const);
    const requesters = users.filter((u) => u.role === UserRole.SOLICITANTE);

    // --- Simulação dos PRs ------------------------------------------------
    const tickets: Prisma.TicketCreateManyInput[] = [];
    const comments: Prisma.TicketCommentCreateManyInput[] = [];
    const events: Prisma.TicketEventCreateManyInput[] = [];
    const sequenceByYear = new Map<number, number>();
    let commentId = 0;

    const startDay = startOfBrtDay(now - DAYS_OF_HISTORY * 24 * HOUR);
    for (let day = startDay; day <= now; day += 24 * HOUR) {
      // "day" é o instante (UTC) da meia-noite em Brasília.
      const weekday = new Date(day + BRT_OFFSET).getUTCDay(); // 0 = domingo
      const isWeekend = weekday === 0 || weekday === 6;
      const count = isWeekend ? (rnd.chance(0.3) ? 1 : 0) : rnd.int(4, 10);

      // Aberturas em horário de expediente (8h às 18h de Brasília).
      const openings = Array.from({ length: count }, () => day + rnd.between(8, 18) * HOUR)
        .filter((t) => t <= now)
        .sort((a, b) => a - b);

      for (const openedAt of openings) {
        const ticketId = tickets.length + 1;
        const year = new Date(openedAt + BRT_OFFSET).getUTCFullYear();
        const seq = (sequenceByYear.get(year) ?? 0) + 1;
        sequenceByYear.set(year, seq);

        const level = rnd.weighted(Object.entries(PRIORITY_WEIGHTS).map(([l, w]) => [Number(l), w] as const));
        const priority = priorities.find((p) => p.level === level) ?? priorities[priorities.length - 1];
        const categoryName = rnd.weighted(Object.entries(CATEGORY_WEIGHTS));
        const category = categories.find((c) => c.name === categoryName) ?? rnd.pick(categories);
        const requester = rnd.pick(requesters);
        const tech = rnd.weighted(technicians);
        const initial = deadlinesAtOpening(new Date(openedAt), priority);

        const state = {
          status: TicketStatus.ABERTO as TicketStatus,
          assigneeId: null as number | null,
          firstResponseAt: null as number | null,
          closedAt: null as number | null,
          priorityId: priority.id,
          dueAt: initial.dueAt,
          responseDueAt: initial.responseDueAt,
        };
        let clock = openedAt;
        // Registra um evento somente se já "aconteceu" (não gera eventos no futuro).
        const happen = (at: number) => {
          if (at > now) return false;
          clock = at;
          return true;
        };
        const changeStatus = (to: TicketStatus, actorId: number, detail?: string) => {
          events.push({ ticketId, actorId, type: TicketEventType.STATUS_ALTERADO, fromStatus: state.status, toStatus: to, detail, createdAt: new Date(clock) });
          state.status = to;
          if (to === TicketStatus.CONCLUIDO || to === TicketStatus.CANCELADO) state.closedAt = clock;
          markFirstResponse(actorId);
        };
        const markFirstResponse = (actorId: number) => {
          if (state.firstResponseAt === null && actorId !== requester.id) state.firstResponseAt = clock;
        };
        const comment = (authorId: number, body: string) => {
          commentId += 1;
          comments.push({ id: commentId, ticketId, authorId, body, createdAt: new Date(clock) });
          events.push({ ticketId, actorId: authorId, type: TicketEventType.COMENTARIO, commentId, createdAt: new Date(clock) });
          markFirstResponse(authorId);
        };

        events.push({ ticketId, actorId: requester.id, type: TicketEventType.CRIADO, toStatus: TicketStatus.ABERTO, createdAt: new Date(openedAt) });

        simulate: {
          // 1) Atribuição: maioria dentro do prazo de resposta; ~12% estoura.
          const responseFactor = rnd.chance(0.12) ? rnd.between(1.1, 2.5) : rnd.between(0.05, 0.9);
          if (!happen(clock + priority.responseSlaMinutes * MINUTE * responseFactor)) break simulate;
          events.push({ ticketId, actorId: tech.id, type: TicketEventType.ATRIBUIDO, fromAssigneeId: null, toAssigneeId: tech.id, createdAt: new Date(clock) });
          state.assigneeId = tech.id;
          markFirstResponse(tech.id);

          // Cancelamento ocasional (~3%)
          if (rnd.chance(0.03)) {
            if (!happen(clock + rnd.between(10, 120) * MINUTE)) break simulate;
            comment(tech.id, "PR cancelado: solicitação duplicada.");
            changeStatus(TicketStatus.CANCELADO, tech.id, "Solicitação duplicada de outro PR.");
            break simulate;
          }

          // 2) Início do atendimento
          if (!happen(clock + rnd.between(5, 40) * MINUTE)) break simulate;
          changeStatus(TicketStatus.EM_ANDAMENTO, tech.id);

          // Reclassificação de prioridade ocasional (~6%)
          if (rnd.chance(0.06)) {
            const other = rnd.pick(priorities.filter((p) => p.id !== state.priorityId));
            if (!happen(clock + rnd.between(5, 30) * MINUTE)) break simulate;
            // Mesma política de prazos do sistema real (domain/sla.ts).
            const current = priorities.find((p) => p.id === state.priorityId)!;
            const next = deadlinesOnPriorityChange(
              { openedAt: new Date(openedAt), dueAt: state.dueAt, responseDueAt: state.responseDueAt },
              current,
              other,
              new Date(clock),
            );
            const responseDueAt = state.firstResponseAt === null ? next.responseDueAt : state.responseDueAt;
            events.push({
              ticketId,
              actorId: tech.id,
              type: TicketEventType.PRIORIDADE_ALTERADA,
              fromPriorityId: state.priorityId,
              toPriorityId: other.id,
              fromDueAt: state.dueAt,
              toDueAt: next.dueAt,
              fromResponseDueAt: state.responseDueAt,
              toResponseDueAt: responseDueAt,
              createdAt: new Date(clock),
            });
            state.priorityId = other.id;
            state.dueAt = next.dueAt;
            state.responseDueAt = responseDueAt;
          }

          if (rnd.chance(0.35)) {
            if (!happen(clock + rnd.between(10, 90) * MINUTE)) break simulate;
            comment(tech.id, "Analisando o problema. Retorno em breve.");
          }

          // Pendência ocasional (~22%): aguardando o solicitante
          if (rnd.chance(0.22)) {
            if (!happen(clock + rnd.between(20, 180) * MINUTE)) break simulate;
            comment(tech.id, "Aguardando retorno do solicitante.");
            changeStatus(TicketStatus.PENDENTE, tech.id, "Aguardando informações do solicitante.");
            // Algumas pendências se arrastam por dias (solicitante demora a responder).
            const pendingHours = rnd.chance(0.3) ? rnd.between(24, 240) : rnd.between(1, 30);
            if (!happen(clock + pendingHours * HOUR)) break simulate;
            comment(requester.id, "Informações enviadas.");
            changeStatus(TicketStatus.EM_ANDAMENTO, tech.id);
          }

          // 3) Conclusão: ~76% dentro do prazo de resolução, ~14% com pequeno
          //    atraso e ~10% que se arrastam muito (backlog).
          const resolutionFactor = rnd.weighted([
            [rnd.between(0.15, 0.95), 76],
            [rnd.between(1.05, 3), 14],
            [rnd.between(3, 30), 10],
          ] as const);
          const slaWindow = state.dueAt.getTime() - openedAt;
          const target = Math.max(openedAt + slaWindow * resolutionFactor, clock + 10 * MINUTE);
          if (!happen(target)) break simulate;
          changeStatus(TicketStatus.CONCLUIDO, tech.id, rnd.pick(SOLUTIONS));
        }

        tickets.push({
          id: ticketId,
          number: `PR-${year}-${String(seq).padStart(4, "0")}`,
          title: rnd.pick(TITLES[category.name] ?? TITLES.Outros),
          description: "Descrição fictícia gerada para demonstração do sistema.",
          status: state.status,
          priorityId: state.priorityId,
          categoryId: category.id,
          requesterId: requester.id,
          assigneeId: state.assigneeId,
          sectorId: requester.sectorId!,
          openedAt: new Date(openedAt),
          firstResponseAt: state.firstResponseAt === null ? null : new Date(state.firstResponseAt),
          responseDueAt: state.responseDueAt,
          dueAt: state.dueAt,
          closedAt: state.closedAt === null ? null : new Date(state.closedAt),
        });
      }
    }

    console.log(`→ Gravando ${tickets.length} PRs, ${comments.length} comentários e ${events.length} eventos...`);
    await db.$transaction(async (tx) => {
      await tx.ticket.createMany({ data: tickets });
      await tx.ticketComment.createMany({ data: comments });
      await tx.ticketEvent.createMany({ data: events });
      // Numeração: o próximo PR aberto no sistema continua a sequência de cada ano.
      for (const [year, last] of sequenceByYear) {
        await tx.ticketCounter.upsert({ where: { year }, create: { year, last }, update: { last } });
      }
      // IDs foram definidos manualmente; ajusta os contadores para os próximos registros.
      for (const table of ["prs", "pr_comentarios"]) {
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), GREATEST((SELECT MAX(id) FROM "${table}"), 1))`,
        );
      }
    }, { timeout: 120_000 });

    const byStatus = await db.ticket.groupBy({ by: ["status"], _count: true });
    console.log("✔ Demonstração pronta. PRs por status:");
    for (const row of byStatus) console.log(`   ${row.status.padEnd(13)} ${row._count}`);
  } finally {
    await db.$disconnect();
  }
}

function slug(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, ".");
}

function startOfBrtDay(t: number) {
  const local = t + BRT_OFFSET;
  return local - (local % (24 * HOUR)) - BRT_OFFSET;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
