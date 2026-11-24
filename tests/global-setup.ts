// Executado uma vez antes dos testes: aplica as migrações no banco de TESTES.
// Recusa-se a rodar se TEST_DATABASE_URL não apontar para um banco "_test".
import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";

export default function setup() {
  const url = assertTestDatabaseUrl();
  const prismaCli = path.resolve("node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Falha ao preparar o banco de testes:\n${result.stdout}\n${result.stderr}`);
  }
}

export function assertTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL não definida no .env.");
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`Recusado: "${name}" não é um banco de testes (precisa terminar em "_test").`);
  }
  return url;
}
