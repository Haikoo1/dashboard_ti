"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search, UserRound } from "lucide-react";
import { findNavItem } from "@/config/navigation";

type TopbarProps = {
  onOpenMenu: () => void;
  menuOpen: boolean;
  /** Data atual, renderizada no servidor (ver CurrentDate). */
  date: ReactNode;
  /** Faixa do modo demonstração (fica fixa junto com a barra). */
  banner: ReactNode;
};

/**
 * Barra superior: título da página, data, pesquisa, notificações e perfil.
 * Pesquisa, notificações e perfil são apenas estrutura visual nesta etapa;
 * ficam identificados como indisponíveis e não exibem dados inventados.
 */
export function Topbar({ onOpenMenu, menuOpen, date, banner }: TopbarProps) {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const title = item?.pageTitle ?? item?.label ?? "Gestão de TI";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
      {banner}
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          aria-controls="menu-principal"
          aria-expanded={menuOpen}
          className="-ml-1 rounded-md p-2 text-muted hover:bg-surface-3 hover:text-text md:hidden"
        >
          <Menu className="size-5" />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-lg leading-tight font-semibold tracking-tight sm:text-xl">{title}</h1>
          <p className="truncate text-xs text-muted first-letter:uppercase">{date}</p>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Pesquisa (estrutura visual) */}
          <label className="relative hidden lg:block" title="Pesquisa disponível em breve">
            <span className="sr-only">Pesquisar (disponível em breve)</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input
              type="search"
              disabled
              placeholder="Pesquisar PRs, ativos, usuários…"
              className="h-9 w-72 cursor-not-allowed rounded-lg border border-border bg-surface pr-16 pl-9 text-sm text-text placeholder:text-faint xl:w-80"
            />
            <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-faint uppercase">
              Em breve
            </span>
          </label>
          <IconButton label="Pesquisar (disponível em breve)" className="lg:hidden">
            <Search className="size-[18px]" />
          </IconButton>

          {/* Notificações (estrutura visual, sem contagem fictícia) */}
          <IconButton label="Notificações (disponível em breve)">
            <Bell className="size-[18px]" />
          </IconButton>

          <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />

          {/* Perfil (sem login nesta etapa) */}
          <div
            className="flex items-center gap-2.5 rounded-lg py-1 pr-1 sm:pr-2"
            title="Autenticação ainda não implementada"
          >
            <span className="grid size-8 place-items-center rounded-full border border-gold-line bg-gold-soft text-gold">
              <UserRound className="size-4" />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[13px] font-semibold">Usuário local</span>
              <span className="block text-[11px] text-faint">Sem autenticação</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function IconButton({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled
      aria-label={label}
      title={label}
      className={`grid size-9 cursor-not-allowed place-items-center rounded-lg border border-border bg-surface text-faint ${className}`}
    >
      {children}
    </button>
  );
}
