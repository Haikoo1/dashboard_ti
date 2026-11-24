import { connection } from "next/server";
import { FlaskConical } from "lucide-react";
import { getDataMode } from "@/lib/data-mode";

/**
 * Faixa fixa exibida somente quando APP_DATA_MODE=demo.
 * Lida a cada requisição, para refletir o .env atual sem recompilar.
 */
export async function DemoBanner() {
  await connection();
  if (getDataMode() !== "demo") return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warning/40 bg-[repeating-linear-gradient(135deg,rgb(240_163_58/0.16)_0_12px,rgb(240_163_58/0.08)_12px_24px)] px-4 py-1.5 text-center text-[11.5px] font-bold tracking-[0.12em] text-warning uppercase"
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      Dados fictícios — ambiente de demonstração
    </div>
  );
}
