// Pequenas peças visuais compartilhadas pelos painéis de cadastro.
import { CircleCheck, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium",
        active ? "bg-success/10 text-success" : "bg-surface-3 text-faint",
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-faint")} aria-hidden />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

export function Notice({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <p
      role="status"
      className="animate-fade-in flex items-center gap-2 border-b border-success/25 bg-success/10 px-4 py-2.5 text-xs text-success sm:px-5"
    >
      <CircleCheck className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onClose} aria-label="Fechar aviso" className="rounded p-0.5 hover:bg-success/15">
        <X className="size-3.5" />
      </button>
    </p>
  );
}

export function PanelEmpty({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <span className="mx-auto block w-fit text-gold-dim">{icon}</span>
      <p className="mt-3 text-sm font-medium text-muted">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-faint">{hint}</p>
    </div>
  );
}
