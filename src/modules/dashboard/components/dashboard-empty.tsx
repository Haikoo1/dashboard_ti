// Estado vazio do Dashboard: ainda não há nenhum PR registrado no banco.
// Mostra o que o painel vai exibir, sem inventar números.
import { AlarmClock, CircleCheck, CircleDot, CirclePause, Inbox, Wrench } from "lucide-react";

const PREVIEW = [
  { label: "PRs registrados", icon: Inbox },
  { label: "Abertos", icon: CircleDot },
  { label: "Em andamento", icon: Wrench },
  { label: "Pendentes", icon: CirclePause },
  { label: "Concluídos", icon: CircleCheck },
  { label: "Atrasados", icon: AlarmClock },
] as const;

export function DashboardEmpty({ demoAvailable }: { demoAvailable: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface px-6 py-10 sm:px-10">
      <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 size-80 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-2xl border border-gold-line bg-gold-soft text-gold">
          <Inbox className="size-7" strokeWidth={1.6} />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">Nenhum PR registrado ainda</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Os indicadores são calculados a partir dos PRs registrados no sistema. Assim que os primeiros forem
          abertos, os números aparecem aqui automaticamente, com comparação entre períodos.
        </p>
      </div>

      <ul className="relative mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Indicadores que serão exibidos">
        {PREVIEW.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className="flex items-center gap-2.5 rounded-lg border border-dashed border-border-strong px-3 py-2.5 text-xs text-muted"
          >
            <Icon className="size-4 shrink-0 text-gold-dim" strokeWidth={1.8} aria-hidden />
            {label}
            <span className="ml-auto font-mono text-faint" aria-hidden>
              —
            </span>
          </li>
        ))}
      </ul>

      {demoAvailable && (
        <p className="relative mx-auto mt-8 max-w-xl text-center text-xs leading-relaxed text-faint">
          Quer ver o painel funcionando antes disso? Defina <code className="font-mono text-gold">APP_DATA_MODE=demo</code>{" "}
          no arquivo <code className="font-mono text-gold">.env</code> e reinicie a aplicação para usar o banco de
          demonstração, com dados fictícios.
        </p>
      )}
    </section>
  );
}
