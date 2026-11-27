// "Usuário atual": quem está usando o sistema neste navegador.
//
// LIMITAÇÃO DE SEGURANÇA: o sistema não tem login. A escolha fica num cookie e
// qualquer pessoa com acesso ao computador pode trocar de usuário. Isso serve
// para REGISTRAR quem fez cada ação, não para PROTEGER o sistema.
// O servidor sempre confere se o usuário escolhido existe e está ativo.
import { cookies } from "next/headers";
import type { User } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const CURRENT_USER_COOKIE = "usuario_atual";

/** Validade do cookie: um ano. */
export const CURRENT_USER_MAX_AGE = 60 * 60 * 24 * 365;

/** Usuário atual, se houver um escolhido, existente e ativo. */
export async function getCurrentUser(): Promise<User | null> {
  const raw = (await cookies()).get(CURRENT_USER_COOKIE)?.value;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  const user = await db.user.findUnique({ where: { id } });
  return user?.active ? user : null;
}
