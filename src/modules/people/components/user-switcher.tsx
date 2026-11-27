"use client";

// Seletor de "usuário atual" na barra superior.
// Sem login: identifica quem faz cada ação, mas não impede a troca de usuário.
import { ChevronDown, Settings, ShieldAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { UserRole } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";
import { setCurrentUserAction } from "../actions";
import { ROLE_LABEL } from "../domain";
import type { UserOption } from "../queries";

type Props = {
  current: { id: number; name: string; role: UserRole } | null;
  users: UserOption[];
};

const GROUPS: { label: string; roles: UserRole[] }[] = [
  { label: "Equipe de TI", roles: ["ADMIN", "TECNICO"] },
  { label: "Solicitantes", roles: ["SOLICITANTE"] },
];

export function UserSwitcher({ current, users }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou com Esc.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(id: number) {
    setError(null);
    startTransition(async () => {
      const result = await setCurrentUserAction(id);
      if (result.ok) setOpen(false);
      else setError(result.message);
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "flex items-center gap-2.5 rounded-lg py-1 pr-1.5 pl-1 transition-colors hover:bg-surface-2 sm:pr-2",
          isPending && "opacity-60",
        )}
      >
        <Avatar name={current?.name ?? null} />
        <span className="hidden text-left leading-tight whitespace-nowrap sm:block">
          <span className="block text-[13px] font-semibold">{current?.name ?? "Escolher usuário"}</span>
          <span className={cn("block text-[11px]", current ? "text-faint" : "text-warning")}>
            {current ? ROLE_LABEL[current.role] : "Nenhum selecionado"}
          </span>
        </span>
        <ChevronDown className={cn("hidden size-3.5 text-faint transition-transform sm:block", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Escolher usuário atual"
          className="animate-fade-in absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-border-strong bg-surface-2 shadow-2xl shadow-black/50"
        >
          <p className="flex items-start gap-2 border-b border-border px-3.5 py-2.5 text-[11px] leading-snug text-faint">
            <ShieldAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
            Sem login: o usuário escolhido fica registrado nas ações, mas qualquer pessoa neste computador pode trocá-lo.
          </p>

          {users.length === 0 ? (
            <p className="px-3.5 py-4 text-xs text-muted">Nenhum usuário cadastrado ainda.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {GROUPS.map((group) => {
                const items = users.filter((u) => group.roles.includes(u.role));
                if (items.length === 0) return null;
                return (
                  <div key={group.label} className="py-1">
                    <p className="px-3.5 py-1 text-[10px] font-semibold tracking-wider text-faint uppercase">{group.label}</p>
                    {items.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={u.id === current?.id}
                        disabled={isPending}
                        onClick={() => choose(u.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs transition-colors hover:bg-surface-3",
                          u.id === current?.id && "bg-gold-soft",
                        )}
                      >
                        <Avatar name={u.name} small />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-text">{u.name}</span>
                          <span className="block truncate text-[11px] text-faint">
                            {ROLE_LABEL[u.role]}
                            {u.sectorName && ` · ${u.sectorName}`}
                          </span>
                        </span>
                        {u.id === current?.id && <span className="size-1.5 rounded-full bg-gold" aria-hidden />}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <p role="alert" className="border-t border-border px-3.5 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          <Link
            href="/configuracoes/usuarios"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-border px-3.5 py-2.5 text-xs text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <Settings className="size-3.5" aria-hidden />
            Gerenciar usuários e setores
          </Link>
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, small = false }: { name: string | null; small?: boolean }) {
  const size = small ? "size-7 text-[10px]" : "size-8 text-[11px]";
  if (!name) {
    return (
      <span className={cn("grid shrink-0 place-items-center rounded-full border border-warning/40 bg-warning/10 text-warning", size)}>
        <UserRound className="size-4" aria-hidden />
      </span>
    );
  }
  const parts = name.trim().split(/\s+/);
  const initials = (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full border border-gold-line bg-gold-soft font-semibold text-gold", size)}
    >
      {initials}
    </span>
  );
}
