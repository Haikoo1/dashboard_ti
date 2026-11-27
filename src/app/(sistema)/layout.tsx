// Layout das páginas internas do sistema. A pasta "(sistema)" é um grupo de
// rotas: organiza os arquivos sem aparecer no endereço (/dashboard, /prs...).
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CurrentDate, CurrentDateFallback } from "@/components/layout/current-date";
import { DemoBanner } from "@/components/layout/demo-banner";
import { CurrentUserMenu, CurrentUserMenuFallback } from "@/modules/people/components/current-user-menu";

export default function SistemaLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      banner={
        <Suspense fallback={null}>
          <DemoBanner />
        </Suspense>
      }
      date={
        <Suspense fallback={<CurrentDateFallback />}>
          <CurrentDate />
        </Suspense>
      }
      profile={
        <Suspense fallback={<CurrentUserMenuFallback />}>
          <CurrentUserMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
