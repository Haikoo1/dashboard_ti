import { describe, expect, it } from "vitest";
import { pageWindow } from "../components/tickets-table";
import { hasActiveFilters, listFiltersToQuery, parseListFilters } from "./list-filters";

describe("filtros da listagem", () => {
  it("padrões: abertura mais recente primeiro, página 1, sem filtros", () => {
    const { filters, ignored } = parseListFilters({});
    expect(filters).toEqual({ sort: "abertura", direction: "desc", page: 1 });
    expect(ignored).toEqual([]);
    expect(hasActiveFilters(filters)).toBe(false);
  });

  it("lê os parâmetros em português e ignora os inválidos", () => {
    const { filters, ignored } = parseListFilters({
      busca: "  impressora ",
      status: "PENDENTE",
      prioridade: "2",
      responsavel: "nenhum",
      situacao: "atrasado",
      aberto_de: "2026-03-01",
      aberto_ate: "2026-02-31",
      ordem: "prazo",
      pagina: "-3",
      setor: "abc",
    });
    expect(filters).toMatchObject({
      q: "impressora",
      status: "PENDENTE",
      priorityId: 2,
      assignee: "nenhum",
      situation: "atrasado",
      openedFrom: "2026-03-01",
      sort: "prazo",
      direction: "asc",
      page: 1,
    });
    expect(ignored.sort()).toEqual(["aberto_ate", "pagina", "setor"]);
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("monta o endereço omitindo os valores padrão (ida e volta)", () => {
    expect(listFiltersToQuery({ sort: "abertura", direction: "desc", page: 1 })).toBe("");
    const query = listFiltersToQuery({ status: "ABERTO", assignee: 7, sort: "prioridade", direction: "asc", page: 3 });
    expect(query).toBe("?status=ABERTO&responsavel=7&ordem=prioridade&pagina=3");
    const back = parseListFilters(Object.fromEntries(new URLSearchParams(query)));
    expect(back.filters).toMatchObject({ status: "ABERTO", assignee: 7, sort: "prioridade", direction: "asc", page: 3 });
  });

  it("paginação: primeira, última e vizinhas, com saltos", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });
});
