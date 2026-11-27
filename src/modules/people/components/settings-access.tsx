// Quem pode alterar os cadastros e o aviso correspondente no topo da página.
import { Info, Rocket, ShieldAlert } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "../current-user";
import { isSetupMode } from "../service";

export type SettingsAccess = { setupMode: boolean; current: User | null; canEdit: boolean };

export async function getSettingsAccess(): Promise<SettingsAccess> {
  const [setupMode, current] = await Promise.all([isSetupMode(db), getCurrentUser()]);
  return { setupMode, current, canEdit: setupMode || current?.role === "ADMIN" };
}

export function AccessNotice({ access }: { access: SettingsAccess }) {
  if (access.setupMode) {
    return (
      <div className="flex gap-3 rounded-xl border border-gold-line bg-gold-soft px-4 py-3.5 text-xs leading-relaxed text-muted">
        <Rocket className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
        <div>
          <p className="font-semibold text-text">Primeira configuração</p>
          <p className="mt-0.5">
            Ainda não há administrador ativo, então os cadastros estão liberados. Siga esta ordem:{" "}
            <strong className="text-text">1.</strong> cadastre os setores; <strong className="text-text">2.</strong> cadastre
            um administrador; <strong className="text-text">3.</strong> escolha-o no seletor de usuário (canto superior
            direito). A partir daí, só administradores alteram os cadastros.
          </p>
        </div>
      </div>
    );
  }
  if (!access.canEdit) {
    return (
      <div className="flex gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-xs text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <p>
          Somente leitura. Para cadastrar ou editar, escolha um <strong className="text-text">administrador</strong> no seletor
          de usuário.
        </p>
      </div>
    );
  }
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-[11px] text-faint">
      <ShieldAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
      <p>
        O sistema ainda não tem login: a identificação do usuário serve para registrar quem fez cada ação, não para impedir
        acessos. Nada é excluído; registros fora de uso são desativados para preservar o histórico.
      </p>
    </div>
  );
}
