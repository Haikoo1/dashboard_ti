"use server";

// Server Actions dos cadastros e da escolha do usuário atual.
// Cada ação valida tudo no servidor (o service confere permissão e dados) e
// devolve um resultado simples para o formulário exibir.
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { CURRENT_USER_COOKIE, CURRENT_USER_MAX_AGE, getCurrentUser } from "./current-user";
import { PeopleError } from "./domain";
import { createSector, createUser, updateSector, updateUser } from "./service";

export type FormResult = {
  ok: boolean;
  message: string;
  /** Erro ligado a um campo específico do formulário. */
  field?: string;
  /** Valores enviados, para o formulário não perder o que foi digitado após um erro. */
  values?: Record<string, string>;
};

export async function setCurrentUserAction(userId: number): Promise<FormResult> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.active) return { ok: false, message: "Usuário não encontrado ou inativo." };
  await rememberCurrentUser(user.id);
  return { ok: true, message: `Agora você está usando o sistema como ${user.name}.` };
}

async function rememberCurrentUser(userId: number) {
  (await cookies()).set(CURRENT_USER_COOKIE, String(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: CURRENT_USER_MAX_AGE,
  });
}

export async function saveSectorAction(_prev: FormResult | null, form: FormData): Promise<FormResult> {
  return run(form, async (actorId) => {
    const id = optionalNumber(form.get("id"));
    const input = { name: String(form.get("name") ?? "") };
    if (id === null) {
      const sector = await createSector(db, actorId, input);
      return `Setor "${sector.name}" cadastrado.`;
    }
    const sector = await updateSector(db, actorId, { ...input, id, active: form.get("active") === "on" });
    return `Setor "${sector.name}" atualizado.`;
  });
}

export async function saveUserAction(_prev: FormResult | null, form: FormData): Promise<FormResult> {
  return run(form, async (actorId) => {
    const id = optionalNumber(form.get("id"));
    const input = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      role: String(form.get("role") ?? "") as never,
      sectorId: form.get("sectorId") as string | null,
    };
    if (id === null) {
      const user = await createUser(db, actorId, input);
      // Primeira configuração: o primeiro administrador passa a ser o usuário atual,
      // para que a pessoa possa continuar os cadastros.
      if (actorId === null && user.role === "ADMIN") {
        await rememberCurrentUser(user.id);
        return `${user.name} cadastrado(a) e escolhido(a) como usuário atual.`;
      }
      return `${user.name} cadastrado(a).`;
    }
    const user = await updateUser(db, actorId, { ...input, id, active: form.get("active") === "on" });
    return `${user.name} atualizado(a).`;
  });
}

/** Executa a operação com o usuário atual e converte erros de regra em mensagens. */
async function run(form: FormData, operation: (actorId: number | null) => Promise<string>): Promise<FormResult> {
  const actor = await getCurrentUser();
  try {
    const message = await operation(actor?.id ?? null);
    refresh();
    return { ok: true, message };
  } catch (e) {
    const values = Object.fromEntries([...form.entries()].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<string, string>;
    if (e instanceof PeopleError) return { ok: false, message: e.message, field: e.field, values };
    console.error(e);
    return { ok: false, message: "Não foi possível salvar. Tente novamente.", values };
  }
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : null;
}
