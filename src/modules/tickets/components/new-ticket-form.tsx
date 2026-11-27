"use client";

// Formulário de abertura de PR, organizado em seções.
// Validação na tela (campos obrigatórios e tamanhos) e, de verdade, no servidor.
// Os prazos mostrados são uma prévia: o servidor calcula os definitivos no
// momento em que o PR é salvo, com as mesmas regras (domain/sla.ts).
import { ClipboardList, Hash, Info, LoaderCircle, Tags, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import type { UserRole } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDuration } from "@/modules/dashboard/domain/format";
import { createTicketAction } from "../actions";
import { LIMITS } from "../domain/rules";
import { deadlinesAtOpening } from "../domain/sla";

export type NewTicketOptions = {
  actor: { id: number; name: string; role: UserRole };
  requesters: { id: number; name: string; sectorName: string }[];
  categories: { id: number; name: string }[];
  priorities: { id: number; name: string; color: string; level: number; responseSlaMinutes: number; resolutionSlaMinutes: number }[];
  technicians: { id: number; name: string }[];
};

const input =
  "w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-faint focus:border-gold-line focus:outline-none";

export function NewTicketForm({ options }: { options: NewTicketOptions }) {
  const [state, formAction, pending] = useActionState(createTicketAction, null);
  const values = state && !state.ok ? state.values : undefined;
  const errorField = state && !state.ok ? state.field : undefined;
  const isRequester = options.actor.role === "SOLICITANTE";

  const [requesterId, setRequesterId] = useState(values?.requesterId ?? (isRequester ? String(options.actor.id) : ""));
  const [priorityId, setPriorityId] = useState(values?.priorityId ?? "");
  const [assigneeId, setAssigneeId] = useState(values?.assigneeId ?? "");
  const [titleLength, setTitleLength] = useState(values?.title?.length ?? 0);

  // Valores devolvidos após um erro voltam a valer nos campos controlados.
  const [lastValues, setLastValues] = useState(values);
  if (values !== lastValues) {
    setLastValues(values);
    if (values) {
      setRequesterId(values.requesterId ?? requesterId);
      setPriorityId(values.priorityId ?? "");
      setAssigneeId(values.assigneeId ?? "");
    }
  }

  const requester = options.requesters.find((r) => r.id === (isRequester ? options.actor.id : Number(requesterId)));
  const priority = options.priorities.find((p) => String(p.id) === priorityId);

  return (
    <form action={formAction} className="space-y-5" noValidate={false}>
      {/* Identificação */}
      <Section icon={<ClipboardList className="size-4" />} title="Identificação da solicitação">
        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          <Field label="Título" required invalid={errorField === "title"} hint={`${titleLength}/${LIMITS.titleMax} caracteres`}>
            <input
              name="title"
              required
              autoFocus
              minLength={LIMITS.titleMin}
              maxLength={LIMITS.titleMax}
              defaultValue={values?.title}
              onChange={(e) => setTitleLength(e.target.value.length)}
              placeholder="Ex.: Impressora do 2º andar não imprime"
              className={input}
            />
          </Field>
          <Field label="Número do PR">
            <div className={cn(input, "flex items-center gap-2 text-faint")}>
              <Hash className="size-3.5" aria-hidden />
              Gerado ao salvar
            </div>
          </Field>
        </div>
        <Field
          label="Descrição detalhada"
          required
          invalid={errorField === "description"}
          hint="Explique o problema: o que acontece, desde quando, onde e o que já foi tentado."
        >
          <textarea
            name="description"
            required
            minLength={LIMITS.descriptionMin}
            maxLength={LIMITS.descriptionMax}
            rows={5}
            defaultValue={values?.description}
            className={cn(input, "resize-y")}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Solicitante" required invalid={errorField === "requesterId"}>
            {isRequester ? (
              <>
                <input type="hidden" name="requesterId" value={options.actor.id} />
                <div className={cn(input, "text-muted")}>{options.actor.name} (você)</div>
              </>
            ) : (
              <select name="requesterId" required value={requesterId} onChange={(e) => setRequesterId(e.target.value)} className={input}>
                <option value="" disabled>
                  Escolha quem está pedindo…
                </option>
                {options.requesters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.sectorName}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Setor solicitante" hint="Preenchido pelo cadastro do solicitante e registrado no PR.">
            <div className={cn(input, requester ? "text-text" : "text-faint")}>{requester?.sectorName ?? "—"}</div>
          </Field>
        </div>
      </Section>

      {/* Classificação */}
      <Section icon={<Tags className="size-4" />} title="Classificação">
        <Field label="Categoria" required invalid={errorField === "categoryId"}>
          <select name="categoryId" required defaultValue={values?.categoryId ?? ""} className={cn(input, "sm:max-w-sm")}>
            <option value="" disabled>
              Escolha a categoria…
            </option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend className={cn("mb-1.5 text-xs font-medium", errorField === "priorityId" ? "text-danger" : "text-muted")}>
            Prioridade <span className="text-gold">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {options.priorities.map((p) => (
              <label
                key={p.id}
                className={cn(
                  "cursor-pointer rounded-lg border bg-surface-2 p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold",
                  String(p.id) === priorityId ? "border-gold bg-gold-soft ring-1 ring-gold" : "border-border-strong hover:border-gold-line",
                )}
              >
                <input
                  type="radio"
                  name="priorityId"
                  value={p.id}
                  required
                  checked={String(p.id) === priorityId}
                  onChange={() => setPriorityId(String(p.id))}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
                  {p.name}
                </span>
                <span className="mt-1 block text-[11px] text-faint">
                  Resposta {formatDuration(p.responseSlaMinutes)} · Resolução {formatDuration(p.resolutionSlaMinutes)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      {/* Atendimento */}
      <Section icon={<UserRoundCog className="size-4" />} title="Atendimento">
        <div className="grid gap-4 sm:grid-cols-2">
          {isRequester ? (
            <Field label="Responsável técnico" hint="Definido pela equipe de TI.">
              <div className={cn(input, "text-faint")}>A definir</div>
            </Field>
          ) : (
            <Field label="Responsável técnico" hint="Opcional: pode ser atribuído depois." invalid={errorField === "assigneeId"}>
              <div className="flex gap-2">
                <select name="assigneeId" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={input}>
                  <option value="">Sem responsável (atribuir depois)</option>
                  {options.technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {options.technicians.some((t) => t.id === options.actor.id) && assigneeId !== String(options.actor.id) && (
                  <button
                    type="button"
                    onClick={() => setAssigneeId(String(options.actor.id))}
                    className="shrink-0 rounded-lg border border-border-strong px-3 text-xs font-medium text-muted hover:border-gold-line hover:text-text"
                  >
                    Atribuir a mim
                  </button>
                )}
              </div>
            </Field>
          )}
          <Field label="Status inicial">
            <div className={cn(input, "text-muted")}>Aberto</div>
          </Field>
        </div>
        <DeadlinePreview priority={priority} />
      </Section>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg border border-danger/35 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/prs" className="rounded-lg px-4 py-2.5 text-center text-sm font-medium text-muted hover:bg-surface-2 hover:text-text">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-gold-bright disabled:opacity-60"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {pending ? "Abrindo…" : "Abrir PR"}
        </button>
      </div>
    </form>
  );
}

/** Abertura e prazos previstos se o PR for salvo agora (atualiza a cada 30 s). */
function DeadlinePreview({ priority }: { priority: NewTicketOptions["priorities"][number] | undefined }) {
  // O horário só é lido no navegador, depois de montar (evita diferença com o servidor).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const deadlines = now && priority ? deadlinesAtOpening(now, priority) : null;
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-bg/40 p-3.5 text-xs sm:grid-cols-3">
      <Item label="Data e hora de abertura" value={now ? `${formatDateTime(now)} (ao salvar)` : "—"} />
      <Item
        label="Prazo de primeira resposta"
        value={deadlines ? formatDateTime(deadlines.responseDueAt) : "Escolha a prioridade"}
        muted={!deadlines}
      />
      <Item
        label="Prazo de resolução"
        value={deadlines ? formatDateTime(deadlines.dueAt) : "Escolha a prioridade"}
        muted={!deadlines}
      />
      <p className="flex items-center gap-1.5 text-[11px] text-faint sm:col-span-3">
        <Info className="size-3.5 shrink-0" aria-hidden />
        Prazos em tempo corrido, conforme o SLA da prioridade. Os valores definitivos são calculados no momento em que o PR é salvo.
      </p>
    </div>
  );
}

function Item({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-faint">{label}</p>
      <p className={cn("mt-0.5 font-medium", muted ? "text-faint" : "text-text")}>{value}</p>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-7 place-items-center rounded-lg border border-gold-line bg-gold-soft text-gold">{icon}</span>
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required = false,
  invalid = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  invalid?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className={cn("mb-1.5 block text-xs font-medium", invalid ? "text-danger" : "text-muted")}>
        {label}
        {required && <span className="ml-0.5 text-gold">*</span>}
      </span>
      <span className={cn("block", invalid && "[&_input]:border-danger/60 [&_select]:border-danger/60 [&_textarea]:border-danger/60")}>
        {children}
      </span>
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}
