// Aviso exibido quando o banco de dados do projeto não responde
// (o caso mais comum: o computador foi reiniciado e o banco não foi ligado).
import { DatabaseZap } from "lucide-react";

export function DatabaseOffline() {
  return (
    <section
      role="alert"
      className="relative overflow-hidden rounded-2xl border border-warning/35 bg-surface px-6 py-10 sm:px-10"
    >
      <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-2xl border border-warning/40 bg-warning/10 text-warning">
          <DatabaseZap className="size-7" strokeWidth={1.6} />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">Não foi possível conectar ao banco de dados</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          O banco do projeto não liga sozinho com o Windows. Abra um terminal na pasta do projeto, rode o comando
          abaixo e recarregue esta página.
        </p>
        <code className="mt-5 rounded-lg border border-border-strong bg-bg px-4 py-2.5 font-mono text-sm text-gold">
          npm run db:up
        </code>
        <p className="mt-5 text-xs text-faint">
          Se o problema continuar, confira se o arquivo <code className="font-mono">.env</code> existe e se{" "}
          <code className="font-mono">npm run db:status</code> mostra o banco ligado.
        </p>
      </div>
    </section>
  );
}
