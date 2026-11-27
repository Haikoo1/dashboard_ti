"use client";

// Lista de setores com cadastro e edição.
import { Building2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Field, FormDialog, inputClass } from "@/components/ui/form-dialog";
import { cn } from "@/lib/cn";
import { saveSectorAction } from "../actions";
import type { SectorListItem } from "../queries";
import { Notice, PanelEmpty, StatusBadge } from "./panel-parts";

export function SectorsPanel({ sectors, canEdit }: { sectors: SectorListItem[]; canEdit: boolean }) {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <p className="text-xs text-faint">
          O setor de cada PR é o do solicitante no momento da abertura; mudanças posteriores não alteram PRs antigos.
        </p>
        {canEdit && (
          <SectorDialog
            onSuccess={setNotice}
            trigger={{
              className: "inline-flex items-center gap-2 rounded-lg bg-gold px-3.5 py-2 text-xs font-semibold text-bg transition-colors hover:bg-gold-bright",
              content: (
                <>
                  <Plus className="size-4" aria-hidden />
                  Novo setor
                </>
              ),
            }}
          />
        )}
      </header>

      {notice && <Notice message={notice} onClose={() => setNotice(null)} />}

      {sectors.length === 0 ? (
        <PanelEmpty
          icon={<Building2 className="size-7" strokeWidth={1.6} />}
          title="Nenhum setor cadastrado"
          hint="Cadastre os setores da empresa (ex.: Financeiro, Comercial, TI). Solicitantes precisam de um setor."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="text-faint">
              <tr className="border-b border-border">
                <th className="py-2.5 pr-3 pl-4 font-medium sm:pl-5">Setor</th>
                <th className="px-3 py-2.5 text-right font-medium">Usuários</th>
                <th className="px-3 py-2.5 text-right font-medium">PRs abertos pelo setor</th>
                <th className="px-3 py-2.5 font-medium">Situação</th>
                {canEdit && <th className="py-2.5 pr-4 pl-3 sm:pr-5" aria-label="Ações" />}
              </tr>
            </thead>
            <tbody>
              {sectors.map((s) => (
                <tr key={s.id} className={cn("border-b border-border/60 last:border-0", !s.active && "opacity-55")}>
                  <td className="py-2.5 pr-3 pl-4 font-medium text-text sm:pl-5">{s.name}</td>
                  <td className="px-3 py-2.5 text-right text-muted">{s.users}</td>
                  <td className="px-3 py-2.5 text-right text-muted">{s.tickets}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge active={s.active} />
                  </td>
                  {canEdit && (
                    <td className="py-2.5 pr-4 pl-3 text-right sm:pr-5">
                      <SectorDialog
                        sector={s}
                        onSuccess={setNotice}
                        trigger={{
                          className: "rounded-md p-1.5 text-faint transition-colors hover:bg-surface-3 hover:text-text",
                          ariaLabel: `Editar ${s.name}`,
                          content: <Pencil className="size-3.5" />,
                        }}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SectorDialog({
  sector,
  trigger,
  onSuccess,
}: {
  sector?: SectorListItem;
  trigger: { content: React.ReactNode; className: string; ariaLabel?: string };
  onSuccess: (message: string) => void;
}) {
  return (
    <FormDialog
      title={sector ? "Editar setor" : "Novo setor"}
      trigger={trigger}
      action={saveSectorAction}
      submitLabel={sector ? "Salvar alterações" : "Cadastrar"}
      onSuccess={onSuccess}
    >
      {({ errorField, values }) => (
        <>
          {sector && <input type="hidden" name="id" value={sector.id} />}
          <Field label="Nome do setor" invalid={errorField === "name"}>
            <input name="name" required autoFocus minLength={2} maxLength={100} defaultValue={values?.name ?? sector?.name} className={inputClass} />
          </Field>
          {sector && (
            <label className="flex items-center gap-2.5 text-xs text-muted">
              <input type="checkbox" name="active" defaultChecked={values ? values.active === "on" : sector.active} className="size-4 accent-[var(--gold)]" />
              Setor ativo
              <span className="text-faint">(inativos não são oferecidos para novos usuários)</span>
            </label>
          )}
        </>
      )}
    </FormDialog>
  );
}
