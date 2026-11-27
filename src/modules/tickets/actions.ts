"use server";

// Server Actions dos PRs. Toda a validação e as regras ficam no service;
// aqui só se identifica o usuário atual e se traduz o resultado para a tela.
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/modules/people/current-user";
import { TicketError } from "./domain/rules";
import { createTicket } from "./service/ticket-service";

export type TicketFormResult = {
  ok: boolean;
  message: string;
  field?: string;
  /** Valores enviados, para o formulário não perder o que foi digitado após um erro. */
  values?: Record<string, string>;
};

export async function createTicketAction(_prev: TicketFormResult | null, form: FormData): Promise<TicketFormResult> {
  const values = formValues(form);
  const actor = await getCurrentUser();
  if (!actor) {
    return { ok: false, message: "Escolha o usuário atual (canto superior direito) antes de abrir um PR.", values };
  }

  let number: string;
  try {
    const ticket = await createTicket(db, actor.id, {
      title: values.title ?? "",
      description: values.description ?? "",
      // Solicitantes só abrem PRs em seu nome (o service também confere).
      requesterId: actor.role === "SOLICITANTE" ? actor.id : (values.requesterId as never),
      categoryId: values.categoryId as never,
      priorityId: values.priorityId as never,
      assigneeId: values.assigneeId ? (values.assigneeId as never) : null,
    });
    number = ticket.number;
  } catch (e) {
    if (e instanceof TicketError) return { ok: false, message: e.message, field: e.field, values };
    console.error(e);
    return { ok: false, message: "Não foi possível abrir o PR. Tente novamente.", values };
  }
  // Fora do try: redirect() funciona lançando uma exceção especial do Next.js.
  redirect(`/prs?criado=${encodeURIComponent(number)}`);
}

function formValues(form: FormData): Record<string, string> {
  return Object.fromEntries(
    [...form.entries()].filter(([k, v]) => !k.startsWith("$") && typeof v === "string"),
  ) as Record<string, string>;
}
