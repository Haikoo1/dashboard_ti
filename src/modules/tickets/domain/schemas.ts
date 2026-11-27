// Validação dos dados recebidos pelas operações de PR.
// Usada no servidor (service) e, nas próximas entregas, também nos formulários.
import { z } from "zod";
import { LIMITS } from "./rules";

const id = z.coerce.number().int().positive();
const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(min, min <= 1 ? `Informe ${label}.` : `${capitalize(label)} deve ter ao menos ${min} caracteres.`)
    .max(max, `${capitalize(label)} pode ter no máximo ${max} caracteres.`);

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const createTicketSchema = z.object({
  title: text("o título", LIMITS.titleMin, LIMITS.titleMax),
  description: text("a descrição", LIMITS.descriptionMin, LIMITS.descriptionMax),
  requesterId: id,
  categoryId: id,
  priorityId: id,
  assigneeId: id.nullish(),
});
export type CreateTicketInput = z.input<typeof createTicketSchema>;

export const detailSchema = text("o texto", 1, LIMITS.detailMax);
export const notesSchema = z.string().trim().max(LIMITS.detailMax).optional();
export const commentSchema = text("o comentário", 1, LIMITS.commentMax);

export const editTicketSchema = z.object({
  title: text("o título", LIMITS.titleMin, LIMITS.titleMax).optional(),
  description: text("a descrição", LIMITS.descriptionMin, LIMITS.descriptionMax).optional(),
  categoryId: id.optional(),
});
export type EditTicketInput = z.input<typeof editTicketSchema>;
