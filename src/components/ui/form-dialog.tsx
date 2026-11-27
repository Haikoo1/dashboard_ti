"use client";

// Caixa de diálogo com formulário ligado a uma Server Action.
// Usa o <dialog> nativo do navegador (foco preso, Esc fecha, fundo escurecido).
// Fecha sozinha quando a ação termina com sucesso e avisa o componente pai.
import { X } from "lucide-react";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ActionResult = { ok: boolean; message: string; field?: string; values?: Record<string, string> };

/** Estado do formulário entregue aos campos: campo com erro e valores enviados (após erro). */
export type FormState = { errorField?: string; values?: Record<string, string> };

type Props = {
  title: string;
  description?: string;
  /** Botão que abre o diálogo: conteúdo, classes e rótulo acessível. */
  trigger: { content: ReactNode; className: string; ariaLabel?: string };
  action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;
  submitLabel: string;
  onSuccess?: (message: string) => void;
  /** Campos do formulário; recebem o campo com erro e os valores já digitados. */
  children: (state: FormState) => ReactNode;
};

export function FormDialog({ title, description, trigger, action, submitLabel, onSuccess, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) {
      dialogRef.current?.close();
      onSuccess?.(state.message);
    }
    // onSuccess muda a cada render do pai; só o resultado importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={trigger.ariaLabel}
        className={trigger.className}
      >
        {trigger.content}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${title}-titulo`}
        className="m-auto w-[min(100%-2rem,32rem)] rounded-2xl border border-border-strong bg-surface p-0 text-text shadow-2xl shadow-black/60 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form action={formAction} className="flex flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 id={`${title}-titulo`} className="text-base font-semibold">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-xs text-faint">{description}</p>}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar"
              className="-mr-1 rounded-md p-1 text-faint hover:bg-surface-3 hover:text-text"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="space-y-4 px-5 py-5">{children(state && !state.ok ? { errorField: state.field, values: state.values } : {})}</div>

          {state && !state.ok && (
            <p role="alert" className="mx-5 mb-4 rounded-lg border border-danger/35 bg-danger-soft px-3 py-2 text-xs text-danger">
              {state.message}
            </p>
          )}

          <footer className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-3.5 py-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-bg transition-colors hover:bg-gold-bright disabled:opacity-50"
            >
              {pending ? "Salvando…" : submitLabel}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

/** Rótulo + campo + dica, com destaque quando o campo tem erro. */
export function Field({
  label,
  hint,
  invalid = false,
  children,
}: {
  label: string;
  hint?: string;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <span className={cn("block", invalid && "[&_input]:border-danger/60 [&_select]:border-danger/60")}>{children}</span>
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-faint focus:border-gold-line focus:outline-none disabled:opacity-50";
