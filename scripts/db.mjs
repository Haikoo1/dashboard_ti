// Controle do banco de dados local de desenvolvimento.
//
// Usa os programas do PostgreSQL já instalado no Windows para manter uma
// instância PRÓPRIA do projeto: dados na pasta .pgdata/, porta própria e
// acesso restrito a este computador. Não interfere no serviço PostgreSQL
// existente e não precisa de Docker nem de virtualização.
//
// Uso:
//   node scripts/db.mjs up       cria (na primeira vez) e liga o banco
//   node scripts/db.mjs down     desliga o banco
//   node scripts/db.mjs status   mostra se está ligado

import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, ".pgdata");
const LOG_FILE = path.join(DATA_DIR, "server.log");

const USER = requireEnv("POSTGRES_USER");
const PASSWORD = requireEnv("POSTGRES_PASSWORD");
const PORT = process.env.POSTGRES_PORT ?? "5433";
// Bancos criados automaticamente: o real e o de demonstração (isolados).
const DATABASES = [requireEnv("POSTGRES_DB"), `${requireEnv("POSTGRES_DB")}_demo`];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`Variável ${name} não definida. Copie .env.example para .env.`);
  return value;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

// Localiza a pasta bin do PostgreSQL. PG_BIN no .env tem prioridade;
// senão, usa a versão mais recente em "C:\Program Files\PostgreSQL".
function findPgBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const base = path.join(process.env.ProgramFiles ?? "C:\\Program Files", "PostgreSQL");
  if (!existsSync(base)) fail(`PostgreSQL não encontrado em ${base}. Defina PG_BIN no .env.`);
  const versions = readdirSync(base)
    .filter((v) => existsSync(path.join(base, v, "bin", "pg_ctl.exe")))
    .sort((a, b) => Number(b) - Number(a));
  if (versions.length === 0) fail(`Nenhuma instalação válida em ${base}. Defina PG_BIN no .env.`);
  return path.join(base, versions[0], "bin");
}

const BIN = findPgBin();
const exe = (name) => path.join(BIN, process.platform === "win32" ? `${name}.exe` : name);

// Executa um programa sem passar pelo shell (evita problemas com caracteres especiais).
// detached: para "pg_ctl start". O servidor continua rodando após o comando e,
// no Windows, herdaria a saída deste processo, que nunca terminaria. Por isso
// a saída é descartada (o log do servidor vai para .pgdata/server.log).
function run(program, args, { allowFail = false, quiet = false, detached = false } = {}) {
  const result = spawnSync(exe(program), args, {
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: PASSWORD },
    stdio: detached ? "ignore" : quiet ? "pipe" : ["ignore", "inherit", "inherit"],
    windowsHide: true,
  });
  if (result.error) fail(`Falha ao executar ${program}: ${result.error.message}`);
  if (result.status !== 0 && !allowFail) fail(`${program} terminou com erro (código ${result.status}).`);
  return result;
}

const isInitialized = () => existsSync(path.join(DATA_DIR, "PG_VERSION"));
const isRunning = () => run("pg_ctl", ["status", "-D", DATA_DIR], { allowFail: true, quiet: true }).status === 0;

function init() {
  console.log("→ Criando a instância do banco em .pgdata/ (somente na primeira vez)...");
  // A senha vai por um arquivo temporário para não aparecer na linha de comando.
  const tmp = mkdtempSync(path.join(tmpdir(), "gestao-ti-"));
  const pwFile = path.join(tmp, "pw");
  writeFileSync(pwFile, PASSWORD, { mode: 0o600 });
  try {
    run("initdb", [
      "-D", DATA_DIR,
      "-U", USER,
      `--pwfile=${pwFile}`,
      "--auth=scram-sha-256",
      "--encoding=UTF8",
      "--locale-provider=icu",
      "--icu-locale=pt-BR", // ordenação alfabética em português
      "--locale=C",
      "-c", `port=${PORT}`,
      "-c", "listen_addresses=localhost", // inacessível por outros computadores
      "-c", "timezone=UTC", // datas gravadas em UTC; conversão na aplicação
      "-c", "log_timezone=UTC",
    ]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function databaseExists(name) {
  const r = run(
    "psql",
    ["-h", "localhost", "-p", PORT, "-U", USER, "-d", "postgres", "-tAc",
      `SELECT 1 FROM pg_database WHERE datname = '${name.replace(/'/g, "''")}'`],
    { quiet: true },
  );
  return r.stdout.trim() === "1";
}

function ensureDatabases() {
  for (const name of DATABASES) {
    if (databaseExists(name)) continue;
    console.log(`→ Criando banco "${name}"...`);
    run("createdb", ["-h", "localhost", "-p", PORT, "-U", USER, name]);
  }
}

function up() {
  if (!isInitialized()) init();
  if (isRunning()) {
    console.log("✔ O banco já estava ligado.");
  } else {
    console.log(`→ Ligando o banco na porta ${PORT}...`);
    run("pg_ctl", ["start", "-D", DATA_DIR, "-l", LOG_FILE, "-w", "-t", "60"], { detached: true });
  }
  ensureDatabases();
  console.log(`✔ Banco pronto em localhost:${PORT} (bancos: ${DATABASES.join(", ")}).`);
}

function down() {
  if (!isInitialized() || !isRunning()) {
    console.log("✔ O banco já está desligado.");
    return;
  }
  console.log("→ Desligando o banco...");
  run("pg_ctl", ["stop", "-D", DATA_DIR, "-m", "fast", "-w"], { quiet: true });
  console.log("✔ Banco desligado.");
}

function status() {
  if (!isInitialized()) console.log("• Instância ainda não criada. Rode: npm run db:up");
  else console.log(isRunning() ? `• Ligado em localhost:${PORT}.` : "• Desligado. Rode: npm run db:up");
}

const commands = { up, down, status };
const command = process.argv[2];
if (!commands[command]) fail("Uso: node scripts/db.mjs <up|down|status>");
commands[command]();
