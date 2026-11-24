// Modo de dados da aplicação, definido por APP_DATA_MODE no .env:
//   "real" (padrão) -> banco gestao_ti
//   "demo"          -> banco gestao_ti_demo (dados fictícios)
// Fica separado de db.ts para que a interface possa consultar o modo
// sem abrir conexão com o banco.

export type DataMode = "real" | "demo";

export function getDataMode(): DataMode {
  const mode = process.env.APP_DATA_MODE ?? "real";
  if (mode !== "real" && mode !== "demo") {
    throw new Error(`APP_DATA_MODE inválido: "${mode}". Use "real" ou "demo".`);
  }
  return mode;
}
