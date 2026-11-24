// Monta (ou recria) o banco de DEMONSTRAÇÃO em três passos:
//   1. aplica as migrações (mesma estrutura do banco real)
//   2. aplica a configuração (prioridades e categorias)
//   3. gera os dados fictícios (prisma/seed-demo.ts)
// Todos os passos usam DEMO_DATABASE_URL. O banco real não é tocado.
//
// Uso: npm run db:demo
import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const demoUrl = process.env.DEMO_DATABASE_URL;
if (!demoUrl || !new URL(demoUrl).pathname.endsWith("_demo")) {
  console.error('\n✖ DEMO_DATABASE_URL ausente ou não aponta para um banco "_demo".\n');
  process.exit(1);
}

const PRISMA = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");

const steps = [
  ["Aplicando migrações", PRISMA, ["migrate", "deploy"]],
  ["Aplicando configuração", TSX, ["prisma/seed.ts"]],
  ["Gerando dados fictícios", TSX, ["prisma/seed-demo.ts"]],
];

for (const [label, script, args] of steps) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    stdio: "inherit",
    // DATABASE_URL redirecionada para o banco de demonstração apenas neste processo.
    env: { ...process.env, DATABASE_URL: demoUrl },
  });
  if (result.status !== 0) {
    console.error(`\n✖ Falha em: ${label}\n`);
    process.exit(result.status ?? 1);
  }
}
