"use client";

// Escolha do agrupamento do gráfico (dia / semana / mês), guardada no endereço
// (?agrupar=semana) junto com o período atual. Só aparecem as opções que fazem
// sentido para o tamanho do período.
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { cn } from "@/lib/cn";
import { GRANULARITY_LABEL, type Granularity } from "../domain/period";

type Props = {
  value: Granularity;
  options: Granularity[];
  /** Agrupamento sugerido para o período (não precisa aparecer no endereço). */
  suggested: Granularity;
  /** Parâmetros do período atual, mantidos ao trocar o agrupamento. */
  periodParams: Record<string, string>;
};

export function GranularityPicker({ value, options, suggested, periodParams }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useOptimistic(value);

  if (options.length < 2) return null;

  function choose(next: Granularity) {
    if (next === value) return;
    const params = new URLSearchParams(periodParams);
    if (next !== suggested) params.set("agrupar", next);
    const query = params.toString();
    startTransition(() => {
      setSelected(next);
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div
      role="group"
      aria-label="Agrupar por"
      data-pending={isPending ? "" : undefined}
      className="flex gap-0.5 rounded-lg border border-border bg-bg/40 p-0.5"
    >
      {options.map((g) => (
        <button
          key={g}
          type="button"
          aria-pressed={selected === g}
          onClick={() => choose(g)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            selected === g ? "bg-surface-3 text-text" : "text-faint hover:text-text",
          )}
        >
          {GRANULARITY_LABEL[g]}
        </button>
      ))}
    </div>
  );
}
