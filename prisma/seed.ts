// Seed de CONFIGURAÇÃO: prioridades (com SLA) e categorias iniciais.
// Não são dados operacionais; são parâmetros do sistema, editáveis no futuro
// módulo de Configurações. Pode ser executado várias vezes sem duplicar nada.
//
// Uso: npm run db:seed   (usa DATABASE_URL)
import "dotenv/config";
import { createPrismaClient } from "../src/lib/db";

const HOUR = 60;

/** SLA em minutos corridos. resposta = até a primeira ação de um técnico. */
export const PRIORITIES = [
  { level: 1, name: "Crítica", color: "#EF4444", responseSlaMinutes: 1 * HOUR, resolutionSlaMinutes: 4 * HOUR },
  { level: 2, name: "Alta", color: "#F97316", responseSlaMinutes: 2 * HOUR, resolutionSlaMinutes: 8 * HOUR },
  { level: 3, name: "Média", color: "#3B82F6", responseSlaMinutes: 4 * HOUR, resolutionSlaMinutes: 24 * HOUR },
  { level: 4, name: "Baixa", color: "#6B7280", responseSlaMinutes: 8 * HOUR, resolutionSlaMinutes: 72 * HOUR },
] as const;

export const CATEGORIES = [
  "Hardware",
  "Software",
  "Rede e Internet",
  "Impressoras",
  "Acessos e Senhas",
  "E-mail",
  "Telefonia",
  "Outros",
] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida.");
  const db = createPrismaClient(url);
  try {
    for (const p of PRIORITIES) {
      // Cria se não existir. Se já existir, NÃO sobrescreve: o administrador
      // pode ter ajustado os prazos.
      await db.priority.upsert({ where: { level: p.level }, update: {}, create: p });
    }
    for (const name of CATEGORIES) {
      await db.category.upsert({ where: { name }, update: {}, create: { name } });
    }
    const [priorities, categories] = await Promise.all([db.priority.count(), db.category.count()]);
    console.log(`✔ Configuração pronta: ${priorities} prioridades, ${categories} categorias.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
