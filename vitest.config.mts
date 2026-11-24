// Configuração dos testes automáticos (npm test).
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Prepara o banco de testes (aplica as migrações) uma vez, antes de tudo.
    globalSetup: ["tests/global-setup.ts"],
    // Os testes de integração compartilham o banco de testes: rodam um arquivo por vez.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
