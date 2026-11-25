// Moldura comum das seções do Dashboard (título, subtítulo, ações e conteúdo).
import { Clock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  id: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function SectionCard({ id, title, subtitle, actions, className, children }: Props) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "animate-fade-in flex min-w-0 flex-col rounded-xl border border-border bg-surface p-4 transition-opacity sm:p-5",
        "group-has-data-pending:opacity-50",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-sm font-semibold">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-faint">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

/**
 * Indica que os tempos são em tempo corrido. Quando existir o calendário de
 * expediente, este ponto da tela receberá a opção de tempo útil.
 */
export function ElapsedTimeBadge() {
  return (
    <span
      title="Tempo corrido: inclui noites, fins de semana e feriados. O cálculo em horário útil será adicionado quando houver o calendário de expediente."
      className="inline-flex cursor-help items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-faint"
    >
      <Clock className="size-3" aria-hidden />
      Tempo corrido
    </span>
  );
}

/** Mensagem de "sem dados" dentro de uma seção. */
export function SectionEmpty({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-border-strong px-4 py-10 text-center">
      <div className="max-w-xs">
        <span className="mx-auto block w-fit text-gold-dim">{icon}</span>
        <p className="mt-3 text-sm font-medium text-muted">{title}</p>
        {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
      </div>
    </div>
  );
}

export function SectionSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-surface p-4 sm:p-5", className)} aria-hidden>
      <div className="h-4 w-36 animate-pulse rounded bg-surface-3" />
      <div className="mt-2 h-3 w-48 animate-pulse rounded bg-surface-2" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-7 animate-pulse rounded bg-surface-2/70" />
        ))}
      </div>
    </div>
  );
}
