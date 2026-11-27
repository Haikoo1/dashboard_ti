// Busca o usuário atual e a lista de usuários ativos para o seletor da barra superior.
import { db } from "@/lib/db";
import { getCurrentUser } from "../current-user";
import { listActiveUsers } from "../queries";
import { Avatar, UserSwitcher } from "./user-switcher";

export async function CurrentUserMenu() {
  const data = await Promise.all([getCurrentUser(), listActiveUsers(db)]).catch(() => null);
  // Banco desligado: a página mostra a orientação; aqui só um marcador neutro.
  if (!data) return <Avatar name={null} />;
  const [current, users] = data;
  return <UserSwitcher current={current && { id: current.id, name: current.name, role: current.role }} users={users} />;
}

export function CurrentUserMenuFallback() {
  return <span className="block size-8 animate-pulse rounded-full bg-surface-3" aria-hidden />;
}
