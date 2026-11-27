import type { Metadata } from "next";
import { SettingsTabs } from "@/modules/people/components/settings-tabs";

export const metadata: Metadata = { title: "Configurações" };

// Cadastros mínimos necessários para o gerenciamento de PRs.
export default function ConfiguracoesLayout({ children }: LayoutProps<"/configuracoes">) {
  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Usuários e setores</h2>
        <p className="mt-0.5 text-sm text-muted">Cadastros usados para abrir, atribuir e acompanhar os PRs.</p>
      </div>
      <SettingsTabs />
      {children}
    </div>
  );
}
