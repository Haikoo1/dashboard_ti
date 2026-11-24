// Conexão única com o banco de dados, compartilhada por toda a aplicação.
//
// Modo de dados (APP_DATA_MODE no .env):
//   "real" (padrão) -> DATABASE_URL       (banco gestao_ti)
//   "demo"          -> DEMO_DATABASE_URL  (banco gestao_ti_demo, dados fictícios)
//
// Em desenvolvimento, o Next.js recarrega os módulos a cada alteração; guardar a
// instância em globalThis evita abrir uma nova conexão a cada recarga.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export type DataMode = "real" | "demo";

export function getDataMode(): DataMode {
  const mode = process.env.APP_DATA_MODE ?? "real";
  if (mode !== "real" && mode !== "demo") {
    throw new Error(`APP_DATA_MODE inválido: "${mode}". Use "real" ou "demo".`);
  }
  return mode;
}

function getConnectionString(mode: DataMode): string {
  const variable = mode === "demo" ? "DEMO_DATABASE_URL" : "DATABASE_URL";
  const url = process.env[variable];
  if (!url) throw new Error(`${variable} não definida. Copie .env.example para .env.`);
  return url;
}

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient(getConnectionString(getDataMode()));

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
