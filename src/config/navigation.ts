// Itens do menu lateral.
// Para liberar um módulo no futuro: criar a rota correspondente e mudar
// "available" para true. Nenhum outro arquivo precisa ser alterado.
import {
  FileBarChart,
  History,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  Printer,
  Settings,
  Ticket,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  available: boolean;
  /** Texto exibido no topo da página (quando diferente do rótulo do menu). */
  pageTitle?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAVIGATION: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, available: true },
      { label: "PRs", href: "/prs", icon: Ticket, available: false, pageTitle: "Pedidos de Requisição" },
      { label: "Histórico", href: "/historico", icon: History, available: false },
    ],
  },
  {
    label: "Inventário",
    items: [
      { label: "Estoque", href: "/estoque", icon: Package, available: false },
      { label: "Impressoras", href: "/impressoras", icon: Printer, available: false },
      { label: "Ativos", href: "/ativos", icon: MonitorSmartphone, available: false },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Relatórios", href: "/relatorios", icon: FileBarChart, available: false },
      { label: "Configurações", href: "/configuracoes", icon: Settings, available: false },
    ],
  },
];

/** Item do menu correspondente ao endereço atual (inclui subpáginas). */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAVIGATION.flatMap((g) => g.items).find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
