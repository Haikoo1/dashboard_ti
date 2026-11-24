// Cores das séries dos gráficos do Dashboard.
// Validadas para o fundo escuro (#121215): faixa de luminosidade, contraste
// mínimo de 3:1 e separação para os principais tipos de daltonismo.
// Cada série sempre mantém a mesma cor, em qualquer filtro.
export const SERIES_COLOR = {
  opened: "#3987e5",
  concluded: "#c98500",
} as const;

export const SERIES_LABEL = {
  opened: "Abertos",
  concluded: "Concluídos",
} as const;
