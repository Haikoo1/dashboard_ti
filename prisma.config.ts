// Configuração do Prisma (ferramenta de acesso ao banco de dados).
// O Prisma 7 não lê o arquivo .env sozinho; o "dotenv" faz isso.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
