import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardView, DashboardViewSkeleton } from "@/modules/dashboard/components/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
};

// A página em si é síncrona: o Next.js envia a moldura na hora e o conteúdo,
// que depende do endereço (?periodo=...) e do banco, chega em seguida.
// A classe "group" permite esmaecer os cards enquanto um novo período carrega.
export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="group animate-fade-up space-y-6">
      <Suspense fallback={<DashboardViewSkeleton />}>
        {searchParams.then((params) => (
          <DashboardView searchParams={params} />
        ))}
      </Suspense>
    </div>
  );
}
