"use client";

// Lista de usuários com cadastro e edição (somente administradores, ou
// qualquer pessoa durante a primeira configuração).
import { Pencil, UserPlus, UsersRound } from "lucide-react";
import { useState } from "react";
import type { UserRole } from "@/generated/prisma/enums";
import { Field, FormDialog, inputClass } from "@/components/ui/form-dialog";
import { cn } from "@/lib/cn";
import { saveUserAction } from "../actions";
import { ROLE_LABEL, ROLES } from "../domain";
import type { SectorListItem, UserListItem } from "../queries";
import { Avatar } from "./user-switcher";
import { Notice, PanelEmpty, StatusBadge } from "./panel-parts";

type Filter = "TODOS" | UserRole;

export function UsersPanel({
  users,
  sectors,
  canEdit,
}: {
  users: UserListItem[];
  sectors: SectorListItem[];
  canEdit: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("TODOS");
  const [notice, setNotice] = useState<string | null>(null);
  const visible = filter === "TODOS" ? users : users.filter((u) => u.role === filter);
  const activeSectors = sectors.filter((s) => s.active);

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div role="group" aria-label="Filtrar por papel" className="flex flex-wrap gap-1">
          {(["TODOS", ...ROLES] as Filter[]).map((f) => {
            const count = f === "TODOS" ? users.length : users.filter((u) => u.role === f).length;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f ? "bg-gold-soft text-gold-bright ring-1 ring-gold-line" : "text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                {f === "TODOS" ? "Todos" : ROLE_LABEL[f]}
                <span className="ml-1.5 text-faint">{count}</span>
              </button>
            );
          })}
        </div>
        {canEdit && (
          <UserDialog
            sectors={activeSectors}
            onSuccess={setNotice}
            trigger={{
              className: "inline-flex items-center gap-2 rounded-lg bg-gold px-3.5 py-2 text-xs font-semibold text-bg transition-colors hover:bg-gold-bright",
              content: (
                <>
                  <UserPlus className="size-4" aria-hidden />
                  Novo usuário
                </>
              ),
            }}
          />
        )}
      </header>

      {notice && <Notice message={notice} onClose={() => setNotice(null)} />}

      {users.length === 0 ? (
        <PanelEmpty
          icon={<UsersRound className="size-7" strokeWidth={1.6} />}
          title="Nenhum usuário cadastrado"
          hint={
            activeSectors.length === 0
              ? "Cadastre primeiro os setores (aba Setores) e depois os usuários."
              : "Cadastre o primeiro administrador para começar."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="text-faint">
              <tr className="border-b border-border">
                <th className="py-2.5 pr-3 pl-4 font-medium sm:pl-5">Nome</th>
                <th className="px-3 py-2.5 font-medium">Papel</th>
                <th className="px-3 py-2.5 font-medium">Setor</th>
                <th className="px-3 py-2.5 text-right font-medium" title="PRs em atendimento sob responsabilidade">
                  PRs em atendimento
                </th>
                <th className="px-3 py-2.5 font-medium">Situação</th>
                {canEdit && <th className="py-2.5 pr-4 pl-3 sm:pr-5" aria-label="Ações" />}
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} className={cn("border-b border-border/60 last:border-0", !u.active && "opacity-55")}>
                  <td className="py-2.5 pr-3 pl-4 sm:pl-5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={u.name} small />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-text">{u.name}</span>
                        <span className="block truncate text-[11px] text-faint">{u.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{ROLE_LABEL[u.role]}</td>
                  <td className="px-3 py-2.5 text-muted">{u.sectorName ?? <span className="text-faint">—</span>}</td>
                  <td className="px-3 py-2.5 text-right text-muted">{u.role === "SOLICITANTE" ? <span className="text-faint">—</span> : u.activeAssigned}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge active={u.active} />
                  </td>
                  {canEdit && (
                    <td className="py-2.5 pr-4 pl-3 text-right sm:pr-5">
                      <UserDialog
                        user={u}
                        sectors={activeSectors}
                        onSuccess={setNotice}
                        trigger={{
                          className: "rounded-md p-1.5 text-faint transition-colors hover:bg-surface-3 hover:text-text",
                          ariaLabel: `Editar ${u.name}`,
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

function UserDialog({
  user,
  sectors,
  trigger,
  onSuccess,
}: {
  user?: UserListItem;
  sectors: SectorListItem[];
  trigger: { content: React.ReactNode; className: string; ariaLabel?: string };
  onSuccess: (message: string) => void;
}) {
  // Um setor inativo continua aparecendo para quem já está nele.
  const options =
    user?.sectorId && !sectors.some((s) => s.id === user.sectorId)
      ? [...sectors, { id: user.sectorId, name: `${user.sectorName} (inativo)`, active: false, users: 0, tickets: 0 }]
      : sectors;

  return (
    <FormDialog
      title={user ? "Editar usuário" : "Novo usuário"}
      description={user ? user.email : "O e-mail identifica o usuário e não pode se repetir."}
      trigger={trigger}
      action={saveUserAction}
      submitLabel={user ? "Salvar alterações" : "Cadastrar"}
      onSuccess={onSuccess}
    >
      {({ errorField, values }) => (
        <>
          {user && <input type="hidden" name="id" value={user.id} />}
          <Field label="Nome completo" invalid={errorField === "name"}>
            <input name="name" required autoFocus minLength={3} maxLength={150} defaultValue={values?.name ?? user?.name} className={inputClass} />
          </Field>
          <Field label="E-mail" invalid={errorField === "email"}>
            <input name="email" type="email" required maxLength={255} defaultValue={values?.email ?? user?.email} className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Papel" invalid={errorField === "role"}>
              <select name="role" required defaultValue={values?.role ?? user?.role ?? "SOLICITANTE"} className={inputClass}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Setor" hint="Obrigatório para solicitantes." invalid={errorField === "sectorId"}>
              <select name="sectorId" defaultValue={values?.sectorId ?? user?.sectorId ?? ""} className={inputClass}>
                <option value="">Sem setor</option>
                {options.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {user && (
            <label className="flex items-center gap-2.5 text-xs text-muted">
              <input type="checkbox" name="active" defaultChecked={values ? values.active === "on" : user.active} className="size-4 accent-[var(--gold)]" />
              Usuário ativo
              <span className="text-faint">(inativos não aparecem nos seletores, mas o histórico é mantido)</span>
            </label>
          )}
        </>
      )}
    </FormDialog>
  );
}
