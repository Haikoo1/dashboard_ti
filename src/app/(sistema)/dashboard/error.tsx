"use client";

// Tela exibida se algo inesperado falhar ao montar o Dashboard.
// (O caso do banco desligado tem uma orientação própria; ver DatabaseOffline.)
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <section role="alert" className="rounded-2xl border border-danger/35 bg-surface px-6 py-10 text-center sm:px-10">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-danger/40 bg-danger-soft text-danger">
        <TriangleAlert className="size-7" strokeWidth={1.6} />
      </span>
      <h2 className="mt-5 text-xl font-semibold tracking-tight">Não foi possível carregar o Dashboard</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Ocorreu um erro inesperado. Tente novamente; se continuar, verifique o terminal onde a aplicação está rodando.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-gold-bright"
      >
        <RotateCcw className="size-4" aria-hidden />
        Tentar novamente
      </button>
      {digest && <p className="mt-4 font-mono text-[11px] text-faint">Código do erro: {digest}</p>}
    </section>
  );
}
