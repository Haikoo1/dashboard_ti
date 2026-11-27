import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketsView, TicketsViewSkeleton } from "@/modules/tickets/components/tickets-view";

export const metadata: Metadata = { title: "PRs" };

// Listagem de PRs. Pesquisa, filtros, ordenação e página ficam no endereço.
export default function PrsPage({ searchParams }: PageProps<"/prs">) {
  return (
    <div className="animate-fade-up space-y-5">
      <Suspense fallback={<TicketsViewSkeleton />}>
        {searchParams.then((params) => (
          <TicketsView searchParams={params} />
        ))}
      </Suspense>
    </div>
  );
}
