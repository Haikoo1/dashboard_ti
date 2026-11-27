// Página de abertura de PR: confere os pré-requisitos e monta o formulário.
import { ArrowLeft, Settings, UserRoundSearch } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { DatabaseOffline } from "@/modules/dashboard/components/database-offline";
import { isDatabaseReachable } from "@/modules/dashboard/queries/shared";
import { getCurrentUser } from "@/modules/people/current-user";
import { NewTicketForm, type NewTicketOptions } from "./new-ticket-form";

export async function NewTicketView() {
  if (!(await isDatabaseReachable(db))) return <DatabaseOffline />;

  const actor = await getCurrentUser();
  if (!actor) {
    return (
      <Prerequisite
        icon={<UserRoundSearch className="size-7" strokeWidth={1.6} />}
        title="Escolha quem está usando o sistema"
        text="Para abrir um PR, escolha o usuário atual no seletor do canto superior direito. Ele fica registrado como quem abriu o PR."
      />
    );
  }

  const [requesters, categories, priorities, technicians] = await Promise.all([
    db.user.findMany({
      where: { active: true, sectorId: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sector: { select: { name: true } } },
    }),
    db.category.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.priority.findMany({
      where: { active: true },
      orderBy: { level: "asc" },
      select: { id: true, name: true, color: true, level: true, responseSlaMinutes: true, resolutionSlaMinutes: true },
    }),
    db.user.findMany({
      where: { active: true, role: { in: ["TECNICO", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (actor.role === "SOLICITANTE" && actor.sectorId === null) {
    return (
      <Prerequisite
        icon={<Settings className="size-7" strokeWidth={1.6} />}
        title="Seu cadastro está sem setor"
        text="O PR registra o setor de quem pede. Peça a um administrador para definir o seu setor em Configurações."
      />
    );
  }
  if (requesters.length === 0 || categories.length === 0 || priorities.length === 0) {
    return (
      <Prerequisite
        icon={<Settings className="size-7" strokeWidth={1.6} />}
        title="Faltam cadastros para abrir PRs"
        text={
          requesters.length === 0
            ? "Nenhum usuário ativo com setor foi encontrado para ser o solicitante. Cadastre setores e usuários em Configurações."
            : "As categorias e prioridades não foram encontradas. Rode npm run db:seed para cadastrá-las."
        }
        action={{ href: "/configuracoes/usuarios", label: "Ir para Configurações" }}
      />
    );
  }

  const options: NewTicketOptions = {
    actor: { id: actor.id, name: actor.name, role: actor.role },
    requesters: requesters.map((r) => ({ id: r.id, name: r.name, sectorName: r.sector!.name })),
    categories,
    priorities,
    technicians,
  };
  // A chave recria o formulário quando o usuário atual muda (o estado inicial depende dele).
  return <NewTicketForm key={actor.id} options={options} />;
}

function Prerequisite({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: { href: string; label: string };
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-gold-line bg-gold-soft text-gold">{icon}</span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{text}</p>
      {action && (
        <Link href={action.href} className="mt-5 inline-block rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-bg hover:bg-gold-bright">
          {action.label}
        </Link>
      )}
    </section>
  );
}

export function BackToList() {
  return (
    <Link href="/prs" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text">
      <ArrowLeft className="size-3.5" aria-hidden />
      Voltar para a listagem
    </Link>
  );
}
