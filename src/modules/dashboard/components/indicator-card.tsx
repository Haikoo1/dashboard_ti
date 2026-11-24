// Card de indicador: valor atual + comparação com o período anterior.
// Preparado para virar link (prop "href") quando o módulo de PRs existir;
// até lá não é clicável, para não sugerir uma ação que ainda não funciona.
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Comparison } from "../domain/comparison";
import { describeComparison, formatNumber, type ComparisonView, type TrendMeaning } from "../domain/format";

type Props = {
  label: string;
  icon: LucideIcon;
  value: Comparison;
  meaning: TrendMeaning;
  /** Do que o número trata: "No período", "Situação atual"... */
  scope: string;
  /** Destaque de alerta (ex.: há PRs atrasados). */
  alert?: boolean;
  href?: string;
};

const TONE_CLASS = {
  good: "text-success",
  bad: "text-danger",
  neutral: "text-muted",
} as const;

export function IndicatorCard({ label, icon: Icon, value, meaning, scope, alert = false, href }: Props) {
  const view = describeComparison(value, meaning);

  const body: ReactNode = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-medium text-muted">{label}</h3>
          <p className="mt-0.5 text-[11px] text-faint">{scope}</p>
        </div>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg border",
            alert ? "border-danger/40 bg-danger-soft text-danger" : "border-gold-line bg-gold-soft text-gold",
          )}
        >
          <Icon className="size-4" strokeWidth={1.9} />
        </span>
      </div>

      <p className={cn("mt-4 text-3xl font-semibold tracking-tight", alert && "text-danger")}>
        {formatNumber(value.current)}
      </p>

      <ComparisonLine view={view} className="mt-3 border-t border-border pt-3" />
    </>
  );

  const className = cn(
    "relative flex flex-col rounded-xl border bg-surface p-4 transition-[opacity,border-color] sm:p-5",
    "group-has-data-pending:opacity-50",
    alert ? "border-danger/35" : "border-border",
    href && "hover:border-gold-line focus-visible:border-gold-line",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <article className={className}>{body}</article>
  );
}

/** Linha "↗ +12% vs. anterior (antes: 34)", ou o motivo de não haver comparação. */
export function ComparisonLine({ view, className }: { view: ComparisonView; className?: string }) {
  const Arrow = view.direction === "up" ? ArrowUpRight : view.direction === "down" ? ArrowDownRight : Minus;
  return (
    <p className={cn("flex min-h-5 flex-wrap items-center gap-x-1.5 text-xs", className)}>
      {view.direction === "none" ? (
        <span className="text-faint">{view.detail}</span>
      ) : (
        <>
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", TONE_CLASS[view.tone])}>
            <Arrow className="size-3.5" strokeWidth={2.2} aria-hidden />
            {view.change}
          </span>
          <span className="text-faint">vs. anterior ({view.detail})</span>
        </>
      )}
    </p>
  );
}

export function IndicatorCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-4 sm:p-5" aria-hidden>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-surface-3" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="size-8 animate-pulse rounded-lg bg-surface-2" />
      </div>
      <div className="mt-4 h-8 w-16 animate-pulse rounded bg-surface-3" />
      <div className="mt-3 border-t border-border pt-3">
        <div className="h-3 w-28 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
