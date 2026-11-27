import type { Metadata } from "next";
import { Suspense } from "react";
import { BackToList, NewTicketView } from "@/modules/tickets/components/new-ticket-view";

export const metadata: Metadata = { title: "Novo PR" };

export default function NovoPrPage() {
  return (
    <div className="animate-fade-up mx-auto max-w-4xl space-y-5">
      <div className="space-y-2">
        <BackToList />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Abrir novo PR</h2>
          <p className="mt-0.5 text-sm text-muted">Campos com * são obrigatórios.</p>
        </div>
      </div>
      <Suspense fallback={<div className="h-[36rem] animate-pulse rounded-xl bg-surface" aria-hidden />}>
        <NewTicketView />
      </Suspense>
    </div>
  );
}
