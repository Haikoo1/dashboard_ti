"use client";

// Filtro de período do Dashboard.
//
// O período escolhido fica no endereço da página (?periodo=7d, ou
// ?periodo=personalizado&de=AAAA-MM-DD&ate=AAAA-MM-DD). Assim ele sobrevive a
// recarregar a página e pode ser copiado/compartilhado. Quem calcula e valida
// de verdade é o servidor; as checagens aqui só evitam enviar datas impossíveis.
//
// Enquanto o servidor recalcula, o atributo data-pending fica ativo e o
// conteúdo do Dashboard é esmaecido (ver "group-has-data-pending" nos cards).
import { CalendarRange } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { DEFAULT_PERIOD, MAX_CUSTOM_DAYS, PERIOD_KEYS, PERIOD_LABEL, type PeriodKey } from "../domain/period";

type Props = {
  /** Período em exibição. */
  value: PeriodKey;
  /** Datas (AAAA-MM-DD) do período em exibição, usadas para pré-preencher o personalizado. */
  from: string;
  to: string;
  /** Hoje (AAAA-MM-DD, horário de Brasília): limite para a data final. */
  today: string;
};

const SHORT_LABEL: Record<PeriodKey, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  ano: "Este ano",
  personalizado: "Personalizado",
};

export function PeriodFilter({ value, from, to, today }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useOptimistic(value);
  const [customOpen, setCustomOpen] = useState(value === "personalizado");
  const [range, setRange] = useState({ from, to });

  function navigate(next: PeriodKey, dates?: { from: string; to: string }) {
    const params = new URLSearchParams();
    if (next !== DEFAULT_PERIOD) params.set("periodo", next);
    if (dates) {
      params.set("de", dates.from);
      params.set("ate", dates.to);
    }
    const query = params.toString();
    startTransition(() => {
      setSelected(next);
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function choose(key: PeriodKey) {
    if (key === "personalizado") {
      // Pré-preenche com as datas do período em exibição (não as da primeira carga).
      if (!customOpen) setRange({ from, to });
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    if (key !== value) navigate(key);
  }

  const customError = validateCustom(range.from, range.to, today);

  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (customError) return;
    navigate("personalizado", range);
  }

  const highlighted = customOpen ? "personalizado" : selected;

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end" data-pending={isPending ? "" : undefined}>
      <div
        role="group"
        aria-label="Período"
        className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1"
      >
        {PERIOD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={highlighted === key}
            title={PERIOD_LABEL[key]}
            onClick={() => choose(key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:flex-none",
              highlighted === key
                ? "bg-gold-soft text-gold-bright ring-1 ring-gold-line"
                : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            {key === "personalizado" && <CalendarRange className="mr-1.5 -ml-0.5 inline size-3.5 align-[-2px]" />}
            {SHORT_LABEL[key]}
          </button>
        ))}
      </div>

      {customOpen && (
        <form
          onSubmit={applyCustom}
          className="animate-fade-in flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end"
        >
          <DateField label="De" value={range.from} max={today} onChange={(v) => setRange((r) => ({ ...r, from: v }))} />
          <DateField label="Até" value={range.to} max={today} onChange={(v) => setRange((r) => ({ ...r, to: v }))} />
          <div className="flex gap-2">
            {value !== "personalizado" && (
              <button
                type="button"
                onClick={() => setCustomOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={customError !== null || isPending}
              className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-bg transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-40"
            >
              Aplicar
            </button>
          </div>
          {customError && (
            <p role="alert" className="text-xs text-warning sm:basis-full sm:text-right">
              {customError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function DateField(props: { label: string; value: string; max: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-medium tracking-wide text-faint uppercase">
      {props.label}
      <input
        type="date"
        required
        value={props.value}
        max={props.max}
        onChange={(e) => props.onChange(e.target.value)}
        className="rounded-lg border border-border-strong bg-surface-2 px-3 py-1.5 text-sm font-normal tracking-normal text-text normal-case focus:border-gold-line focus:outline-none"
      />
    </label>
  );
}

/** Mesmas regras do servidor, para avisar antes de enviar. Datas AAAA-MM-DD comparam como texto. */
function validateCustom(from: string, to: string, today: string): string | null {
  if (!from || !to) return "Informe as duas datas.";
  if (from > to) return "A data inicial deve ser anterior ou igual à final.";
  if (to > today) return "A data final não pode estar no futuro.";
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (days > MAX_CUSTOM_DAYS) return `O período pode ter no máximo ${MAX_CUSTOM_DAYS} dias.`;
  return null;
}
