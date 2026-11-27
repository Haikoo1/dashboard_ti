// Regras dos cadastros mínimos de usuários e setores.
import { z } from "zod";
import type { UserRole } from "@/generated/prisma/enums";

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrador",
  TECNICO: "Técnico",
  SOLICITANTE: "Solicitante",
};

export const ROLES = ["ADMIN", "TECNICO", "SOLICITANTE"] as const satisfies readonly UserRole[];

export type PeopleErrorCode = "NAO_ENCONTRADO" | "SEM_PERMISSAO" | "DADOS_INVALIDOS" | "DUPLICADO" | "BLOQUEADO";

export class PeopleError extends Error {
  constructor(
    readonly code: PeopleErrorCode,
    message: string,
    /** Campo do formulário relacionado ao erro, quando houver. */
    readonly field?: string,
  ) {
    super(message);
    this.name = "PeopleError";
  }
}

const optionalId = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().int().positive().nullable(),
);

export const sectorSchema = z.object({
  name: z
    .string({ error: "Informe o nome do setor." })
    .trim()
    .min(2, "O nome do setor deve ter ao menos 2 caracteres.")
    .max(100, "O nome do setor pode ter no máximo 100 caracteres."),
});
export type SectorInput = z.input<typeof sectorSchema>;

export const userSchema = z
  .object({
    name: z
      .string({ error: "Informe o nome." })
      .trim()
      .min(3, "O nome deve ter ao menos 3 caracteres.")
      .max(150, "O nome pode ter no máximo 150 caracteres."),
    email: z
      .string({ error: "Informe o e-mail." })
      .trim()
      .toLowerCase()
      .pipe(z.email("Informe um e-mail válido.").max(255, "E-mail longo demais.")),
    role: z.enum(ROLES, { error: "Escolha o papel do usuário." }),
    sectorId: optionalId,
  })
  // Quem abre PRs precisa de setor: o PR registra o setor do solicitante.
  .refine((u) => u.role !== "SOLICITANTE" || u.sectorId !== null, {
    message: "Solicitantes precisam de um setor.",
    path: ["sectorId"],
  });
export type UserInput = z.input<typeof userSchema>;
