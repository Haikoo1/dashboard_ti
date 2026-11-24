"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAVIGATION, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/cn";

type SidebarProps = {
  /** Gaveta aberta (somente telas pequenas). */
  open: boolean;
  onClose: () => void;
};

/**
 * Menu lateral, com três comportamentos conforme a largura da tela:
 * - celular (< 768px): gaveta que abre sobre o conteúdo;
 * - tablet (768–1023px): barra estreita só com ícones;
 * - computador (≥ 1024px): menu completo com rótulos.
 */
export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Fundo escurecido atrás da gaveta (celular) */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        id="menu-principal"
        aria-label="Menu principal"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:top-0 md:h-dvh md:translate-x-0 md:transition-none",
          "md:w-[72px] lg:w-64",
        )}
      >
        {/* Marca */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5 md:max-lg:justify-center md:max-lg:px-0">
          <BrandMark />
          <div className="min-w-0 md:max-lg:hidden">
            <p className="text-[15px] leading-tight font-semibold tracking-tight">Gestão de TI</p>
            <p className="text-[11px] tracking-[0.14em] text-faint uppercase">Central de operações</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="ml-auto rounded-md p-1.5 text-muted hover:bg-surface-3 hover:text-text md:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 md:max-lg:px-2">
          {NAVIGATION.map((group) => (
            <div key={group.label} className="mb-6 last:mb-0">
              <p className="mb-2 px-3 text-[10.5px] font-semibold tracking-[0.16em] text-faint uppercase md:max-lg:sr-only">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavEntry item={item} active={isActive(pathname, item.href)} onNavigate={onClose} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Rodapé */}
        <div className="shrink-0 border-t border-border px-5 py-4 md:max-lg:px-0 md:max-lg:text-center">
          <p className="font-mono text-[11px] text-faint">
            <span className="md:max-lg:hidden">Versão </span>0.1
          </p>
        </div>
      </aside>
    </>
  );
}

function NavEntry({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  const base =
    "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium md:max-lg:justify-center md:max-lg:px-0";

  if (!item.available) {
    return (
      <span
        aria-disabled="true"
        title={`${item.label} — disponível em breve`}
        className={cn(base, "cursor-not-allowed text-faint")}
      >
        <Icon className="size-[18px] shrink-0 opacity-70" strokeWidth={1.75} />
        <span className="md:max-lg:sr-only">{item.label}</span>
        <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold tracking-wide text-faint uppercase md:max-lg:hidden">
          Em breve
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        base,
        "transition-colors",
        active ? "bg-gold-soft text-gold-bright" : "text-muted hover:bg-surface-3 hover:text-text",
      )}
    >
      {/* Marcador dourado do item ativo */}
      <span
        aria-hidden
        className={cn(
          "absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-gold transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
      <span className="md:max-lg:sr-only">{item.label}</span>
    </Link>
  );
}

function BrandMark() {
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-lg border border-gold-line bg-gradient-to-br from-gold-soft to-transparent"
    >
      <svg viewBox="0 0 24 24" className="size-5 text-gold" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" strokeLinejoin="round" />
        <path d="M12 12v9M12 12l8-4.5M12 12 4 7.5" strokeLinejoin="round" opacity=".55" />
      </svg>
    </span>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
