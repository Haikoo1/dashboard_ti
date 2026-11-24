import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Áreas do Dashboard e a parte em que cada uma será implementada.
// Nesta etapa (Parte 3) apenas a estrutura visual existe: nenhum número é exibido.
const SECTIONS = [
  { title: "Indicadores principais", part: "Parte 5", span: "md:col-span-3" },
  { title: "Volume de PRs", part: "Parte 6", span: "md:col-span-2" },
  { title: "Alertas de atraso", part: "Parte 8", span: "" },
  { title: "Desempenho dos responsáveis", part: "Parte 7", span: "md:col-span-2" },
  { title: "PRs por setor", part: "Parte 7", span: "" },
  { title: "Atividades recentes", part: "Parte 8", span: "md:col-span-3" },
] as const;

export default function DashboardPage() {
  return (
    <div className="animate-fade-up space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface px-6 py-8 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-gold/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-gold-line bg-gold-soft text-gold">
            <LayoutDashboard className="size-6" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Estrutura do Dashboard pronta</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Menu, barra superior e tema estão concluídos. Os indicadores, gráficos e alertas serão
              conectados ao banco de dados nas próximas partes, sempre com dados registrados no sistema.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className={`flex min-h-36 flex-col justify-between rounded-xl border border-dashed border-border-strong bg-surface/40 p-5 ${section.span}`}
          >
            <h3 className="text-sm font-semibold text-muted">{section.title}</h3>
            <p className="font-mono text-[11px] tracking-wide text-faint uppercase">Previsto: {section.part}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
